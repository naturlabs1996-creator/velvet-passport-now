import type { RefinedPrecisionTarget } from "./target-refinement";

export type SpeedMode = "FAST_SCAN" | "FOCUSED_VERIFY" | "DEEP_VERIFY" | "STOP";
export type SpeedDecision = "CONTINUE" | "ESCALATE" | "STOP";

export type StageBudget = {
  maxQueries: number;
  maxSources: number;
  maxCandidates: number;
  parallelism: number;
  cacheFirst: boolean;
};

export type SpeedPlan = {
  theme: string;
  state: RefinedPrecisionTarget["state"];
  mode: SpeedMode;
  decision: SpeedDecision;
  priority: number;
  budgets: {
    scan: StageBudget;
    verify: StageBudget;
    deepVerify: StageBudget;
  };
  reasons: string[];
  safeguards: string[];
};

function budgetsFor(state: RefinedPrecisionTarget["state"]): SpeedPlan["budgets"] {
  if (state === "LOCK") {
    return {
      scan: { maxQueries: 8, maxSources: 12, maxCandidates: 30, parallelism: 4, cacheFirst: true },
      verify: { maxQueries: 10, maxSources: 16, maxCandidates: 12, parallelism: 4, cacheFirst: true },
      deepVerify: { maxQueries: 12, maxSources: 20, maxCandidates: 8, parallelism: 3, cacheFirst: true },
    };
  }
  if (state === "TRACK") {
    return {
      scan: { maxQueries: 6, maxSources: 10, maxCandidates: 20, parallelism: 4, cacheFirst: true },
      verify: { maxQueries: 6, maxSources: 10, maxCandidates: 8, parallelism: 3, cacheFirst: true },
      deepVerify: { maxQueries: 6, maxSources: 12, maxCandidates: 5, parallelism: 2, cacheFirst: true },
    };
  }
  if (state === "RETEST") {
    return {
      scan: { maxQueries: 4, maxSources: 6, maxCandidates: 10, parallelism: 3, cacheFirst: true },
      verify: { maxQueries: 3, maxSources: 6, maxCandidates: 4, parallelism: 2, cacheFirst: true },
      deepVerify: { maxQueries: 2, maxSources: 4, maxCandidates: 2, parallelism: 1, cacheFirst: true },
    };
  }
  return {
    scan: { maxQueries: 1, maxSources: 2, maxCandidates: 2, parallelism: 1, cacheFirst: true },
    verify: { maxQueries: 0, maxSources: 0, maxCandidates: 0, parallelism: 1, cacheFirst: true },
    deepVerify: { maxQueries: 0, maxSources: 0, maxCandidates: 0, parallelism: 1, cacheFirst: true },
  };
}

export function buildSpeedPlans(targets: RefinedPrecisionTarget[]): SpeedPlan[] {
  return [...targets]
    .sort((a, b) => b.targetScore - a.targetScore)
    .map((target, index) => {
      const reasons: string[] = [];
      let mode: SpeedMode = "FAST_SCAN";
      let decision: SpeedDecision = "CONTINUE";

      if (target.state === "LOCK") {
        mode = "DEEP_VERIFY";
        decision = "ESCALATE";
        reasons.push("LOCK target receives the deepest verification budget and highest execution priority.");
      } else if (target.state === "TRACK") {
        mode = "FOCUSED_VERIFY";
        decision = "CONTINUE";
        reasons.push("TRACK target receives focused verification without full deep-scan cost.");
      } else if (target.state === "RETEST") {
        mode = "FAST_SCAN";
        decision = "CONTINUE";
        reasons.push("RETEST target receives a small controlled scan before any expensive escalation.");
      } else {
        mode = "STOP";
        decision = "STOP";
        reasons.push("IGNORE target is stopped early to protect query and verification capacity.");
      }

      return {
        theme: target.theme,
        state: target.state,
        mode,
        decision,
        priority: index + 1,
        budgets: budgetsFor(target.state),
        reasons,
        safeguards: [
          "Speed controls may reduce, defer or stop work but never bypass claim verification or publication gates.",
          "Cache is consulted before external collection whenever a valid cache policy exists.",
          "Low-signal themes are stopped early; strong targets earn deeper verification rather than broader unverified collection.",
          "Budgets are hard ceilings, not targets that must be exhausted.",
        ],
      };
    });
}
