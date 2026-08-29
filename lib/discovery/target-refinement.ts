import type { BehaviorPrediction } from "./behavior-prediction";
import type { PrecisionTarget, TargetState } from "./precision-targeting";

export type RefinedPrecisionTarget = PrecisionTarget & {
  baseState: TargetState;
  baseTargetScore: number;
  behaviorAdjustment: number;
  behaviorStatus: BehaviorPrediction["status"] | "MISSING";
  predictedBehavior: BehaviorPrediction["predictedBehavior"] | "UNKNOWN";
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function refinePrecisionTargets(
  targets: PrecisionTarget[],
  predictions: BehaviorPrediction[],
): RefinedPrecisionTarget[] {
  return targets.map((target) => {
    const prediction = predictions.find((item) => item.theme === target.theme);
    const reasons = [...target.reasons];
    let adjustment = 0;

    if (!prediction || prediction.status !== "MEASURED" || prediction.confidence === "NONE") {
      reasons.push("Behavior prediction is not measured strongly enough to alter targeting.");
    } else if (prediction.predictedBehavior === "PURCHASE_LIKELY" && prediction.confidence !== "LOW") {
      adjustment += 10;
      reasons.push("Measured cohort behavior shows strong purchase propensity, increasing target priority.");
    } else if (prediction.predictedBehavior === "PRODUCT_INTEREST") {
      adjustment += 6;
      reasons.push("Measured cohort behavior shows product interest, increasing target priority moderately.");
    } else if (prediction.predictedBehavior === "EXPLORATION") {
      adjustment += 1;
      reasons.push("Measured cohort behavior is exploratory; targeting remains mainly evidence-led.");
    } else if (prediction.predictedBehavior === "LOW_INTENT" && prediction.confidence !== "LOW") {
      adjustment -= 10;
      reasons.push("Measured cohort behavior shows low intent, reducing target priority.");
    }

    const targetScore = clamp(target.targetScore + adjustment);
    let state: TargetState = target.state;
    let resourceDirective: PrecisionTarget["resourceDirective"] = target.resourceDirective;

    if (targetScore >= 78 && target.confidence !== "LOW" && prediction?.predictedBehavior !== "LOW_INTENT") {
      state = "LOCK";
      resourceDirective = "CONCENTRATE";
    } else if (targetScore >= 55) {
      state = "TRACK";
      resourceDirective = "MAINTAIN";
    } else if (targetScore >= 38) {
      state = "RETEST";
      resourceDirective = "LIMIT";
    } else {
      state = "IGNORE";
      resourceDirective = "NONE";
    }

    if (prediction?.status !== "MEASURED" && state === "LOCK" && target.state !== "LOCK") {
      state = "TRACK";
      resourceDirective = "MAINTAIN";
      reasons.push("A new LOCK cannot be created from unmeasured behavior evidence.");
    }

    return {
      ...target,
      baseState: target.state,
      baseTargetScore: target.targetScore,
      targetScore,
      state,
      resourceDirective,
      behaviorAdjustment: adjustment,
      behaviorStatus: prediction?.status ?? "MISSING",
      predictedBehavior: prediction?.predictedBehavior ?? "UNKNOWN",
      reasons,
    };
  });
}
