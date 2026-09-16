import { NextRequest, NextResponse } from "next/server";
import { collectWikiVenueDiagnostic } from "@/lib/discovery/wikidata-venue-pool";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const theme = url.searchParams.get("theme") || "beyond-the-classics";
  const maxSeedsRaw = Number(url.searchParams.get("maxSeeds") || "12");
  const maxSeeds = Number.isFinite(maxSeedsRaw) ? Math.max(2, Math.min(16, Math.round(maxSeedsRaw))) : 12;

  try {
    const startedAt = Date.now();
    const result = await collectWikiVenueDiagnostic(theme, maxSeeds);
    return NextResponse.json({
      ok: result.ok,
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      ...result,
    }, {
      status: result.ok ? 200 : 400,
      headers: {
        "cache-control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      generatedAt: new Date().toISOString(),
      theme,
      error: error instanceof Error ? error.message : "wiki_diagnostic_failed",
    }, {
      status: 500,
      headers: {
        "cache-control": "no-store, max-age=0",
      },
    });
  }
}
