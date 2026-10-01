// @ts-nocheck
import { NextResponse } from "next/server";
import { runPredatorMission } from "@/lib/discovery/predator-mission";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

export async function GET() {
  const paris = await runPredatorMission({
    cityId: "paris-fr",
    subject: "23 rue Perdue",
    objective: "Reconstruct the historical address lineage and identify current parcel and entrance candidates without assuming number continuity.",
    knownAddress: "23 rue Perdue, Paris",
    knownFacts: [
      "Rue Perdue is a historical street name associated with the present rue Maître-Albert.",
      "Same-number continuity must not be assumed.",
    ],
    requestedDepth: "STANDARD",
  });

  const montreal = await runPredatorMission({
    cityId: "montreal-ca",
    subject: "historical property",
    objective: "Reconstruct historical parcel continuity for a Montréal property.",
    requestedDepth: "STANDARD",
  });

  const outOfMandate = await runPredatorMission({
    cityId: "paris-fr",
    subject: "marketing campaign",
    objective: "Optimize advertising conversion and paid media.",
    requestedDepth: "STANDARD",
  });

  const checks = {
    parisMissionRuns: paris.status === "COMPLETED" || paris.status === "PARTIAL",
    parisHeartbeatHealthy: "heartbeat" in paris && paris.heartbeat?.verdict === "HEALTHY",
    parisHasAuditableReport: "report" in paris && Boolean(paris.report?.missionId) && Array.isArray(paris.report?.sources),
    parisExactParcelFailsClosedUnlessProven:
      !("report" in paris) ||
      !paris.report?.currentParcelAndEntrances ||
      paris.report.currentParcelAndEntrances.exactHistoricalParcelMatch === false,
    montrealCapabilityGapHolds: montreal.status === "HOLD_CAPABILITY_GAP",
    outOfMandateRejected: outOfMandate.status === "REJECTED_MANDATE",
  };

  const ok = Object.values(checks).every(Boolean);

  return NextResponse.json({
    ok,
    generatedAt: new Date().toISOString(),
    checks,
    paris: {
      status: paris.status,
      missionId: paris.missionId,
      heartbeat: "heartbeat" in paris ? paris.heartbeat : undefined,
      report: "report" in paris ? paris.report : undefined,
    },
    montreal: {
      status: montreal.status,
      reasons: "reasons" in montreal ? montreal.reasons : undefined,
      missingAutomation: "missingAutomation" in montreal ? montreal.missingAutomation : undefined,
    },
    outOfMandate: {
      status: outOfMandate.status,
      reasons: "reasons" in outOfMandate ? outOfMandate.reasons : undefined,
    },
  }, {
    status: ok ? 200 : 500,
    headers: { "cache-control": "no-store, max-age=0" },
  });
}
