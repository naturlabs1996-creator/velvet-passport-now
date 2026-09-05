import { NextResponse } from "next/server";
import { collectFirstRadarSources } from "@/lib/discovery/radar-collectors";
import { collectBuyRadarSources } from "@/lib/discovery/radar-buy-collectors";
import { buildVelvetDecisions } from "@/lib/discovery/decision-engine";

export async function GET() {
  try {
    const [coreSources, buySources] = await Promise.all([
      collectFirstRadarSources(),
      collectBuyRadarSources(),
    ]);

    const coreSignals = coreSources.flatMap((result) => result.normalized);
    const buySignals = buySources.flatMap((result) => result.normalized);
    const allSignals = [...coreSignals, ...buySignals];

    const buyHealth = buySources.map((result) => ({
      source: result.source,
      available: result.ok,
      matchedThemes: [...new Set(result.normalized.map((signal) => signal.theme))],
    }));

    const decisions = buildVelvetDecisions(allSignals, buyHealth);

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      signalCount: allSignals.length,
      sourceHealth: {
        core: coreSources.map((result) => ({
          source: result.source,
          ok: result.ok,
          raw: result.observations.length,
          matched: result.normalized.length,
          note: result.note,
        })),
        buy: buySources.map((result) => ({
          source: result.source,
          ok: result.ok,
          raw: result.observations.length,
          matched: result.normalized.length,
          note: result.note,
        })),
      },
      summary: {
        createAnswerPage: decisions.filter((decision) => decision.action === "CREATE_ANSWER_PAGE").length,
        promoteParisUncovered: decisions.filter((decision) => decision.action === "PROMOTE_PARIS_UNCOVERED").length,
        promoteNow: decisions.filter((decision) => decision.action === "PROMOTE_NOW").length,
        investigateProduct: decisions.filter((decision) => decision.action === "INVESTIGATE_PRODUCT").length,
        monitor: decisions.filter((decision) => decision.action === "MONITOR").length,
        ignore: decisions.filter((decision) => decision.action === "IGNORE").length,
        commercialConfirmed: decisions.filter((decision) => decision.commercialValidation === "CONFIRMED").length,
        commercialUnverified: decisions.filter((decision) => decision.commercialValidation === "UNVERIFIED").length,
      },
      decisions,
    });
  } catch (error) {
    console.error("VELVET_DECISION_ENGINE_ERROR", error);
    return NextResponse.json({ ok: false, error: "decision_engine_failed" }, { status: 500 });
  }
}
