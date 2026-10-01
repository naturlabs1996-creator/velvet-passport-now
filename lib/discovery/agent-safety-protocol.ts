export type AgentSafetyState = "NORMAL" | "HOLD" | "MUZZLED" | "KILL_SWITCH";

export type AgentIdentity = {
  agentId: string;
  role: string;
  ownerScope: string;
  allowedDomains: string[];
};

export type AgentSafetyProtocol = {
  protocolId: "VELVET_AGENT_SAFETY_V1";
  identity: AgentIdentity;
  mandatoryControls: {
    boundedMandate: true;
    immutableDoctrine: true;
    evidenceTraceability: true;
    independentVerification: true;
    regressionBenchmark: true;
    rollbackBaseline: true;
    governanceTelemetry: true;
    heartbeatWatchdog: true;
    noDirectProductionPromotion: true;
    failClosedOnMissingEvidence: true;
    integrityViolationKillSwitch: true;
  };
  stateModel: {
    normal: "NORMAL";
    hold: "HOLD";
    muzzled: "MUZZLED";
    killSwitch: "KILL_SWITCH";
  };
};

export function buildAgentSafetyProtocol(identity: AgentIdentity): AgentSafetyProtocol {
  return {
    protocolId: "VELVET_AGENT_SAFETY_V1",
    identity,
    mandatoryControls: {
      boundedMandate: true,
      immutableDoctrine: true,
      evidenceTraceability: true,
      independentVerification: true,
      regressionBenchmark: true,
      rollbackBaseline: true,
      governanceTelemetry: true,
      heartbeatWatchdog: true,
      noDirectProductionPromotion: true,
      failClosedOnMissingEvidence: true,
      integrityViolationKillSwitch: true,
    },
    stateModel: {
      normal: "NORMAL",
      hold: "HOLD",
      muzzled: "MUZZLED",
      killSwitch: "KILL_SWITCH",
    },
  };
}

export const UNIVERSAL_AGENT_SAFETY_RULES = [
  "Every autonomous or semi-autonomous agent must declare a bounded mandate and allowed domains.",
  "Every agent must expose governance telemetry and a current heartbeat.",
  "Every agent must preserve a last known-good rollback baseline.",
  "Every agent must fail closed when evidence, authority, capability or continuity is missing.",
  "Every agent must be independently verifiable; it cannot be the sole judge of its own factual correctness.",
  "Every agent must retain permanent regression cases for corrected failures.",
  "Every agent must use NORMAL, HOLD, MUZZLED and KILL_SWITCH containment states.",
  "Every agent is forbidden from weakening protected gates or thresholds autonomously.",
  "Every agent is forbidden from directly promoting, merging, publishing or deploying its own behavioral changes to production.",
  "Fabricated evidence, unsupported verification claims, concealed contradictions, hypothesis-to-fact promotion, unjustified confidence inflation or broken traceability are severe integrity violations.",
];

export function validateAgentSafetyProtocol(protocol: AgentSafetyProtocol) {
  const controls = protocol.mandatoryControls;
  const missing = Object.entries(controls).filter(([, enabled]) => enabled !== true).map(([name]) => name);
  return {
    ok:
      protocol.protocolId === "VELVET_AGENT_SAFETY_V1" &&
      protocol.identity.agentId.trim().length > 0 &&
      protocol.identity.role.trim().length > 0 &&
      protocol.identity.allowedDomains.length > 0 &&
      missing.length === 0,
    missing,
  };
}
