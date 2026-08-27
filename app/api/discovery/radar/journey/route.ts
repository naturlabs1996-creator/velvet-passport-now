import { NextResponse } from "next/server";
import { collectFirstRadarSources } from "@/lib/discovery/radar-collectors";
import { collectBuyRadarSources } from "@/lib/discovery/radar-buy-collectors";
import { buildVelvetDecisions } from "@/lib/discovery/decision-engine";
import { buildJourneyPortfolio } from "@/lib/discovery/demand-journey";

export async function GET() {
  try {
    const [coreSources, buySources] = await Promise.all([
      collectFirstRadarSources(),
      collectBuyRadarSources(),
    ]);

    const signals = [
      ...coreSources.flatMap((result) => result.normalized),
      ...buySources.flatMap((result) => result.normalized),
    ];

    const buyHealth = buySources.map((result) => ({
      source: result.source,
      available: result.ok,
      matchedThemes: [...new Set(result.normalized.map((signal) => signal.theme))],
    }));

    const decisions = buildVelvetDecisions(signals, buyHealth);
    const portfolio = buildJourneyPortfolio(decisions);

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      architecture: ["DEMAND", "DESTINATION", "VELVET_JOURNEY"],
      measurementRules: {
        demand: "MEASURED only when a volume source such as Keyword Planner or equivalent supplies numeric demand.",
        destination: "MEASURED only when SERP/clickstream or owned-search data supplies destination evidence; never inferred from Google Suggest alone.",
        velvetJourney: "MEASURED only from first-party Velvet events/Search Console/analytics.",
      },
      summary: {
        themes: portfolio.length,
        actionable: portfolio.filter((item) => item.readiness === "ACTIONABLE").length,
        partial: portfolio.filter((item) => item.readiness === "PARTIAL").length,
        insufficient: portfolio.filter((item) => item.readiness === "INSUFFICIENT").length,
        missingSearchVolume: portfolio.filter((item) => item.gaps.includes("SEARCH_VOLUME")).length,
        missingDestinationCapture: portfolio.filter((item) => item.gaps.includes("DESTINATION_CAPTURE")).length,
        missingFirstPartyJourney: portfolio.filter((item) => item.gaps.includes("FIRST_PARTY_JOURNEY")).length,
      },
      portfolio,
    });
  } catch (error) {
    console.error("VELVET_DEMAND_JOURNEY_ERROR", error);
    return NextResponse.json({ ok: false, error: "demand_journey_failed" }, { status: 500 });
  }
}
