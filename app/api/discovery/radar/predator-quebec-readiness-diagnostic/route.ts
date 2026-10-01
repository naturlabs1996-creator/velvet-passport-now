import { NextResponse } from "next/server";
import { runPredatorMission } from "@/lib/discovery/predator-mission";
import { QUEBEC_CITY_HISTORY_ERAS, QUEBEC_CITY_AUTHORITY_SOURCES } from "@/lib/discovery/quebec-history-context";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

export async function GET() {
  const mission = await runPredatorMission({
    cityId: "quebec-city-ca",
    subject: "Place Royale",
    objective: "Reconstruct the historical layers of Place Royale in Quebec City and test present-day anchoring without assuming building or parcel continuity.",
    knownAddress: "Place Royale, Québec, QC, Canada",
    requestedDepth: "STANDARD",
  });

  const report: any = (mission as any).report;
  const checks = {
    quebecMissionExecutable:
      mission.status === "COMPLETED" || mission.status === "PARTIAL",
    notCapabilityGap: mission.status !== "HOLD_CAPABILITY_GAP",
    localHistoryContextAttached:
      Array.isArray(report?.cityHistoricalContext?.eras) &&
      report.cityHistoricalContext.eras.length === QUEBEC_CITY_HISTORY_ERAS.length,
    localAuthoritySourcesConfigured:
      QUEBEC_CITY_AUTHORITY_SOURCES.length >= 5,
    exactParcelFailsClosed:
      report?.currentParcelAndEntrances?.exactHistoricalParcelMatch !== true,
    currentAnchorCandidateOnly:
      (report?.currentParcelAndEntrances?.currentAddressCandidates ?? []).every(
        (item: any) => item.truthStatus === "CURRENT_ADDRESS_CANDIDATE_ONLY"
      ),
    exposureNotFabricated:
      report?.candidateEvaluation?.scores?.exposureDegree?.score === null,
  };

  const ok = Object.values(checks).every(Boolean);

  return NextResponse.json({
    ok,
    checks,
    missionStatus: mission.status,
    conclusion: report?.conclusion,
    candidateVerdict: report?.candidateEvaluation?.verdict,
    contextEraCount: QUEBEC_CITY_HISTORY_ERAS.length,
    authoritySourceCount: QUEBEC_CITY_AUTHORITY_SOURCES.length,
    unresolved: report?.unresolved,
  }, {
    status: ok ? 200 : 500,
    headers: { "cache-control": "no-store, max-age=0" },
  });
}
