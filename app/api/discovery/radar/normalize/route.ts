import { NextResponse } from "next/server";
import { normalizeRadarObservation, type RawRadarObservation } from "@/lib/discovery/radar-pipeline";

export async function POST(request: Request) {
  let body: RawRadarObservation | RawRadarObservation[];

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const observations = Array.isArray(body) ? body.slice(0, 100) : [body];
  const normalized = observations.flatMap((observation) => normalizeRadarObservation(observation));

  return NextResponse.json({
    ok: true,
    received: observations.length,
    matched: normalized.length,
    signals: normalized,
  });
}
