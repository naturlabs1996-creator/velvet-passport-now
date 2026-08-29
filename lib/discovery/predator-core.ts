import type { FirstPartyPerformance, LearningScore } from "./learning-feedback";
import { buildBehaviorPredictionPortfolio } from "./behavior-prediction";
import { buildPerformanceMemory, type PerformanceSnapshot } from "./performance-memory";
import { buildPrecisionTargets } from "./precision-targeting";
import { refinePrecisionTargets } from "./target-refinement";
import { allocateResources } from "./resource-allocator";
import type { OpportunityGapScore } from "./opportunity-gap";

export type PredatorCoreInput = {
  opportunityGaps: OpportunityGapScore[];
  learning: LearningScore[];
  performanceRows: FirstPartyPerformance[];
  performanceHistory: PerformanceSnapshot[];
};

export function runPredatorCore(input: PredatorCoreInput) {
  const memory = buildPerformanceMemory(input.performanceHistory);
  const precisionTargets = buildPrecisionTargets(input.opportunityGaps, input.learning, memory);
  const behaviorPrediction = buildBehaviorPredictionPortfolio(input.performanceRows, memory, precisionTargets);
  const refinedTargets = refinePrecisionTargets(precisionTargets, behaviorPrediction);
  const resourceAllocation = allocateResources(refinedTargets, behaviorPrediction);

  return {
    architecture: [
      "PERFORMANCE_MEMORY",
      "PRECISION_TARGETING",
      "BEHAVIOR_PREDICTION",
      "TARGET_REFINEMENT",
      "RESOURCE_ALLOCATION",
    ],
    memory,
    precisionTargets,
    behaviorPrediction,
    refinedTargets,
    resourceAllocation,
    summary: {
      memoryRows: memory.length,
      lockedTargets: refinedTargets.filter((item) => item.state === "LOCK").length,
      trackedTargets: refinedTargets.filter((item) => item.state === "TRACK").length,
      retestTargets: refinedTargets.filter((item) => item.state === "RETEST").length,
      ignoredTargets: refinedTargets.filter((item) => item.state === "IGNORE").length,
      measuredPredictions: behaviorPrediction.filter((item) => item.status === "MEASURED").length,
      purchaseLikely: behaviorPrediction.filter((item) => item.predictedBehavior === "PURCHASE_LIKELY").length,
      concentratedAllocations: resourceAllocation.filter((item) => item.directive === "CONCENTRATE").length,
      stoppedAllocations: resourceAllocation.filter((item) => item.directive === "STOP").length,
    },
    safeguards: [
      "Missing first-party data remains unknown and cannot be manufactured into a behavior signal.",
      "A prediction is an aggregate cohort probability, never a statement about an identified person.",
      "Resource allocation cannot activate paid spend.",
      "No targeting or allocation decision overrides factual, publication, privacy or consent gates.",
    ],
  };
}
