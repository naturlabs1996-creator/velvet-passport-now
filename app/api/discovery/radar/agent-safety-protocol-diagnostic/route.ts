import { NextResponse } from "next/server";
import { buildAgentSafetyProtocol, validateAgentSafetyProtocol, UNIVERSAL_AGENT_SAFETY_RULES } from "@/lib/discovery/agent-safety-protocol";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const predator = buildAgentSafetyProtocol({
    agentId: "predator-2",
    role: "historical research and micro-location agent",
    ownerScope: "Velvet Passport",
    allowedDomains: [
      "historical-research",
      "archival-analysis",
      "historical-micro-location",
      "city-source-adapters",
    ],
  });

  const futureAgent = buildAgentSafetyProtocol({
    agentId: "future-agent-fixture",
    role: "generic bounded autonomous agent",
    ownerScope: "Velvet Passport",
    allowedDomains: ["fixture-domain"],
  });

  const predatorCheck = validateAgentSafetyProtocol(predator);
  const futureCheck = validateAgentSafetyProtocol(futureAgent);

  const checks = {
    predatorUsesUniversalProtocol: predatorCheck.ok,
    futureAgentUsesSameProtocol: futureCheck.ok,
    sameProtocolId: predator.protocolId === futureAgent.protocolId,
    sameMandatoryControls:
      JSON.stringify(predator.mandatoryControls) === JSON.stringify(futureAgent.mandatoryControls),
    sameContainmentStates:
      JSON.stringify(predator.stateModel) === JSON.stringify(futureAgent.stateModel),
    noDirectProductionPromotion:
      predator.mandatoryControls.noDirectProductionPromotion === true &&
      futureAgent.mandatoryControls.noDirectProductionPromotion === true,
    integrityKillSwitchMandatory:
      predator.mandatoryControls.integrityViolationKillSwitch === true &&
      futureAgent.mandatoryControls.integrityViolationKillSwitch === true,
  };

  const ok = Object.values(checks).every(Boolean);

  return NextResponse.json({
    ok,
    generatedAt: new Date().toISOString(),
    checks,
    protocolId: predator.protocolId,
    predator,
    futureAgent,
    rules: UNIVERSAL_AGENT_SAFETY_RULES,
  }, {
    status: ok ? 200 : 500,
    headers: { "cache-control": "no-store, max-age=0" },
  });
}
