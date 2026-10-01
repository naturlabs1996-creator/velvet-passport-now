import { NextResponse } from "next/server";
import {
  COMPETITIVE_INTELLIGENCE_AGENT,
  OPPORTUNITY_INTELLIGENCE_AGENT,
} from "@/lib/discovery/agent-profiles";
import { validateAgentSafetyProtocol } from "@/lib/discovery/agent-safety-protocol";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const competitiveSafety = validateAgentSafetyProtocol(COMPETITIVE_INTELLIGENCE_AGENT.safetyProtocol);
  const opportunitySafety = validateAgentSafetyProtocol(OPPORTUNITY_INTELLIGENCE_AGENT.safetyProtocol);

  const checks = {
    competitiveUsesUniversalSafety: competitiveSafety.ok,
    opportunityUsesUniversalSafety: opportunitySafety.ok,
    competitiveNoUnauthorizedAccess:
      COMPETITIVE_INTELLIGENCE_AGENT.prohibitedActions.some((item) =>
        item.toLowerCase().includes("unauthorized access"),
      ),
    competitiveNoAutonomousContact:
      COMPETITIVE_INTELLIGENCE_AGENT.prohibitedActions.some((item) =>
        item.toLowerCase().includes("contacting competitors"),
      ),
    competitiveNoAutonomousStrategyChange:
      COMPETITIVE_INTELLIGENCE_AGENT.prohibitedActions.some((item) =>
        item.toLowerCase().includes("product strategy"),
      ),
    opportunityRequiresRepeatedPain:
      OPPORTUNITY_INTELLIGENCE_AGENT.specialistRules.some((item) =>
        item.toLowerCase().includes("repeated across independent signals"),
      ),
    opportunityRejectsViralityAsProof:
      OPPORTUNITY_INTELLIGENCE_AGENT.prohibitedActions.some((item) =>
        item.toLowerCase().includes("social virality alone"),
      ),
    opportunityNoSelfLaunch:
      OPPORTUNITY_INTELLIGENCE_AGENT.specialistRules.some((item) =>
        item.toLowerCase().includes("no opportunity may self-promote"),
      ),
    competitiveHasEliteMarketingCurriculum:
      COMPETITIVE_INTELLIGENCE_AGENT.curriculum.includes("advanced marketing strategy") &&
      COMPETITIVE_INTELLIGENCE_AGENT.curriculum.includes("paid search and paid social strategy") &&
      COMPETITIVE_INTELLIGENCE_AGENT.curriculum.includes("landing pages and conversion-rate optimization"),
    opportunityHasEliteMarketingCurriculum:
      OPPORTUNITY_INTELLIGENCE_AGENT.curriculum.includes("advanced marketing strategy") &&
      OPPORTUNITY_INTELLIGENCE_AGENT.curriculum.includes("problem-solution fit and demand validation") &&
      OPPORTUNITY_INTELLIGENCE_AGENT.curriculum.includes("launch strategy and product commercialization"),
    sameProtocolFamily:
      COMPETITIVE_INTELLIGENCE_AGENT.safetyProtocol.protocolId ===
      OPPORTUNITY_INTELLIGENCE_AGENT.safetyProtocol.protocolId,
  };

  const ok = Object.values(checks).every(Boolean);

  return NextResponse.json({
    ok,
    generatedAt: new Date().toISOString(),
    checks,
    agents: {
      competitive: {
        agentId: COMPETITIVE_INTELLIGENCE_AGENT.agentId,
        mission: COMPETITIVE_INTELLIGENCE_AGENT.mission,
        prohibitedActions: COMPETITIVE_INTELLIGENCE_AGENT.prohibitedActions,
        curriculum: COMPETITIVE_INTELLIGENCE_AGENT.curriculum,
        specialistRules: COMPETITIVE_INTELLIGENCE_AGENT.specialistRules,
      },
      opportunity: {
        agentId: OPPORTUNITY_INTELLIGENCE_AGENT.agentId,
        mission: OPPORTUNITY_INTELLIGENCE_AGENT.mission,
        prohibitedActions: OPPORTUNITY_INTELLIGENCE_AGENT.prohibitedActions,
        curriculum: OPPORTUNITY_INTELLIGENCE_AGENT.curriculum,
        specialistRules: OPPORTUNITY_INTELLIGENCE_AGENT.specialistRules,
      },
    },
  }, {
    status: ok ? 200 : 500,
    headers: { "cache-control": "no-store, max-age=0" },
  });
}
