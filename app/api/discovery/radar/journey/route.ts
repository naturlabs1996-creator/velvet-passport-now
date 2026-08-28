import { NextResponse } from "next/server";
import { collectFirstRadarSources } from "@/lib/discovery/radar-collectors";
import { collectBuyRadarSources } from "@/lib/discovery/radar-buy-collectors";
import { collectDestinationCapture } from "@/lib/discovery/destination-capture";
import { buildVelvetDecisions } from "@/lib/discovery/decision-engine";
import { buildThemeJourney } from "@/lib/discovery/demand-journey";
import { buildInterceptPortfolio } from "@/lib/discovery/intercept-engine";
import { buildOpportunityGapPortfolio } from "@/lib/discovery/opportunity-gap";
import { buildProductionQueue } from "@/lib/discovery/production-queue";
import { emptyDemandRows, flattenUniverse, parisUncoveredUniverse } from "@/lib/discovery/search-demand";

export async function GET() {
  try {
    const [coreSources, buySources, destinationCapture] = await Promise.all([
      collectFirstRadarSources(),
      collectBuyRadarSources(),
      collectDestinationCapture(parisUncoveredUniverse),
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
    const portfolio = decisions.map((decision) => {
      const destination = destinationCapture.themes.find((item) => item.theme === decision.theme);
      return buildThemeJourney({
        theme: decision.theme,
        decision,
        destinations: destination?.domains ?? [],
      });
    });
    const interceptPlan = buildInterceptPortfolio(portfolio);
    const opportunityGaps = buildOpportunityGapPortfolio(decisions.map((decision) => ({
      decision,
      destination: destinationCapture.themes.find((item) => item.theme === decision.theme),
    })));
    const productionQueue = buildProductionQueue({
      universe: parisUncoveredUniverse,
      gaps: opportunityGaps,
      decisions,
      maxReady: 20,
    });
    const universeKeywords = flattenUniverse(parisUncoveredUniverse);

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      architecture: ["DEMAND", "DESTINATION", "OPPORTUNITY_GAP", "PRODUCTION_QUEUE", "VELVET_JOURNEY", "INTERCEPT"],
      measurementRules: {
        demand: "MEASURED only when a volume source such as Keyword Planner or equivalent supplies numeric demand.",
        destination: "ESTIMATED from observed public SERP rank visibility. Click share remains unknown until a real clickstream/owned source exists.",
        opportunityGap: "Score combines relative demand, Velvet fit, intent, observed SERP weakness and commercial saturation. Confidence is reported separately and low-confidence gaps cannot become BUILD_IMMEDIATELY.",
        productionQueue: "Only BUILD_IMMEDIATELY and BUILD_NEXT themes become READY. TEST_FIRST themes become VALIDATE and missing evidence never becomes an automatic production order.",
        velvetJourney: "MEASURED only from first-party Velvet events/Search Console/analytics.",
        intercept: "FREE channels first. Paid retargeting remains HOLD until first-party intent is measured.",
      },
      universe: {
        id: parisUncoveredUniverse.id,
        city: parisUncoveredUniverse.city,
        product: parisUncoveredUniverse.product,
        themes: parisUncoveredUniverse.themes.length,
        keywordCount: universeKeywords.length,
        keywords: emptyDemandRows(parisUncoveredUniverse),
      },
      destinationCapture: {
        source: destinationCapture.source,
        measurement: destinationCapture.measurement,
        note: destinationCapture.note,
        keywordCount: destinationCapture.keywordCount,
        resultCount: destinationCapture.resultCount,
        themes: destinationCapture.themes,
      },
      opportunityGaps,
      productionQueue,
      summary: {
        themes: portfolio.length,
        actionable: portfolio.filter((item) => item.readiness === "ACTIONABLE").length,
        partial: portfolio.filter((item) => item.readiness === "PARTIAL").length,
        insufficient: portfolio.filter((item) => item.readiness === "INSUFFICIENT").length,
        missingSearchVolume: portfolio.filter((item) => item.gaps.includes("SEARCH_VOLUME")).length,
        missingDestinationCapture: portfolio.filter((item) => item.gaps.includes("DESTINATION_CAPTURE")).length,
        missingFirstPartyJourney: portfolio.filter((item) => item.gaps.includes("FIRST_PARTY_JOURNEY")).length,
        buildImmediately: opportunityGaps.filter((item) => item.action === "BUILD_IMMEDIATELY").length,
        buildNext: opportunityGaps.filter((item) => item.action === "BUILD_NEXT").length,
        testFirst: opportunityGaps.filter((item) => item.action === "TEST_FIRST").length,
        monitorGap: opportunityGaps.filter((item) => item.action === "MONITOR").length,
        productionReady: productionQueue.filter((item) => item.status === "READY").length,
        productionValidate: productionQueue.filter((item) => item.status === "VALIDATE").length,
        productionHold: productionQueue.filter((item) => item.status === "HOLD").length,
        freeInterceptActions: interceptPlan.filter((item) => item.costMode === "FREE").length,
        paidOptionalActions: interceptPlan.filter((item) => item.costMode === "PAID_OPTIONAL").length,
      },
      portfolio,
      interceptPlan,
    });
  } catch (error) {
    console.error("VELVET_DEMAND_JOURNEY_ERROR", error);
    return NextResponse.json({ ok: false, error: "demand_journey_failed" }, { status: 500 });
  }
}
