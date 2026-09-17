import type { BehaviorPrediction } from "./behavior-prediction";
import type { RefinedPrecisionTarget } from "./target-refinement";

export type AllocationDirective = "CONCENTRATE" | "MAINTAIN" | "LIMIT" | "STOP";
export type AllocationChannel = "SEO" | "PINTEREST" | "REDDIT" | "STORE_SEARCH" | "VELVET_INTERNAL" | "PAID";

export type ResourceAllocation = {
  theme: string;
  directive: AllocationDirective;
  priorityScore: number;
  channels: Array<{
    channel: AllocationChannel;
    status: "ACTIVE" | "TEST" | "HOLD" | "OFF";
    share: number;
    reason: string;
  }>;
  reasons: string[];
  safeguards: string[];
};

function normalizeShares(entries: Array<{ channel: AllocationChannel; weight: number; status: "ACTIVE" | "TEST" | "HOLD" | "OFF"; reason: string }>) {
  const activeWeight = entries.reduce((sum, entry) => sum + ((entry.status === "ACTIVE" || entry.status === "TEST") ? entry.weight : 0), 0);
  return entries.map((entry) => ({
    channel: entry.channel,
    status: entry.status,
    share: activeWeight > 0 && (entry.status === "ACTIVE" || entry.status === "TEST") ? Math.round((entry.weight / activeWeight) * 100) : 0,
    reason: entry.reason,
  }));
}

export function allocateResources(
  targets: RefinedPrecisionTarget[],
  predictions: BehaviorPrediction[],
): ResourceAllocation[] {
  return targets.map((target) => {
    const prediction = predictions.find((item) => item.theme === target.theme);
    const measuredBehavior = prediction?.status === "MEASURED";
    const strongCommercialBehavior = measuredBehavior && (prediction?.predictedBehavior === "PURCHASE_LIKELY" || prediction?.predictedBehavior === "PRODUCT_INTEREST");
    const reasons: string[] = [];

    let directive: AllocationDirective = "MAINTAIN";
    if (target.state === "LOCK") directive = "CONCENTRATE";
    else if (target.state === "TRACK") directive = "MAINTAIN";
    else if (target.state === "RETEST") directive = "LIMIT";
    else directive = "STOP";

    if (directive === "CONCENTRATE") reasons.push("Precision target is LOCKED after opportunity and behavior refinement.");
    if (directive === "MAINTAIN") reasons.push("Target remains viable but does not justify concentrated resources yet.");
    if (directive === "LIMIT") reasons.push("Only controlled tests should receive resources until stronger evidence appears.");
    if (directive === "STOP") reasons.push("Current combined evidence does not justify additional acquisition resources.");

    const organicStatus = directive === "STOP" ? "OFF" as const : directive === "LIMIT" ? "TEST" as const : "ACTIVE" as const;
    const commercialStatus = directive === "STOP" ? "OFF" as const : strongCommercialBehavior ? "ACTIVE" as const : "TEST" as const;
    const paidStatus = target.state === "LOCK" && prediction?.status === "MEASURED" && prediction.confidence !== "LOW" && prediction.predictedBehavior === "PURCHASE_LIKELY"
      ? "HOLD" as const
      : "HOLD" as const;

    const channels = normalizeShares([
      { channel: "SEO", weight: directive === "CONCENTRATE" ? 30 : 25, status: organicStatus, reason: "Owned organic capture remains a primary low-cost channel." },
      { channel: "PINTEREST", weight: directive === "CONCENTRATE" ? 25 : 20, status: organicStatus, reason: "Visual discovery can test and amplify qualified travel interest." },
      { channel: "REDDIT", weight: 10, status: directive === "STOP" ? "OFF" : "TEST", reason: "Use only compliant, non-spam participation and controlled message testing." },
      { channel: "STORE_SEARCH", weight: strongCommercialBehavior ? 25 : 15, status: commercialStatus, reason: strongCommercialBehavior ? "Measured product intent supports stronger commercial placement." : "Commercial intent remains a hypothesis to test." },
      { channel: "VELVET_INTERNAL", weight: 20, status: directive === "STOP" ? "OFF" : "ACTIVE", reason: "Owned internal routing is measurable and low cost." },
      { channel: "PAID", weight: 0, status: paidStatus, reason: "Paid spend stays HOLD until a separate spend gate and explicit authorization exist." },
    ]);

    return {
      theme: target.theme,
      directive,
      priorityScore: target.targetScore,
      channels,
      reasons,
      safeguards: [
        "Paid spend is never activated by this allocator.",
        "Missing or insufficient behavior data cannot create a new concentration decision by itself.",
        "Allocation cannot override factual verification, publication, privacy or consent gates.",
        "Channel shares are planning weights, not money budgets.",
      ],
    };
  });
}
