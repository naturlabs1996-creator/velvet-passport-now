import { NextResponse } from "next/server";
import { collectBuyRadarSources } from "@/lib/discovery/radar-buy-collectors";
import { collectGooglePlayBooksBuy } from "@/lib/discovery/radar-books-buy";

const safeSample = (value: unknown, max = 220) => String(value ?? "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, max);

export async function GET() {
  try {
    const [marketplaces, books] = await Promise.all([
      collectBuyRadarSources(),
      collectGooglePlayBooksBuy(),
    ]);
    const results = [...marketplaces, books];
    const signals = results.flatMap((result) => result.normalized);

    const convergence = [...new Set(signals.map((signal) => signal.theme))].map((theme) => {
      const themed = signals.filter((signal) => signal.theme === theme);
      const sources = [...new Set(themed.map((signal) => signal.source))];
      return {
        theme,
        sourceCount: sources.length,
        sources,
        signalCount: themed.length,
        bestOpportunity: Math.max(...themed.map((signal) => signal.velvetOpportunityScore ?? 0)),
        strongestCommercialIntent: Math.max(...themed.map((signal) => signal.commercialIntent ?? 0)),
      };
    }).sort((a, b) => b.sourceCount - a.sourceCount || b.bestOpportunity - a.bestOpportunity);

    return NextResponse.json({
      ok: true,
      sources: results.map((result) => ({
        source: result.source,
        ok: result.ok,
        raw: result.observations.length,
        matched: result.normalized.length,
        note: result.note,
        samples: result.normalized.slice(0, 4).map((signal) => ({
          theme: signal.theme,
          velvetOpportunity: signal.velvetOpportunity,
          velvetOpportunityScore: signal.velvetOpportunityScore,
          commercialIntent: signal.commercialIntent,
          purchaseCategory: signal.purchaseCategory,
          text: safeSample(signal.text),
          sourceUrl: safeSample(signal.sourceUrl, 260),
        })),
      })),
      matched: signals.length,
      convergence,
    });
  } catch (error) {
    console.error("VELVET_BUY_PROBE_ERROR", error);
    return NextResponse.json({ ok: false, error: "buy_probe_failed" }, { status: 500 });
  }
}
