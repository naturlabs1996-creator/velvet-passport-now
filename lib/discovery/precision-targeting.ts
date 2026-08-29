import type { LearningScore } from "./learning-feedback";
import type { PerformanceMemory } from "./performance-memory";
import type { OpportunityGapResult } from "./opportunity-gap";

export type TargetState = "LOCK" | "TRACK" | "RETEST" | "IGNORE";

export type PrecisionTarget = {
  theme: string;
  state: TargetState;
  targetScore: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reasons: string[];
  resourceDirective: "CONCENTRATE" | "MAINTAIN" | "LIMIT" | "NONE";
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function buildPrecisionTargets(
  gaps: OpportunityGapResult[],
  learning: LearningScore[],
  memory: PerformanceMemory[],
): PrecisionTarget[] {
  return gaps.map((gap) => {
    const learningScore = learning.find((item) => item.theme === gap.theme);
    const memoryRow = memory.find((item) => item.theme === gap.theme);
    const reasons: string[] = [];

    let score = gap.score * 0.55;
    let confidence: PrecisionTarget["confidence"] = gap.confidence === "HIGH" ? "HIGH" : gap.confidence === "MEDIUM" ? "MEDIUM" : "LOW";

    if (learningScore?.status === "MEASURED" && typeof learningScore.performanceScore === "number") {
      score += learningScore.performanceScore * 0.3;
      reasons.push("Measured first-party performance contributes to target selection.");
    } else {
      score += 12;
      reasons.push("First-party performance is missing or insufficient, so targeting remains conservative.");
    }

    if (memoryRow) {
      if (memoryRow.trajectory === "ACCELERATING") {
        score += 12;
        reasons.push("Performance memory shows acceleration.");
      } else if (memoryRow.trajectory === "EMERGING") {
        score += 7;
        reasons.push("Performance memory shows an emerging positive trajectory.");
      } else if (memoryRow.trajectory === "DECLINING") {
        score -= 15;
        reasons.push("Performance memory shows sustained decline.");
      } else if (memoryRow.trajectory === "SEASONAL_CANDIDATE") {
        score += 3;
        reasons.push("A seasonal pattern may exist; targeting remains hypothesis-driven.");
      }

      if (memoryRow.confidence === "HIGH" && confidence !== "HIGH") confidence = "MEDIUM";
    }

    const targetScore = clamp(score);
    let state: TargetState = "TRACK";
    let resourceDirective: PrecisionTarget["resourceDirective"] = "MAINTAIN";

    if (targetScore >= 78 && confidence !== "LOW" && learningScore?.action !== "DEPRIORITIZE") {
      state = "LOCK";
      resourceDirective = "CONCENTRATE";
      reasons.push("Opportunity, measured performance and trajectory are strong enough for focused resource allocation.");
    } else if (targetScore >= 55) {
      state = "TRACK";
      resourceDirective = "MAINTAIN";
    } else if (targetScore >= 38) {
      state = "RETEST";
      resourceDirective = "LIMIT";
      reasons.push("The theme is not strong enough for concentration but remains worth a controlled retest.");
    } else {
      state = "IGNORE";
      resourceDirective = "NONE";
      reasons.push("Combined evidence is too weak for additional resources now.");
    }

    return {
      theme: gap.theme,
      state,
      targetScore,
      confidence,
      reasons,
      resourceDirective,
    };
  });
}
