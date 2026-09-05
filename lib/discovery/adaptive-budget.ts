import type { OpportunityGapScore } from "./opportunity-gap";
import type { ResearchCollectorBudget } from "./research-collectors";

export type AdaptiveBudgetTier = "SUPERCHARGE" | "BOOST" | "CONTROLLED" | "MINIMAL";

export type AdaptiveTargetBudget = {
  theme: string;
  tier: AdaptiveBudgetTier;
  priorityScore: number;
  research: ResearchCollectorBudget;
  destination: {
    maxKeywordsPerTheme: number;
    maxQueries: number;
  };
  radar: {
    maxQueriesPerSource: number;
    maxSources: number;
  };
  reasons: string[];
  safeguards: string[];
};

function tierFor(gap: OpportunityGapScore): AdaptiveBudgetTier {
  if (gap.action === "BUILD_IMMEDIATELY" && gap.confidence !== "LOW") return "SUPERCHARGE";
  if (gap.action === "BUILD_NEXT") return "BOOST";
  if (gap.action === "TEST_FIRST") return "CONTROLLED";
  return "MINIMAL";
}

function budgetsFor(tier: AdaptiveBudgetTier) {
  if (tier === "SUPERCHARGE") {
    return {
      research: { maxPackets: 5, maxCollectorsPerPacket: 4, maxLeadsPerCollector: 12, concurrency: 4 },
      destination: { maxKeywordsPerTheme: 5, maxQueries: 40 },
      radar: { maxQueriesPerSource: 12, maxSources: 9 },
    };
  }
  if (tier === "BOOST") {
    return {
      research: { maxPackets: 4, maxCollectorsPerPacket: 4, maxLeadsPerCollector: 10, concurrency: 3 },
      destination: { maxKeywordsPerTheme: 4, maxQueries: 28 },
      radar: { maxQueriesPerSource: 9, maxSources: 8 },
    };
  }
  if (tier === "CONTROLLED") {
    return {
      research: { maxPackets: 2, maxCollectorsPerPacket: 3, maxLeadsPerCollector: 6, concurrency: 2 },
      destination: { maxKeywordsPerTheme: 2, maxQueries: 14 },
      radar: { maxQueriesPerSource: 5, maxSources: 6 },
    };
  }
  return {
    research: { maxPackets: 1, maxCollectorsPerPacket: 2, maxLeadsPerCollector: 3, concurrency: 1 },
    destination: { maxKeywordsPerTheme: 1, maxQueries: 6 },
    radar: { maxQueriesPerSource: 2, maxSources: 4 },
  };
}

export function buildAdaptiveTargetBudgets(gaps: OpportunityGapScore[]): AdaptiveTargetBudget[] {
  return [...gaps]
    .sort((a, b) => b.gapScore - a.gapScore)
    .map((gap) => {
      const tier = tierFor(gap);
      const budgets = budgetsFor(tier);
      const reasons = [
        `${gap.action} with ${gap.confidence} confidence maps to ${tier} execution tier.`,
        "Higher-confidence opportunity receives more parallel verification and more evidence capacity.",
      ];
      if (tier === "MINIMAL") reasons.push("Weak or monitor-only opportunity receives only enough budget to detect a meaningful change.");
      return {
        theme: gap.theme,
        tier,
        priorityScore: gap.gapScore,
        ...budgets,
        reasons,
        safeguards: [
          "Adaptive budgets increase evidence-gathering capacity, never the truth status of a claim.",
          "No tier bypasses claim verification, freshness, conflict, Safe Copy or publish gates.",
          "Budgets are ceilings and may stop early when enough useful evidence is collected.",
          "Paid distribution remains outside this engine and requires explicit authorization.",
        ],
      };
    });
}
