import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const URL = "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/lieux-municipaux/records?limit=5";

function summarize(value: unknown, depth = 0): unknown {
  if (depth > 2) return typeof value;
  if (value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 3).map((item) => summarize(item, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 40).map(([key, child]) => [key, summarize(child, depth + 1)]));
  }
  return typeof value;
}

export async function GET() {
  try {
    const response = await fetch(URL, {
      headers: { "user-agent": "VelvetPassportRegistryDebug/1.0", accept: "application/json" },
      cache: "no-store",
    });
    const text = await response.text();
    if (!response.ok) return NextResponse.json({ ok: false, status: response.status, body: text.slice(0, 1000) }, { status: 502 });
    const json = JSON.parse(text) as { total_count?: number; results?: Array<Record<string, unknown>> };
    return NextResponse.json({
      ok: true,
      totalCount: json.total_count,
      rowCount: json.results?.length ?? 0,
      rows: (json.results ?? []).map((row) => ({ keys: Object.keys(row), sample: summarize(row) })),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "registry_debug_failed" }, { status: 500 });
  }
}
