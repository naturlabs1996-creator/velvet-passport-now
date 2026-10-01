import { NextResponse } from "next/server";
import { buildGovernanceTelemetry } from "@/lib/discovery/predator-governance-telemetry";
import { evaluatePredatorHeartbeat } from "@/lib/discovery/predator-heartbeat-watchdog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const now = new Date();

  const healthyTelemetry = buildGovernanceTelemetry({
    observedAt: now.toISOString(),
    autonomyState: "NORMAL",
    cityId: "paris-fr",
    activeDomain: "HISTORICAL_PARCEL_MATCH",
    activeTask: "Align historical parcel with current parcel fabric",
    activeSourceFamilies: ["archives.paris.fr", "opendata.paris.fr"],
    openProposalIds: [],
    lastAuthorizedAction: "Run controlled historical parcel alignment diagnostic",
    lastBenchmarkStatus: "PASS",
    lastKnownGoodBaseline: "a89b1994bcc9f03acebe31dfdf5609a07d5c8325",
    lastRollbackBaseline: "a89b1994bcc9f03acebe31dfdf5609a07d5c8325",
    stateReason: ["Controlled research operation."],
  });

  const staleTelemetry = {
    ...healthyTelemetry,
    observedAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
  };

  const inconsistentTelemetry = {
    ...healthyTelemetry,
    autonomyState: "MUZZLED" as const,
    writeAccess: true,
  };

  const noBaselineTelemetry = {
    ...healthyTelemetry,
    lastKnownGoodBaseline: undefined,
  };

  const healthy = evaluatePredatorHeartbeat(healthyTelemetry, now);
  const stale = evaluatePredatorHeartbeat(staleTelemetry, now);
  const inconsistent = evaluatePredatorHeartbeat(inconsistentTelemetry, now);
  const noBaseline = evaluatePredatorHeartbeat(noBaselineTelemetry, now);
  const lost = evaluatePredatorHeartbeat(undefined, now);

  const checks = {
    healthyPasses: healthy.verdict === "HEALTHY",
    staleMuzzles: stale.verdict === "STALE" && stale.containment === "MUZZLED",
    inconsistentKills: inconsistent.verdict === "INCONSISTENT" && inconsistent.containment === "KILL_SWITCH",
    missingBaselineMuzzles: noBaseline.verdict === "INCONSISTENT" && noBaseline.containment === "MUZZLED",
    missingTelemetryKills: lost.verdict === "LOST" && lost.containment === "KILL_SWITCH",
  };

  const ok = Object.values(checks).every(Boolean);

  return NextResponse.json({
    ok,
    generatedAt: now.toISOString(),
    checks,
    cases: { healthy, stale, inconsistent, noBaseline, lost },
    telemetry: healthyTelemetry,
  }, {
    status: ok ? 200 : 500,
    headers: { "cache-control": "no-store, max-age=0" },
  });
}
