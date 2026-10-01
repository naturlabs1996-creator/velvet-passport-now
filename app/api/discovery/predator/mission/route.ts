import { NextResponse } from "next/server";
import { runPredatorMission, PREDATOR_MISSION_RULE, type PredatorMissionRequest } from "@/lib/discovery/predator-mission";
import { HISTORICAL_GEO_ADAPTERS } from "@/lib/discovery/historical-geo-adapters";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.PREDATOR_MISSION_SECRET || process.env.RADAR_COLLECTOR_SECRET;
  if (process.env.VERCEL_ENV !== "production") return true;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    agent: "Predator 2.0",
    status: "SHADOW_READY",
    endpoint: "POST /api/discovery/predator/mission",
    supportedOperationalCities: ["paris-fr"],
    knownAdapters: Object.keys(HISTORICAL_GEO_ADAPTERS),
    requestExample: {
      cityId: "paris-fr",
      subject: "23 rue Perdue",
      objective: "Reconstruct the historical address lineage and identify the current parcel and entrance candidates without assuming number continuity.",
      knownAddress: "23 rue Perdue, Paris",
      knownFacts: ["The historical street is believed to correspond to rue Maître-Albert."],
      requestedDepth: "DEEP",
    },
    authorization: "Production POST requires Bearer PREDATOR_MISSION_SECRET, falling back to RADAR_COLLECTOR_SECRET.",
    rule: PREDATOR_MISSION_RULE,
  }, { headers: { "cache-control": "no-store, max-age=0" } });
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "predator_mission_unauthorized_or_secret_missing" }, { status: 401 });
  }

  let body: PredatorMissionRequest;
  try {
    body = await request.json() as PredatorMissionRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  try {
    const result = await runPredatorMission(body);
    const statusCode =
      result.status === "REJECTED_MANDATE" ? 400 :
      result.status === "CONTAINED" ? 423 :
      result.status === "HOLD_CAPABILITY_GAP" ? 422 :
      200;
    return NextResponse.json({ ok: statusCode === 200, ...result }, {
      status: statusCode,
      headers: { "cache-control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("PREDATOR_MISSION_ERROR", error);
    return NextResponse.json({ ok: false, error: "predator_mission_failed_closed" }, { status: 500 });
  }
}
