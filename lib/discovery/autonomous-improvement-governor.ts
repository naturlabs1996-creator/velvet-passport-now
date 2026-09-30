export type ImprovementDomain =
  | "WITNESS_SPATIAL_GRAMMAR"
  | "STREET_LINEAGE"
  | "NUMBER_CONTINUITY"
  | "HISTORICAL_PARCEL_MATCH"
  | "CURRENT_PARCEL_MATCH"
  | "ENTRANCE_MATCH"
  | "SOURCE_ADAPTER"
  | "EXPOSURE"
  | "CLAIM_VERIFICATION";

export type ImprovementOutcome = {
  domain: ImprovementDomain;
  proposalId: string;
  description: string;
  before: {
    benchmarkPassRate: number;
    falsePositiveRate: number;
    falseNegativeRate: number;
  };
  after: {
    benchmarkPassRate: number;
    falsePositiveRate: number;
    falseNegativeRate: number;
  };
  regressionAudit: "PASS" | "FAIL";
  publicationCanary: "PASS" | "FAIL";
  evidenceCases: number;
  citiesCovered: string[];
  changedGates: boolean;
  changedThresholds: boolean;
};

export type ImprovementDecision =
  | "PROMOTE_CANDIDATE"
  | "KEEP_TESTING"
  | "REJECT_REGRESSION"
  | "REJECT_GATE_WEAKENING"
  | "REJECT_INSUFFICIENT_EVIDENCE";

export type ImprovementEvaluation = {
  proposalId: string;
  decision: ImprovementDecision;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  netPassRateGain: number;
  falsePositiveDelta: number;
  falseNegativeDelta: number;
  reasons: string[];
  requirementsBeforeAdoption: string[];
  automaticAdoptionAllowed: false;
};

function clampRate(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function evaluateImprovementProposal(input: ImprovementOutcome): ImprovementEvaluation {
  const beforePass = clampRate(input.before.benchmarkPassRate);
  const afterPass = clampRate(input.after.benchmarkPassRate);
  const beforeFp = clampRate(input.before.falsePositiveRate);
  const afterFp = clampRate(input.after.falsePositiveRate);
  const beforeFn = clampRate(input.before.falseNegativeRate);
  const afterFn = clampRate(input.after.falseNegativeRate);

  const netPassRateGain = afterPass - beforePass;
  const falsePositiveDelta = afterFp - beforeFp;
  const falseNegativeDelta = afterFn - beforeFn;
  const reasons: string[] = [];
  const requirementsBeforeAdoption: string[] = [
    "Re-run the full research quality audit.",
    "Re-run publication canary checks.",
    "Retain the old behavior as a rollback baseline.",
    "Record benchmark cases and proposal rationale.",
  ];

  if (input.changedGates || input.changedThresholds) {
    reasons.push("The proposal changes a protected gate or threshold.");
    return {
      proposalId: input.proposalId,
      decision: "REJECT_GATE_WEAKENING",
      confidence: "HIGH",
      netPassRateGain,
      falsePositiveDelta,
      falseNegativeDelta,
      reasons,
      requirementsBeforeAdoption,
      automaticAdoptionAllowed: false,
    };
  }

  if (input.regressionAudit === "FAIL" || input.publicationCanary === "FAIL" || falsePositiveDelta > 0) {
    reasons.push("The proposal introduces a regression, canary failure, or higher false-positive rate.");
    return {
      proposalId: input.proposalId,
      decision: "REJECT_REGRESSION",
      confidence: "HIGH",
      netPassRateGain,
      falsePositiveDelta,
      falseNegativeDelta,
      reasons,
      requirementsBeforeAdoption,
      automaticAdoptionAllowed: false,
    };
  }

  const minimumCases = input.citiesCovered.length >= 2 ? 12 : 20;
  if (input.evidenceCases < minimumCases) {
    reasons.push(`Only ${input.evidenceCases} benchmark cases are available; minimum is ${minimumCases} for this coverage.`);
    return {
      proposalId: input.proposalId,
      decision: "REJECT_INSUFFICIENT_EVIDENCE",
      confidence: input.evidenceCases >= Math.ceil(minimumCases / 2) ? "LOW" : "NONE",
      netPassRateGain,
      falsePositiveDelta,
      falseNegativeDelta,
      reasons,
      requirementsBeforeAdoption,
      automaticAdoptionAllowed: false,
    };
  }

  if (netPassRateGain >= 0.05 && falsePositiveDelta <= 0 && falseNegativeDelta <= 0.02) {
    reasons.push("Benchmark pass rate improved materially without increasing false positives.");
    if (input.citiesCovered.length >= 2) reasons.push("The improvement was tested across more than one city adapter.");
    requirementsBeforeAdoption.push("Promote only through the controlled code/deployment path; never self-merge directly to production.");
    return {
      proposalId: input.proposalId,
      decision: "PROMOTE_CANDIDATE",
      confidence: input.citiesCovered.length >= 2 && input.evidenceCases >= 24 ? "HIGH" : "MEDIUM",
      netPassRateGain,
      falsePositiveDelta,
      falseNegativeDelta,
      reasons,
      requirementsBeforeAdoption,
      automaticAdoptionAllowed: false,
    };
  }

  reasons.push("The proposal is not clearly worse, but the measured gain is not yet large or stable enough.");
  return {
    proposalId: input.proposalId,
    decision: "KEEP_TESTING",
    confidence: "LOW",
    netPassRateGain,
    falsePositiveDelta,
    falseNegativeDelta,
    reasons,
    requirementsBeforeAdoption,
    automaticAdoptionAllowed: false,
  };
}

export const AUTONOMOUS_IMPROVEMENT_RULES = [
  "Predator may discover errors, generate improvement proposals, create regression cases and rank candidate fixes autonomously.",
  "Predator may never weaken protected gates, thresholds, evidence requirements or fail-closed behavior in order to improve benchmark scores.",
  "A higher false-positive rate is always a regression for historical identity, parcel, entrance and factual claims.",
  "Improvements should be tested across multiple city adapters when the rule is intended to be universal.",
  "A winning improvement remains a PROMOTE_CANDIDATE until it passes the controlled code/deployment path; direct self-merge to production is forbidden.",
  "Every adopted improvement must preserve a rollback baseline and the benchmark evidence that justified it.",
];
