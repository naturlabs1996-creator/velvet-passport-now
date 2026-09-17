import type { FirstPartyPerformance } from "./learning-feedback";
import type { PerformanceMemory } from "./performance-memory";
import type { PrecisionTarget } from "./precision-targeting";

export type PredictionStatus = "MEASURED" | "INSUFFICIENT" | "NO_DATA";
export type PredictedBehavior = "PURCHASE_LIKELY" | "PRODUCT_INTEREST" | "EXPLORATION" | "LOW_INTENT" | "UNKNOWN";

export type BehaviorPrediction = {
  pageId: string;
  theme: string;
  status: PredictionStatus;
  predictedBehavior: PredictedBehavior;
  probability?: number;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  targetState?: PrecisionTarget["state"];
  signals: string[];
  reasons: string[];
  safeguards: string[];
};

function rate(numerator?: number, denominator?: number) {
  if (typeof numerator !== "number" || typeof denominator !== "number" || denominator <= 0) return undefined;
  return numerator / denominator;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function evidenceStatus(row?: FirstPartyPerformance): PredictionStatus {
  if (!row) return "NO_DATA";
  const exposure = Math.max(row.pageViews ?? 0, row.impressions ?? 0);
  if (exposure < 100) return "INSUFFICIENT";
  return "MEASURED";
}

function confidenceFor(row?: FirstPartyPerformance, memory?: PerformanceMemory) {
  if (!row) return "NONE" as const;
  const exposure = Math.max(row.pageViews ?? 0, row.impressions ?? 0);
  const purchases = row.purchases ?? 0;
  if ((exposure >= 2500 || purchases >= 20) && memory?.confidence === "HIGH") return "HIGH" as const;
  if (exposure >= 750 || purchases >= 8 || memory?.confidence === "MEDIUM") return "MEDIUM" as const;
  if (exposure >= 100) return "LOW" as const;
  return "NONE" as const;
}

export function predictBehavior(
  row: FirstPartyPerformance | undefined,
  memory: PerformanceMemory | undefined,
  target: PrecisionTarget | undefined,
): BehaviorPrediction {
  if (!row) {
    return {
      pageId: target?.theme ?? "unknown",
      theme: target?.theme ?? "unknown",
      status: "NO_DATA",
      predictedBehavior: "UNKNOWN",
      confidence: "NONE",
      targetState: target?.state,
      signals: [],
      reasons: ["No measured first-party performance row exists, so behavior prediction is disabled."],
      safeguards: [
        "Predictions describe aggregate cohort probability, not individual certainty.",
        "No sensitive traits, identity attributes or inferred personal characteristics are used.",
        "Prediction cannot override factual verification, publication or consent gates.",
      ],
    };
  }

  const status = evidenceStatus(row);
  const confidence = confidenceFor(row, memory);
  const signals: string[] = [];
  const reasons: string[] = [];
  const ctaRate = rate(row.primaryCtaClicks, row.pageViews);
  const productRate = rate(row.productStarts, row.primaryCtaClicks ?? row.pageViews);
  const purchaseRate = rate(row.purchases, row.productStarts ?? row.primaryCtaClicks);
  const engagementRate = rate(row.engagedSessions, row.pageViews);

  if (status === "INSUFFICIENT") {
    return {
      pageId: row.pageId,
      theme: row.theme,
      status,
      predictedBehavior: "UNKNOWN",
      confidence,
      targetState: target?.state,
      signals,
      reasons: ["The measured sample is too small for a behavior probability."],
      safeguards: [
        "Small samples cannot produce a purchase-likelihood classification.",
        "Predictions describe aggregate cohort probability, not individual certainty.",
      ],
    };
  }

  let score = 0;
  let weight = 0;

  if (typeof engagementRate === "number") {
    score += clamp01(engagementRate / 0.65) * 0.2;
    weight += 0.2;
    signals.push(`engagement:${Math.round(engagementRate * 1000) / 10}%`);
  }
  if (typeof ctaRate === "number") {
    score += clamp01(ctaRate / 0.08) * 0.25;
    weight += 0.25;
    signals.push(`primary_cta:${Math.round(ctaRate * 1000) / 10}%`);
  }
  if (typeof productRate === "number") {
    score += clamp01(productRate / 0.55) * 0.2;
    weight += 0.2;
    signals.push(`product_start:${Math.round(productRate * 1000) / 10}%`);
  }
  if (typeof purchaseRate === "number") {
    score += clamp01(purchaseRate / 0.15) * 0.35;
    weight += 0.35;
    signals.push(`purchase:${Math.round(purchaseRate * 1000) / 10}%`);
  }

  let probability = weight > 0 ? score / weight : 0;
  if (memory?.trajectory === "ACCELERATING") probability += 0.07;
  if (memory?.trajectory === "EMERGING") probability += 0.04;
  if (memory?.trajectory === "DECLINING") probability -= 0.08;
  if (target?.state === "LOCK") probability += 0.03;
  probability = clamp01(probability);

  let predictedBehavior: PredictedBehavior = "LOW_INTENT";
  if (probability >= 0.72 && confidence !== "LOW") predictedBehavior = "PURCHASE_LIKELY";
  else if (probability >= 0.5) predictedBehavior = "PRODUCT_INTEREST";
  else if (probability >= 0.28) predictedBehavior = "EXPLORATION";

  reasons.push("Probability is computed from aggregate first-party engagement, CTA, product-start and purchase behavior.");
  if (memory && memory.trajectory !== "INSUFFICIENT_HISTORY") reasons.push(`Historical trajectory contributes as ${memory.trajectory}.`);
  if (target) reasons.push(`Precision Targeting currently classifies the theme as ${target.state}.`);

  return {
    pageId: row.pageId,
    theme: row.theme,
    status,
    predictedBehavior,
    probability: Math.round(probability * 1000) / 1000,
    confidence,
    targetState: target?.state,
    signals,
    reasons,
    safeguards: [
      "Predictions are aggregate cohort probabilities and never claims about an identified person.",
      "No sensitive traits, identity attributes or inferred personal characteristics are used.",
      "Prediction may reprioritize experiments or messaging only after minimum sample thresholds are met.",
      "Prediction cannot override factual verification, publication, privacy or consent gates.",
    ],
  };
}

export function buildBehaviorPredictionPortfolio(
  rows: FirstPartyPerformance[],
  memory: PerformanceMemory[],
  targets: PrecisionTarget[],
): BehaviorPrediction[] {
  const themes = new Set([
    ...rows.map((row) => row.theme),
    ...memory.map((row) => row.theme),
    ...targets.map((row) => row.theme),
  ]);

  return [...themes].map((theme) => {
    const row = rows.find((item) => item.theme === theme);
    const memoryRow = memory.find((item) => item.theme === theme);
    const target = targets.find((item) => item.theme === theme);
    return predictBehavior(row, memoryRow, target);
  });
}
