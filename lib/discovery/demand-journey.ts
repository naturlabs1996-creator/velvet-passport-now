import type { VelvetDecision } from "./decision-engine";

export type EvidenceStatus = "MEASURED" | "ESTIMATED" | "UNKNOWN";

export type SearchDemandMetric = {
  theme: string;
  monthlySearches?: number;
  lowRange?: number;
  highRange?: number;
  trendIndex?: number;
  geography?: string;
  language?: string;
  source?: string;
  status: EvidenceStatus;
  measuredAt?: string;
};

export type DestinationShare = {
  domain: string;
  resultType: "EDITORIAL" | "FORUM" | "MARKETPLACE" | "TOUR" | "MAP" | "VIDEO" | "OTHER";
  visibilityShare?: number;
  clickShare?: number;
  status: EvidenceStatus;
  source?: string;
};

export type VelvetJourneyMetric = {
  theme: string;
  impressions?: number;
  organicClicks?: number;
  visits?: number;
  answerEngaged?: number;
  guideCtaClicks?: number;
  miniGuideClicks?: number;
  storeRouterOpens?: number;
  storeSelections?: number;
  nowInterest?: number;
  status: EvidenceStatus;
  source?: string;
  periodStart?: string;
  periodEnd?: string;
};

export type ThemeJourney = {
  theme: string;
  decision?: VelvetDecision;
  demand: SearchDemandMetric;
  destinations: DestinationShare[];
  velvetJourney: VelvetJourneyMetric;
  gaps: string[];
  readiness: "ACTIONABLE" | "PARTIAL" | "INSUFFICIENT";
};

export function buildThemeJourney(input: {
  theme: string;
  decision?: VelvetDecision;
  demand?: Partial<SearchDemandMetric>;
  destinations?: DestinationShare[];
  velvetJourney?: Partial<VelvetJourneyMetric>;
}): ThemeJourney {
  const demand: SearchDemandMetric = {
    theme: input.theme,
    status: input.demand?.status ?? "UNKNOWN",
    ...input.demand,
  };

  const destinations = input.destinations ?? [];
  const velvetJourney: VelvetJourneyMetric = {
    theme: input.theme,
    status: input.velvetJourney?.status ?? "UNKNOWN",
    ...input.velvetJourney,
  };

  const gaps: string[] = [];
  if (demand.status === "UNKNOWN") gaps.push("SEARCH_VOLUME");
  if (!destinations.length || destinations.every((item) => item.status === "UNKNOWN")) gaps.push("DESTINATION_CAPTURE");
  if (velvetJourney.status === "UNKNOWN") gaps.push("FIRST_PARTY_JOURNEY");

  const measuredLayers = [
    demand.status === "MEASURED",
    destinations.some((item) => item.status === "MEASURED"),
    velvetJourney.status === "MEASURED",
  ].filter(Boolean).length;

  const readiness = measuredLayers >= 2
    ? "ACTIONABLE"
    : measuredLayers === 1 || gaps.length < 3
      ? "PARTIAL"
      : "INSUFFICIENT";

  return {
    theme: input.theme,
    decision: input.decision,
    demand,
    destinations,
    velvetJourney,
    gaps,
    readiness,
  };
}

export function buildJourneyPortfolio(decisions: VelvetDecision[]) {
  return decisions.map((decision) => buildThemeJourney({
    theme: decision.theme,
    decision,
  }));
}
