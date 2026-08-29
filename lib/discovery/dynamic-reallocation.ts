import type { AdaptiveTargetBudget, AdaptiveBudgetTier } from "./adaptive-budget";
import type { RefinedPrecisionTarget } from "./target-refinement";
import type { BehaviorPrediction } from "./behavior-prediction";

export type ReallocationDirective = "RECEIVE" | "HOLD" | "RELEASE" | "NONE";

export type DynamicReallocation = {
  theme: string;
  directive: ReallocationDirective;
  baseTier: AdaptiveBudgetTier;
  effectiveTier: AdaptiveBudgetTier;
  releasedUnits: number;
  receivedUnits: number;
  finalUnits: number;
  reasons: string[];
  safeguards: string[];
};

const tierUnits: Record<AdaptiveBudgetTier, number> = {
  SUPERCHARGE: 100,
  BOOST: 70,
  CONTROLLED: 35,
  MINIMAL: 10,
};

function tierFromUnits(units: number): AdaptiveBudgetTier {
  if (units >= 85) return "SUPERCHARGE";
  if (units >= 55) return "BOOST";
  if (units >= 20) return "CONTROLLED";
  return "MINIMAL";
}

function eligibilityScore(target: RefinedPrecisionTarget | undefined, prediction: BehaviorPrediction | undefined) {
  if (!target || target.state === "IGNORE") return -1;
  let score = target.targetScore;
  if (target.state === "LOCK") score += 20;
  else if (target.state === "TRACK") score += 8;
  else if (target.state === "RETEST") score -= 8;

  if (prediction?.status === "MEASURED") {
    if (prediction.predictedBehavior === "PURCHASE_LIKELY") score += 15;
    else if (prediction.predictedBehavior === "PRODUCT_INTEREST") score += 8;
    else if (prediction.predictedBehavior === "LOW_INTENT") score -= 15;
    if (prediction.confidence === "HIGH") score += 6;
    if (prediction.confidence === "LOW") score -= 4;
  }
  return score;
}

export function buildDynamicReallocation(
  budgets: AdaptiveTargetBudget[],
  targets: RefinedPrecisionTarget[],
  predictions: BehaviorPrediction[],
): DynamicReallocation[] {
  const rows = budgets.map((budget) => {
    const target = targets.find((item) => item.theme === budget.theme);
    const prediction = predictions.find((item) => item.theme === budget.theme);
    const baseUnits = tierUnits[budget.tier];
    const reasons: string[] = [];

    let retainedFloor = baseUnits;
    if (!target || target.state === "IGNORE") retainedFloor = Math.min(baseUnits, 5);
    else if (target.state === "RETEST") retainedFloor = Math.min(baseUnits, 20);
    else if (prediction?.status === "MEASURED" && prediction.predictedBehavior === "LOW_INTENT" && prediction.confidence !== "LOW") retainedFloor = Math.min(baseUnits, 25);

    const releasedUnits = Math.max(0, baseUnits - retainedFloor);
    if (releasedUnits > 0) reasons.push(`Released ${releasedUnits} capacity units because the target no longer justifies its full base tier.`);

    return {
      budget,
      target,
      prediction,
      baseUnits,
      retainedFloor,
      releasedUnits,
      score: eligibilityScore(target, prediction),
      reasons,
    };
  });

  const pool = rows.reduce((sum, row) => sum + row.releasedUnits, 0);
  const receivers = rows
    .filter((row) => row.score >= 0 && row.target?.state !== "RETEST" && row.target?.state !== "IGNORE")
    .sort((a, b) => b.score - a.score);

  let remaining = pool;
  const received = new Map<string, number>();
  for (const row of receivers) {
    if (remaining <= 0) break;
    const cap = row.target?.state === "LOCK" ? 35 : 18;
    const headroom = Math.max(0, 120 - row.retainedFloor);
    const grant = Math.min(remaining, cap, headroom);
    if (grant <= 0) continue;
    received.set(row.budget.theme, grant);
    remaining -= grant;
  }

  return rows.map((row) => {
    const receivedUnits = received.get(row.budget.theme) ?? 0;
    const finalUnits = row.retainedFloor + receivedUnits;
    const reasons = [...row.reasons];
    let directive: ReallocationDirective = "HOLD";

    if (row.releasedUnits > 0 && receivedUnits === 0) directive = "RELEASE";
    if (receivedUnits > 0) {
      directive = "RECEIVE";
      reasons.push(`Received ${receivedUnits} capacity units from the shared pool because this target ranks among the strongest eligible opportunities.`);
    }
    if (row.releasedUnits === 0 && receivedUnits === 0) reasons.push("Target keeps its current allocation; no reallocation is justified.");

    return {
      theme: row.budget.theme,
      directive,
      baseTier: row.budget.tier,
      effectiveTier: tierFromUnits(finalUnits),
      releasedUnits: row.releasedUnits,
      receivedUnits,
      finalUnits,
      reasons,
      safeguards: [
        "Reallocation moves only unused planning capacity; it never changes claim truth, evidence quality or publication status.",
        "IGNORE and RETEST targets cannot absorb released capacity before stronger LOCK or TRACK targets.",
        "Per-target receive caps prevent one target from monopolizing all available capacity.",
        "Paid media spend is never created, moved or authorized by this engine.",
      ],
    };
  });
}
