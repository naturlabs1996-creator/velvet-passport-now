import { NextResponse } from "next/server";
import { evaluateAutonomyGuardrails, PROTECTED_DOCTRINE, DEFAULT_AUTONOMY_BUDGET } from "@/lib/discovery/autonomy-guardrails";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const normal = evaluateAutonomyGuardrails({
    openProposals: 2,
    rulesTouched: 1,
    domainsTouched: 1,
    newExternalSourceFamilies: 1,
    consecutiveFailedExperiments: 0,
    attemptedProtectedDoctrineChange: false,
    attemptedGateWeakening: false,
    attemptedThresholdWeakening: false,
    attemptedDirectProductionPromotion: false,
    benchmarkRegression: false,
    traceabilityBroken: false,
    rollbackBaselineMissing: false,
  });

  const hold = evaluateAutonomyGuardrails({
    openProposals: 2,
    rulesTouched: 3,
    domainsTouched: 1,
    newExternalSourceFamilies: 1,
    consecutiveFailedExperiments: 1,
    attemptedProtectedDoctrineChange: false,
    attemptedGateWeakening: false,
    attemptedThresholdWeakening: false,
    attemptedDirectProductionPromotion: false,
    benchmarkRegression: false,
    traceabilityBroken: false,
    rollbackBaselineMissing: false,
  });

  const kill = evaluateAutonomyGuardrails({
    openProposals: 1,
    rulesTouched: 1,
    domainsTouched: 1,
    newExternalSourceFamilies: 0,
    consecutiveFailedExperiments: 0,
    attemptedProtectedDoctrineChange: false,
    attemptedGateWeakening: true,
    attemptedThresholdWeakening: false,
    attemptedDirectProductionPromotion: false,
    benchmarkRegression: false,
    traceabilityBroken: false,
    rollbackBaselineMissing: false,
  });

  const directPromotion = evaluateAutonomyGuardrails({
    openProposals: 1,
    rulesTouched: 1,
    domainsTouched: 1,
    newExternalSourceFamilies: 0,
    consecutiveFailedExperiments: 0,
    attemptedProtectedDoctrineChange: false,
    attemptedGateWeakening: false,
    attemptedThresholdWeakening: false,
    attemptedDirectProductionPromotion: true,
    benchmarkRegression: false,
    traceabilityBroken: false,
    rollbackBaselineMissing: false,
  });

  const checks = {
    normalAllowed: normal.state === "NORMAL",
    overScopeHeld: hold.state === "HOLD",
    gateWeakeningKills: kill.state === "KILL_SWITCH",
    directSelfPromotionKills: directPromotion.state === "KILL_SWITCH",
    doctrineIsImmutable: PROTECTED_DOCTRINE.every((item) => item.immutable === true),
    budgetPresent:
      DEFAULT_AUTONOMY_BUDGET.maxOpenProposals > 0 &&
      DEFAULT_AUTONOMY_BUDGET.maxRulesTouchedPerProposal > 0 &&
      DEFAULT_AUTONOMY_BUDGET.maxConsecutiveFailedExperiments > 0,
  };

  const ok = Object.values(checks).every(Boolean);

  return NextResponse.json({
    ok,
    generatedAt: new Date().toISOString(),
    checks,
    states: { normal, hold, kill, directPromotion },
    doctrine: PROTECTED_DOCTRINE,
    budget: DEFAULT_AUTONOMY_BUDGET,
  }, {
    status: ok ? 200 : 500,
    headers: { "cache-control": "no-store, max-age=0" },
  });
}
