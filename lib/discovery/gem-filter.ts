import type { OpportunityGapScore } from "./opportunity-gap";

export type GemClass = "PRIORITY_GEM" | "TEST" | "CURIOSITY" | "COMMODITY" | "HOLD_UNKNOWN_VOLUME";

export type GemScore = {
  theme: string;
  classification: GemClass;
  total: number;
  relevance: number;
  rarity: number;
  demand: number;
  commercialPotential: number;
  demandStatus: string;
  monthlySearches?: number;
  reasons: string[];
};

const MIN_PRIORITY_MONTHLY_SEARCHES = 100;

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function rarityScore(gap: OpportunityGapScore) {
  // Rarity here means opportunity scarcity: weak/specific destination coverage plus low commercial saturation.
  // It is not a claim that the underlying place is objectively rare.
  return clamp(gap.components.destinationWeakness * 0.6 + gap.components.lowCommercialSaturation * 0.4);
}

function commercialPotentialScore(gap: OpportunityGapScore) {
  return clamp(
    gap.components.intentStrength * 0.55 +
    gap.components.demandStrength * 0.25 +
    gap.components.lowCommercialSaturation * 0.2,
  );
}

export function scoreGemOpportunity(gap: OpportunityGapScore): GemScore {
  const relevance = clamp(gap.components.velvetFit * 0.55 + gap.components.intentStrength * 0.45);
  const rarity = rarityScore(gap);
  const demand = clamp(gap.components.demandStrength);
  const commercialPotential = commercialPotentialScore(gap);
  const total = clamp(
    relevance * 0.3 +
    rarity * 0.25 +
    demand * 0.25 +
    commercialPotential * 0.2,
  );

  const volumeMeasured = gap.evidence.searchVolumeStatus === "MEASURED" && typeof gap.evidence.monthlySearches === "number";
  const enoughMeasuredVolume = volumeMeasured && (gap.evidence.monthlySearches ?? 0) >= MIN_PRIORITY_MONTHLY_SEARCHES;
  const reasons: string[] = [];

  let classification: GemClass;

  if (relevance >= 70 && rarity >= 60 && commercialPotential >= 60 && enoughMeasuredVolume && total >= 68) {
    classification = "PRIORITY_GEM";
    reasons.push(`Measured search volume clears the ${MIN_PRIORITY_MONTHLY_SEARCHES}/month priority floor.`);
    reasons.push("High Velvet relevance, opportunity scarcity and commercial potential converge.");
  } else if (relevance >= 65 && rarity >= 55 && demand >= 55 && commercialPotential >= 55) {
    classification = volumeMeasured ? "TEST" : "HOLD_UNKNOWN_VOLUME";
    reasons.push(volumeMeasured
      ? "Promising signal merits controlled validation before priority treatment."
      : "Signal is promising, but absolute volume is unknown; priority status is blocked until volume is measured.");
  } else if (relevance >= 70 && rarity >= 65 && demand < 45) {
    classification = "CURIOSITY";
    reasons.push("The opportunity is distinctive and Velvet-relevant, but current demand is too weak for priority allocation.");
  } else if (demand >= 70 && rarity < 45) {
    classification = "COMMODITY";
    reasons.push("Demand is strong but differentiation is weak; treat as a broad-market opportunity rather than a Velvet gem.");
  } else {
    classification = volumeMeasured ? "TEST" : "HOLD_UNKNOWN_VOLUME";
    reasons.push(volumeMeasured
      ? "Evidence is mixed; keep the theme in controlled testing."
      : "Absolute volume is unknown, so the theme cannot graduate to priority status.");
  }

  return {
    theme: gap.theme,
    classification,
    total,
    relevance,
    rarity,
    demand,
    commercialPotential,
    demandStatus: gap.evidence.searchVolumeStatus,
    monthlySearches: gap.evidence.monthlySearches,
    reasons,
  };
}

export function buildGemPortfolio(gaps: OpportunityGapScore[]) {
  return gaps
    .map(scoreGemOpportunity)
    .sort((a, b) => {
      const rank: Record<GemClass, number> = {
        PRIORITY_GEM: 5,
        TEST: 4,
        HOLD_UNKNOWN_VOLUME: 3,
        CURIOSITY: 2,
        COMMODITY: 1,
      };
      return rank[b.classification] - rank[a.classification] || b.total - a.total;
    });
}

export const GEM_FILTER_RULES = {
  formula: "30% relevance + 25% rarity/opportunity scarcity + 25% demand + 20% commercial potential",
  priorityMonthlySearchFloor: MIN_PRIORITY_MONTHLY_SEARCHES,
  safeguards: [
    "Unknown absolute search volume can never create PRIORITY_GEM status.",
    "Rarity score describes opportunity scarcity in observed search destinations, not an unsupported claim that a place is rare.",
    "Gem status prioritizes research capacity only and cannot bypass factual verification, Safe Copy or publication gates.",
  ],
};
