import type { FirstPartyPerformance, LearningScore } from "./learning-feedback";
import { buildBehaviorPredictionPortfolio } from "./behavior-prediction";
import { buildPerformanceMemory, type PerformanceSnapshot } from "./performance-memory";
import { buildPrecisionTargets } from "./precision-targeting";
import { refinePrecisionTargets } from "./target-refinement";
import { allocateResources } from "./resource-allocator";
import { buildExperimentPlan } from "./experiment-engine";
import { buildCreativeStrikes } from "./creative-strike-engine";
import { buildSpeedPlans } from "./speed-controller";
import { buildAdaptiveTargetBudgets } from "./adaptive-budget";
import type { SafeDiscoveryCopy } from "./safe-copy-composer";
import type { OpportunityGapScore } from "./opportunity-gap";

export type PredatorCoreInput = {
  opportunityGaps: OpportunityGapScore[];
  learning: LearningScore[];
  performanceRows: FirstPartyPerformance[];
  performanceHistory: PerformanceSnapshot[];
  safeCopyByTheme?: Record<string, SafeDiscoveryCopy[]>;
};

export function runPredatorCore(input: PredatorCoreInput) {
  const memory = buildPerformanceMemory(input.performanceHistory);
  const precisionTargets = buildPrecisionTargets(input.opportunityGaps, input.learning, memory);
  const behaviorPrediction = buildBehaviorPredictionPortfolio(input.performanceRows, memory, precisionTargets);
  const refinedTargets = refinePrecisionTargets(precisionTargets, behaviorPrediction);
  const speedPlans = buildSpeedPlans(refinedTargets);
  const adaptiveBudgets = buildAdaptiveTargetBudgets(input.opportunityGaps);
  const resourceAllocation = allocateResources(refinedTargets, behaviorPrediction);
  const experimentPlan = buildExperimentPlan(refinedTargets, resourceAllocation);
  const creativeStrikes = buildCreativeStrikes({
    targets: refinedTargets,
    predictions: behaviorPrediction,
    allocations: resourceAllocation,
    experiments: experimentPlan,
    safeCopyByTheme: input.safeCopyByTheme,
  });

  return {
    architecture: [
      "PERFORMANCE_MEMORY",
      "PRECISION_TARGETING",
      "BEHAVIOR_PREDICTION",
      "TARGET_REFINEMENT",
      "SPEED_CONTROLLER",
      "SMART_CACHE_POLICY",
      "ADAPTIVE_TARGET_BUDGETS",
      "RESOURCE_ALLOCATION",
      "EXPERIMENT_ENGINE",
      "CREATIVE_STRIKE_ENGINE",
    ],
    memory,
    precisionTargets,
    behaviorPrediction,
    refinedTargets,
    speedPlans,
    adaptiveBudgets,
    resourceAllocation,
    experimentPlan,
    creativeStrikes,
    summary: {
      memoryRows: memory.length,
      lockedTargets: refinedTargets.filter((item) => item.state === "LOCK").length,
      trackedTargets: refinedTargets.filter((item) => item.state === "TRACK").length,
      retestTargets: refinedTargets.filter((item) => item.state === "RETEST").length,
      ignoredTargets: refinedTargets.filter((item) => item.state === "IGNORE").length,
      measuredPredictions: behaviorPrediction.filter((item) => item.status === "MEASURED").length,
      purchaseLikely: behaviorPrediction.filter((item) => item.predictedBehavior === "PURCHASE_LIKELY").length,
      deepVerifyTargets: speedPlans.filter((item) => item.mode === "DEEP_VERIFY").length,
      focusedVerifyTargets: speedPlans.filter((item) => item.mode === "FOCUSED_VERIFY").length,
      fastScanTargets: speedPlans.filter((item) => item.mode === "FAST_SCAN").length,
      earlyStoppedTargets: speedPlans.filter((item) => item.decision === "STOP").length,
      superchargedTargets: adaptiveBudgets.filter((item) => item.tier === "SUPERCHARGE").length,
      boostedTargets: adaptiveBudgets.filter((item) => item.tier === "BOOST").length,
      controlledTargets: adaptiveBudgets.filter((item) => item.tier === "CONTROLLED").length,
      minimalTargets: adaptiveBudgets.filter((item) => item.tier === "MINIMAL").length,
      concentratedAllocations: resourceAllocation.filter((item) => item.directive === "CONCENTRATE").length,
      stoppedAllocations: resourceAllocation.filter((item) => item.directive === "STOP").length,
      plannedExperiments: experimentPlan.length,
      strikesReadyToTest: creativeStrikes.filter((item) => item.status === "READY_TO_TEST").length,
      strikesHeldNoLock: creativeStrikes.filter((item) => item.status === "HOLD_NO_LOCK").length,
      strikesHeldLowConfidence: creativeStrikes.filter((item) => item.status === "HOLD_LOW_CONFIDENCE").length,
      strikesHeldCopyEvidence: creativeStrikes.filter((item) => item.status === "HOLD_COPY_EVIDENCE").length,
      paidStrikesHeld: creativeStrikes.filter((item) => item.status === "HOLD_PAID").length,
    },
    safeguards: [
      "Missing first-party data remains unknown and cannot be manufactured into a behavior signal.",
      "A prediction is an aggregate cohort probability, never a statement about an identified person.",
      "Speed controls can stop or defer work but never bypass factual verification or publication gates.",
      "Smart cache reuse is freshness-sensitive; stale research cannot become publication evidence.",
      "Adaptive budgets increase collection capacity only; they never promote a claim to verified status.",
      "Resource allocation cannot activate paid spend.",
      "Experiment winners require minimum samples and material measured performance margins.",
      "Creative strikes require target lock, measured behavior confidence and verified Safe Copy before factual body copy can be used.",
      "Paid strikes remain held until a separate spend gate and explicit authorization exist.",
      "No targeting, allocation, experiment or strike decision overrides factual, publication, privacy or consent gates.",
    ],
  };
}
