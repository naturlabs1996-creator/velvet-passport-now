import type { DestinationThemeCapture } from "./destination-capture";
import type { VelvetDecision } from "./decision-engine";
import type { SearchDemandMetric } from "./demand-journey";

export type GapConfidence = "HIGH" | "MEDIUM" | "LOW";
export type GapAction = "BUILD_IMMEDIATELY" | "BUILD_NEXT" | "TEST_FIRST" | "MONITOR" | "IGNORE";

export type OpportunityGapScore = {
  theme: string;
  gapScore: number;
  confidence: GapConfidence;
  action: GapAction;
  components: {
    demandStrength: number;
    velvetFit: number;
    intentStrength: number;
    destinationWeakness: number;
    lowCommercialSaturation: number;
    serpEvidence: number;
  };
  evidence: {
    destinationStatus: string;
    queryCount: number;
    resultCount: number;
    topCompetitors: Array<{
      domain: string;
      resultType: string;
      visibilityShare: number;
    }>;
    commercialVisibilityShare: number;
    specialistTravelVisibilityShare: number;
    genericVisibilityShare: number;
    searchVolumeStatus: string;
    monthlySearches?: number;
  };
  reasons: string[];
  nextStep: string;
};

const SPECIALIST_TRAVEL = /(tripadvisor\.|lonelyplanet\.com|cntraveler\.com|timeout\.com|atlasobscura\.com|parisjetaime\.com|france\.fr|travel\.usnews\.com|fodors\.com|culturetrip\.com|ricksteves\.com)/i;
const GENERIC_AUTHORITY = /(wikipedia\.|britannica\.com|dictionary\.|merriam-webster\.com|wiktionary\.|imdb\.com|youtube\.com|reddit\.com)/i;

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function visibilitySum(
  destination: DestinationThemeCapture | undefined,
  predicate: (domain: string, resultType: string) => boolean,
) {
  return Math.round((destination?.domains ?? [])
    .filter((item) => predicate(item.domain, item.resultType))
    .reduce((sum, item) => sum + (item.visibilityShare ?? 0), 0) * 10) / 10;
}

function demandStrength(decision: VelvetDecision, demand?: SearchDemandMetric) {
  if (typeof demand?.monthlySearches === "number") {
    const volumeScore = Math.min(100, Math.log10(Math.max(10, demand.monthlySearches)) * 25);
    return clamp(volumeScore * 0.55 + decision.priorityScore * 0.45);
  }
  return clamp(
    decision.priorityScore * 0.62 +
    (decision.searchConfirmed ? 18 : 0) +
    (decision.askConfirmed ? 10 : 0) +
    (decision.buyConfirmed ? 10 : 0),
  );
}

function confidenceFor(input: {
  destination?: DestinationThemeCapture;
  demand?: SearchDemandMetric;
  decision: VelvetDecision;
}): GapConfidence {
  let points = 0;
  if ((input.destination?.queryCount ?? 0) >= 3) points += 2;
  else if ((input.destination?.queryCount ?? 0) >= 2) points += 1;
  if ((input.destination?.resultCount ?? 0) >= 12) points += 2;
  else if ((input.destination?.resultCount ?? 0) >= 6) points += 1;
  if (input.decision.sourceCount >= 3) points += 2;
  else if (input.decision.sourceCount >= 2) points += 1;
  if (input.demand?.status === "MEASURED") points += 2;
  else if (input.demand?.status === "ESTIMATED") points += 1;
  if (input.decision.askConfirmed && input.decision.searchConfirmed) points += 1;

  if (points >= 7) return "HIGH";
  if (points >= 4) return "MEDIUM";
  return "LOW";
}

function actionFor(score: number, confidence: GapConfidence): GapAction {
  if (score >= 82 && confidence !== "LOW") return "BUILD_IMMEDIATELY";
  if (score >= 72) return confidence === "LOW" ? "TEST_FIRST" : "BUILD_NEXT";
  if (score >= 55) return "TEST_FIRST";
  if (score >= 40) return "MONITOR";
  return "IGNORE";
}

export function buildOpportunityGapScore(input: {
  decision: VelvetDecision;
  destination?: DestinationThemeCapture;
  demand?: SearchDemandMetric;
}): OpportunityGapScore {
  const { decision, destination, demand } = input;
  const commercialVisibilityShare = visibilitySum(
    destination,
    (_domain, resultType) => resultType === "TOUR" || resultType === "MARKETPLACE",
  );
  const specialistTravelVisibilityShare = visibilitySum(
    destination,
    (domain) => SPECIALIST_TRAVEL.test(domain),
  );
  const genericVisibilityShare = visibilitySum(
    destination,
    (domain) => GENERIC_AUTHORITY.test(domain),
  );

  const topShare = destination?.topDomains?.[0]?.visibilityShare ?? 0;
  const relevantEvidence = Math.min(100,
    (destination?.queryCount ?? 0) * 18 +
    Math.min(40, (destination?.resultCount ?? 0) * 2),
  );

  const destinationWeakness = destination?.status === "UNKNOWN"
    ? 0
    : clamp(
        45 +
        genericVisibilityShare * 0.35 +
        Math.max(0, 28 - specialistTravelVisibilityShare) * 0.8 +
        Math.max(0, 18 - topShare) * 0.35,
      );

  const lowCommercialSaturation = clamp(100 - commercialVisibilityShare * 1.6);
  const demand = demandStrength(decision, input.demand);
  const velvetFit = clamp(decision.avgVelvetFit);
  const intentStrength = clamp(
    decision.avgTravelerIntent * 0.35 +
    decision.avgVelvetOpportunity * 0.65,
  );

  let score =
    demand * 0.28 +
    velvetFit * 0.19 +
    intentStrength * 0.18 +
    destinationWeakness * 0.24 +
    lowCommercialSaturation * 0.11;

  // Never let thin destination evidence masquerade as a proven gap.
  if (relevantEvidence < 35) score -= 15;
  if (destination?.status === "UNKNOWN") score -= 18;
  if (!decision.searchConfirmed) score -= 8;
  score = clamp(score);

  const confidence = confidenceFor({ destination, demand: input.demand, decision });
  const action = actionFor(score, confidence);
  const reasons: string[] = [];

  if (demand >= 75) reasons.push("Strong demand signal relative to the current radar portfolio.");
  if (velvetFit >= 85) reasons.push("Very strong fit with the Velvet discovery promise.");
  if (destinationWeakness >= 70) reasons.push("Observed results leave a meaningful content-quality or specificity gap.");
  if (specialistTravelVisibilityShare < 25 && (destination?.resultCount ?? 0) >= 6) reasons.push("Specialist travel publishers do not dominate the observed result set.");
  if (commercialVisibilityShare < 15 && (destination?.resultCount ?? 0) >= 6) reasons.push("Tour and marketplace saturation is low in the observed destinations.");
  if (genericVisibilityShare >= 30) reasons.push("A large share of visibility is held by generic rather than intent-specific destinations.");
  if (confidence === "LOW") reasons.push("Evidence is still thin; validate before scaling production.");
  if (input.demand?.status === "UNKNOWN") reasons.push("Absolute search volume is still unknown, so the score uses relative radar demand rather than invented volume.");

  const nextStep = action === "BUILD_IMMEDIATELY"
    ? "Create the highest-intent Answer Page and route it to the best-fit Velvet product now."
    : action === "BUILD_NEXT"
      ? "Queue this theme in the next Answer Page production batch."
      : action === "TEST_FIRST"
        ? "Validate with one focused Answer Page or another independent signal before scaling."
        : action === "MONITOR"
          ? "Keep collecting demand and destination evidence before committing production capacity."
          : "Do not allocate acquisition production capacity yet.";

  return {
    theme: decision.theme,
    gapScore: score,
    confidence,
    action,
    components: {
      demandStrength: demand,
      velvetFit,
      intentStrength,
      destinationWeakness,
      lowCommercialSaturation,
      serpEvidence: clamp(relevantEvidence),
    },
    evidence: {
      destinationStatus: destination?.status ?? "UNKNOWN",
      queryCount: destination?.queryCount ?? 0,
      resultCount: destination?.resultCount ?? 0,
      topCompetitors: (destination?.topDomains ?? []).slice(0, 5).map((item) => ({
        domain: item.domain,
        resultType: item.resultType,
        visibilityShare: item.visibilityShare,
      })),
      commercialVisibilityShare,
      specialistTravelVisibilityShare,
      genericVisibilityShare,
      searchVolumeStatus: input.demand?.status ?? "UNKNOWN",
      monthlySearches: input.demand?.monthlySearches,
    },
    reasons,
    nextStep,
  };
}

export function buildOpportunityGapPortfolio(input: Array<{
  decision: VelvetDecision;
  destination?: DestinationThemeCapture;
  demand?: SearchDemandMetric;
}>) {
  return input
    .map(buildOpportunityGapScore)
    .sort((a, b) => b.gapScore - a.gapScore || b.components.serpEvidence - a.components.serpEvidence);
}
