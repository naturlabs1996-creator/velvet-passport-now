import { NextResponse } from "next/server";
import { collectFirstRadarSources } from "@/lib/discovery/radar-collectors";

const supabaseUrl = "https://kbceicncyhjbegdbjhxl.supabase.co";
const supabaseKey = "sb_publishable_QcO_SHeSjxJqu88Cw36gVw_xtKFB-hl";

async function persistSignal(signal: any) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/vp_ingest_radar_signal`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_theme: signal.theme,
      p_source: signal.source,
      p_source_type: signal.sourceType,
      p_query_text: signal.query ?? null,
      p_signal_text: signal.text ?? null,
      p_observed_at: signal.observedAt,
      p_volume_score: signal.volumeScore,
      p_velocity_score: signal.velocityScore,
      p_source_confidence: signal.sourceConfidence,
      p_velvet_fit: signal.velvetFit,
      p_commercial_intent: signal.commercialIntent,
      p_competition_pressure: signal.competitionPressure,
      p_source_url: signal.sourceUrl ?? null,
      p_metadata: { matchedPhrases: signal.matchedPhrases ?? [] },
    }),
    cache: "no-store",
  });
  return response.ok;
}

async function runCollector() {
  const results = await collectFirstRadarSources();
  const signals = results.flatMap((result) => result.normalized);
  let persisted = 0;
  for (const signal of signals.slice(0, 250)) {
    if (await persistSignal(signal)) persisted += 1;
  }
  return {
    ok: true,
    sources: results.map((result) => ({
      source: result.source,
      ok: result.ok,
      raw: result.observations.length,
      matched: result.normalized.length,
      note: result.note,
    })),
    matched: signals.length,
    persisted,
  };
}

export async function GET(request: Request) {
  const secret = process.env.RADAR_COLLECTOR_SECRET;
  const auth = request.headers.get("authorization");
  if (process.env.VERCEL_ENV === "production" && secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runCollector());
  } catch (error) {
    console.error("VELVET_RADAR_COLLECT_ERROR", error);
    return NextResponse.json({ ok: false, error: "collector_failed" }, { status: 500 });
  }
}
