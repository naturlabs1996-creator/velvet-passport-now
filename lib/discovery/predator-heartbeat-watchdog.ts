import type { PredatorGovernanceTelemetry } from "./predator-governance-telemetry";
import { permissionsForState } from "./predator-governance-telemetry";

export type HeartbeatVerdict = "HEALTHY" | "STALE" | "INCONSISTENT" | "LOST";

export function evaluatePredatorHeartbeat(
  telemetry: PredatorGovernanceTelemetry | undefined,
  now = new Date(),
  maxAgeMs = 5 * 60 * 1000,
) {
  if (!telemetry) {
    return {
      verdict: "LOST" as HeartbeatVerdict,
      containment: "KILL_SWITCH" as const,
      reasons: ["No governance telemetry is available for Predator."],
    };
  }

  const observed = new Date(telemetry.observedAt).getTime();
  const ageMs = now.getTime() - observed;
  if (!Number.isFinite(observed) || ageMs > maxAgeMs) {
    return {
      verdict: "STALE" as HeartbeatVerdict,
      containment: "MUZZLED" as const,
      reasons: ["Predator governance heartbeat is stale."],
      ageMs,
    };
  }

  const expected = permissionsForState(telemetry.autonomyState);
  const inconsistent =
    telemetry.writeAccess !== expected.writeAccess ||
    telemetry.experimentAccess !== expected.experimentAccess ||
    telemetry.sourceExpansionAccess !== expected.sourceExpansionAccess ||
    telemetry.publishAccess !== expected.publishAccess ||
    telemetry.deployAccess !== expected.deployAccess;

  if (inconsistent) {
    return {
      verdict: "INCONSISTENT" as HeartbeatVerdict,
      containment: "KILL_SWITCH" as const,
      reasons: ["Predator permissions do not match its declared governance state."],
      ageMs,
    };
  }

  if (!telemetry.lastKnownGoodBaseline) {
    return {
      verdict: "INCONSISTENT" as HeartbeatVerdict,
      containment: "MUZZLED" as const,
      reasons: ["No last known-good baseline is recorded."],
      ageMs,
    };
  }

  return {
    verdict: "HEALTHY" as HeartbeatVerdict,
    containment: telemetry.autonomyState,
    reasons: ["Predator governance heartbeat is current and internally consistent."],
    ageMs,
  };
}

export const PREDATOR_HEARTBEAT_RULE =
  "Loss of telemetry is treated as loss of control. Missing telemetry triggers KILL_SWITCH; stale telemetry or missing baseline triggers MUZZLED; state/permission inconsistency triggers KILL_SWITCH.";
