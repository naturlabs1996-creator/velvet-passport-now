import type { AutonomyState } from "./autonomy-guardrails";

export type PredatorGovernanceTelemetry = {
  agentId: "predator-2";
  observedAt: string;
  autonomyState: AutonomyState;
  cityId?: string;
  activeDomain?: string;
  activeTask?: string;
  activeSourceFamilies: string[];
  openProposalIds: string[];
  lastAuthorizedAction?: string;
  lastBenchmarkStatus?: "PASS" | "FAIL";
  lastKnownGoodBaseline?: string;
  lastRollbackBaseline?: string;
  stateReason: string[];
  writeAccess: boolean;
  experimentAccess: boolean;
  sourceExpansionAccess: boolean;
  publishAccess: boolean;
  deployAccess: boolean;
};

export type PredatorGovernanceEvent = {
  eventId: string;
  observedAt: string;
  fromState: AutonomyState;
  toState: AutonomyState;
  reason: string;
  domain?: string;
  task?: string;
  proposalId?: string;
  benchmarkStatus?: "PASS" | "FAIL";
  baseline?: string;
};

export function permissionsForState(state: AutonomyState) {
  if (state === "KILL_SWITCH") {
    return {
      writeAccess: false,
      experimentAccess: false,
      sourceExpansionAccess: false,
      publishAccess: false,
      deployAccess: false,
    };
  }
  if (state === "MUZZLED") {
    return {
      writeAccess: false,
      experimentAccess: false,
      sourceExpansionAccess: false,
      publishAccess: false,
      deployAccess: false,
    };
  }
  if (state === "HOLD") {
    return {
      writeAccess: true,
      experimentAccess: false,
      sourceExpansionAccess: false,
      publishAccess: false,
      deployAccess: false,
    };
  }
  return {
    writeAccess: true,
    experimentAccess: true,
    sourceExpansionAccess: true,
    publishAccess: false,
    deployAccess: false,
  };
}

export function buildGovernanceTelemetry(input: Omit<PredatorGovernanceTelemetry,
  "agentId" | "writeAccess" | "experimentAccess" | "sourceExpansionAccess" | "publishAccess" | "deployAccess"
>): PredatorGovernanceTelemetry {
  return {
    agentId: "predator-2",
    ...input,
    ...permissionsForState(input.autonomyState),
  };
}

export const PREDATOR_GPS_RULE =
  "Predator must always expose its current governance state, active domain/task, source scope, proposals, last benchmark and rollback baseline. State transitions are append-only events. MUZZLED and KILL_SWITCH are read-only; HOLD cannot experiment or expand scope; no autonomous state may publish or deploy directly.";
