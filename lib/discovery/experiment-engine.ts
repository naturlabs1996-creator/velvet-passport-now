import type { ResourceAllocation } from "./resource-allocator";
import type { RefinedPrecisionTarget } from "./target-refinement";

export type ExperimentVariable = "TITLE" | "ANGLE" | "CTA" | "FORMAT";
export type ExperimentStatus = "PLANNED" | "RUNNING" | "WINNER" | "NO_WINNER" | "INSUFFICIENT" | "STOPPED";

export type ExperimentVariant = {
  id: string;
  label: string;
  impressions?: number;
  clicks?: number;
  engaged?: number;
  conversions?: number;
  revenue?: number;
};

export type PredatorExperiment = {
  id: string;
  theme: string;
  channel: string;
  variable: ExperimentVariable;
  status: ExperimentStatus;
  variants: ExperimentVariant[];
  winnerId?: string;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  reasons: string[];
  safeguards: string[];
};

function rate(numerator?: number, denominator?: number) {
  if (typeof numerator !== "number" || typeof denominator !== "number" || denominator <= 0) return undefined;
  return numerator / denominator;
}

function scoreVariant(variant: ExperimentVariant) {
  const ctr = rate(variant.clicks, variant.impressions);
  const conversionRate = rate(variant.conversions, variant.clicks);
  const revenuePerImpression = rate(variant.revenue, variant.impressions);

  let score = 0;
  let weight = 0;
  if (typeof ctr === "number") {
    score += Math.min(1, ctr / 0.08) * 0.25;
    weight += 0.25;
  }
  if (typeof conversionRate === "number") {
    score += Math.min(1, conversionRate / 0.12) * 0.5;
    weight += 0.5;
  }
  if (typeof revenuePerImpression === "number") {
    score += Math.min(1, revenuePerImpression / 0.5) * 0.25;
    weight += 0.25;
  }
  return weight ? score / weight : undefined;
}

function confidence(totalImpressions: number, totalConversions: number) {
  if (totalImpressions >= 5000 || totalConversions >= 50) return "HIGH" as const;
  if (totalImpressions >= 1500 || totalConversions >= 20) return "MEDIUM" as const;
  if (totalImpressions >= 400 || totalConversions >= 5) return "LOW" as const;
  return "NONE" as const;
}

export function evaluateExperiment(experiment: PredatorExperiment): PredatorExperiment {
  if (experiment.variants.length < 2) {
    return { ...experiment, status: "INSUFFICIENT", confidence: "NONE", reasons: ["At least two controlled variants are required."] };
  }

  const totalImpressions = experiment.variants.reduce((sum, variant) => sum + (variant.impressions ?? 0), 0);
  const totalConversions = experiment.variants.reduce((sum, variant) => sum + (variant.conversions ?? 0), 0);
  const conf = confidence(totalImpressions, totalConversions);

  if (totalImpressions < 400 && totalConversions < 5) {
    return {
      ...experiment,
      status: "INSUFFICIENT",
      confidence: conf,
      winnerId: undefined,
      reasons: ["Sample is below the minimum evidence threshold; no winner may be declared."],
    };
  }

  const ranked = experiment.variants
    .map((variant) => ({ variant, score: scoreVariant(variant) }))
    .filter((row): row is { variant: ExperimentVariant; score: number } => typeof row.score === "number")
    .sort((a, b) => b.score - a.score);

  if (ranked.length < 2) {
    return {
      ...experiment,
      status: "INSUFFICIENT",
      confidence: conf,
      winnerId: undefined,
      reasons: ["Not enough comparable outcome data exists across variants."],
    };
  }

  const margin = ranked[0].score - ranked[1].score;
  if (conf === "NONE" || (conf === "LOW" && margin < 0.15) || (conf === "MEDIUM" && margin < 0.08) || (conf === "HIGH" && margin < 0.04)) {
    return {
      ...experiment,
      status: "NO_WINNER",
      confidence: conf,
      winnerId: undefined,
      reasons: ["The observed performance difference is not strong enough to declare a reliable winner."],
    };
  }

  return {
    ...experiment,
    status: "WINNER",
    confidence: conf,
    winnerId: ranked[0].variant.id,
    reasons: ["Winner is supported by a minimum sample and a material measured performance margin."],
  };
}

export function buildExperimentPlan(
  targets: RefinedPrecisionTarget[],
  allocations: ResourceAllocation[],
): PredatorExperiment[] {
  const experiments: PredatorExperiment[] = [];

  for (const target of targets) {
    const allocation = allocations.find((item) => item.theme === target.theme);
    if (!allocation || allocation.directive === "STOP") continue;

    for (const channel of allocation.channels) {
      if (channel.status === "OFF" || channel.status === "HOLD") continue;

      const variables: ExperimentVariable[] = allocation.directive === "CONCENTRATE"
        ? ["TITLE", "ANGLE", "CTA", "FORMAT"]
        : allocation.directive === "MAINTAIN"
          ? ["TITLE", "CTA"]
          : ["ANGLE"];

      for (const variable of variables) {
        experiments.push({
          id: `${target.theme}:${channel.channel}:${variable}`,
          theme: target.theme,
          channel: channel.channel,
          variable,
          status: "PLANNED",
          variants: [
            { id: "A", label: "control" },
            { id: "B", label: "challenger" },
          ],
          confidence: "NONE",
          reasons: ["Experiment plan is derived from current resource allocation and tests one primary variable at a time."],
          safeguards: [
            "No winner is declared without a minimum sample and material performance margin.",
            "Experiments should change one primary variable at a time whenever feasible.",
            "Variant performance uses measured outcomes only; missing data is never imputed.",
            "Experiment results cannot override factual verification, privacy, consent or publication gates.",
          ],
        });
      }
    }
  }

  return experiments;
}
