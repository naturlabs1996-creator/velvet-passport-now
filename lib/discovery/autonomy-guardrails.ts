export type AutonomyState = "NORMAL" | "HOLD" | "MUZZLED" | "KILL_SWITCH";

export type ProtectedDoctrine = {
  id: string;
  statement: string;
  immutable: true;
};

export const PROTECTED_DOCTRINE: ProtectedDoctrine[] = [
  { id: "NO_LOCK_NO_STRIKE", statement: "NO LOCK -> NO STRIKE.", immutable: true },
  { id: "LOW_CONFIDENCE_TEST_ONLY", statement: "LOW CONFIDENCE -> TEST ONLY.", immutable: true },
  { id: "CONFLICT_HOLD", statement: "CONFLICTING SIGNALS -> HOLD.", immutable: true },
  { id: "FAIL_CLOSED", statement: "Missing or contradictory evidence must fail closed.", immutable: true },
  { id: "NO_FALSE_PRECISION", statement: "Witnesses, same-number addresses, current parcels, current entrances and street centroids never become exact historical truth without independent continuity evidence.", immutable: true },
  { id: "NO_GATE_WEAKENING", statement: "Protected gates and evidence thresholds cannot be weakened by autonomous learning.", immutable: true },
  { id: "TRACEABILITY", statement: "Every factual conclusion must remain traceable to evidence and every autonomous change to a benchmarked proposal.", immutable: true },
  { id: "ROLLBACK", statement: "Every promoted improvement must retain a rollback baseline.", immutable: true },
  { id: "EVIDENCE_INTEGRITY", statement: "Fabricated sources, unsupported verification claims, concealed contradictions, hypothesis-to-fact promotion and unjustified confidence inflation are severe integrity violations.", immutable: true },
];

export type AutonomyBudget = {
  maxOpenProposals: number;
  maxRulesTouchedPerProposal: number;
  maxDomainsTouchedPerProposal: number;
  maxNewExternalSourceFamiliesPerProposal: number;
  maxConsecutiveFailedExperiments: number;
};

export const DEFAULT_AUTONOMY_BUDGET: AutonomyBudget = {
  maxOpenProposals: 5,
  maxRulesTouchedPerProposal: 2,
  maxDomainsTouchedPerProposal: 1,
  maxNewExternalSourceFamiliesPerProposal: 2,
  maxConsecutiveFailedExperiments: 3,
};

export type AutonomyTelemetry = {
  openProposals: number;
  rulesTouched: number;
  domainsTouched: number;
  newExternalSourceFamilies: number;
  consecutiveFailedExperiments: number;
  attemptedProtectedDoctrineChange: boolean;
  attemptedGateWeakening: boolean;
  attemptedThresholdWeakening: boolean;
  attemptedDirectProductionPromotion: boolean;
  integrityViolationDetected: boolean;
  benchmarkRegression: boolean;
  traceabilityBroken: boolean;
  rollbackBaselineMissing: boolean;
};

export type AutonomyGuardrailDecision = {
  state: AutonomyState;
  reasons: string[];
  allowedActions: string[];
  blockedActions: string[];
};

export function evaluateAutonomyGuardrails(
  telemetry: AutonomyTelemetry,
  budget: AutonomyBudget = DEFAULT_AUTONOMY_BUDGET,
): AutonomyGuardrailDecision {
  const reasons: string[] = [];
  const muzzleRequired = telemetry.benchmarkRegression || telemetry.rollbackBaselineMissing || telemetry.consecutiveFailedExperiments >= budget.maxConsecutiveFailedExperiments;

  const severe =
    telemetry.attemptedProtectedDoctrineChange ||
    telemetry.attemptedGateWeakening ||
    telemetry.attemptedThresholdWeakening ||
    telemetry.attemptedDirectProductionPromotion ||
    telemetry.integrityViolationDetected ||
    telemetry.traceabilityBroken;

  if (severe) {
    if (telemetry.attemptedProtectedDoctrineChange) reasons.push("Protected doctrine modification attempted.");
    if (telemetry.attemptedGateWeakening) reasons.push("Protected gate weakening attempted.");
    if (telemetry.attemptedThresholdWeakening) reasons.push("Protected threshold weakening attempted.");
    if (telemetry.attemptedDirectProductionPromotion) reasons.push("Direct autonomous production promotion attempted.");
    if (telemetry.integrityViolationDetected) reasons.push("Evidence integrity violation detected.");
    if (telemetry.traceabilityBroken) reasons.push("Evidence/change traceability was broken.");
    return {
      state: "KILL_SWITCH",
      reasons,
      allowedActions: [
        "Read existing evidence and diagnostics.",
        "Generate a post-mortem explaining the attempted drift.",
        "Revert to the last known-good baseline.",
      ],
      blockedActions: [
        "Create or promote new rules.",
        "Change gates or thresholds.",
        "Publish, merge or deploy autonomous changes.",
        "Expand source scope.",
      ],
    };
  }

  if (muzzleRequired) {
    if (telemetry.benchmarkRegression) reasons.push("A benchmark regression requires read-only containment.");
    if (telemetry.rollbackBaselineMissing) reasons.push("Rollback baseline is missing; autonomous writes are disabled.");
    if (telemetry.consecutiveFailedExperiments >= budget.maxConsecutiveFailedExperiments) reasons.push("Repeated failed experiments require containment.");
    return {
      state: "MUZZLED",
      reasons,
      allowedActions: [
        "Read existing evidence and diagnostics.",
        "Run read-only benchmarks.",
        "Compare against the last known-good baseline.",
        "Generate a containment report and proposed recovery plan.",
      ],
      blockedActions: [
        "Write or promote new rules.",
        "Expand source scope.",
        "Start new experiments.",
        "Publish, merge or deploy autonomous changes.",
      ],
    };
  }

  const overBudget =
    telemetry.openProposals > budget.maxOpenProposals ||
    telemetry.rulesTouched > budget.maxRulesTouchedPerProposal ||
    telemetry.domainsTouched > budget.maxDomainsTouchedPerProposal ||
    telemetry.newExternalSourceFamilies > budget.maxNewExternalSourceFamiliesPerProposal ||
    false;

  if (overBudget) {
    if (telemetry.openProposals > budget.maxOpenProposals) reasons.push("Too many autonomous proposals are open.");
    if (telemetry.rulesTouched > budget.maxRulesTouchedPerProposal) reasons.push("A proposal touches too many rules.");
    if (telemetry.domainsTouched > budget.maxDomainsTouchedPerProposal) reasons.push("A proposal crosses too many reasoning domains.");
    if (telemetry.newExternalSourceFamilies > budget.maxNewExternalSourceFamiliesPerProposal) reasons.push("A proposal expands to too many new source families.");
    if (telemetry.consecutiveFailedExperiments >= budget.maxConsecutiveFailedExperiments) reasons.push("Too many consecutive experiments failed.");
    if (telemetry.benchmarkRegression) reasons.push("A historical benchmark regression was detected.");
    if (telemetry.rollbackBaselineMissing) reasons.push("Rollback baseline is missing.");
    return {
      state: "HOLD",
      reasons,
      allowedActions: [
        "Analyze the failure.",
        "Run existing diagnostics and benchmarks.",
        "Reduce proposal scope.",
        "Restore the rollback baseline.",
      ],
      blockedActions: [
        "Promote the proposal.",
        "Open additional experiments.",
        "Expand to new domains or source families.",
      ],
    };
  }

  return {
    state: "NORMAL",
    reasons: ["Autonomous experimentation remains within doctrine and budget."],
    allowedActions: [
      "Discover errors.",
      "Add benchmark cases.",
      "Generate bounded improvement proposals.",
      "Run controlled experiments.",
      "Mark a proven change as PROMOTE_CANDIDATE.",
    ],
    blockedActions: [
      "Modify protected doctrine.",
      "Weaken gates or thresholds.",
      "Self-merge to production.",
      "Treat an unverified candidate as fact.",
    ],
  };
}

export const AUTONOMY_GUARDRAIL_RULE =
  "Predator has bounded autonomy: NORMAL permits bounded learning; HOLD narrows scope; MUZZLED is read-only containment with no autonomous writes, experiments, source expansion, publication or deployment; KILL_SWITCH freezes autonomous change and requires rollback/post-mortem. Protected doctrine and evidence integrity remain non-negotiable.";

export const MUZZLE_RULE = "MUZZLED is a reversible containment mode: Predator may inspect and explain, but may not change its behavior or the outside world until explicitly released through the controlled path.";
