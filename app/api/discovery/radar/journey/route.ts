import { NextResponse } from "next/server";
import { collectFirstRadarSources } from "@/lib/discovery/radar-collectors";
import { collectBuyRadarSources } from "@/lib/discovery/radar-buy-collectors";
import { collectDestinationCapture } from "@/lib/discovery/destination-capture";
import { buildVelvetDecisions } from "@/lib/discovery/decision-engine";
import { buildThemeJourney } from "@/lib/discovery/demand-journey";
import { buildInterceptPortfolio } from "@/lib/discovery/intercept-engine";
import { buildOpportunityGapPortfolio } from "@/lib/discovery/opportunity-gap";
import { buildProductionQueue } from "@/lib/discovery/production-queue";
import { buildPageFactoryQueue } from "@/lib/discovery/page-factory";
import { buildResearchVerificationQueue, verifyPageResearch } from "@/lib/discovery/research-verification";
import { collectResearchQueue } from "@/lib/discovery/research-collectors";
import { normalizeAndMergeLeads } from "@/lib/discovery/evidence-normalizer";
import { buildClaimVerificationPortfolio } from "@/lib/discovery/claim-verifier";
import { buildSafeCopyPortfolio } from "@/lib/discovery/safe-copy-composer";
import { buildPageAssemblyPortfolio } from "@/lib/discovery/page-assembly";
import { buildRenderPublishPortfolio } from "@/lib/discovery/render-publish";
import { buildLearningPortfolio } from "@/lib/discovery/learning-feedback";
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
      return buildThemeJourney({ theme: decision.theme, decision, destinations: destination?.domains ?? [] });
    });
    const interceptPlan = buildInterceptPortfolio(portfolio);
    const opportunityGaps = buildOpportunityGapPortfolio(decisions.map((decision) => ({
      decision,
      destination: destinationCapture.themes.find((item) => item.theme === decision.theme),
    })));
    const productionQueue = buildProductionQueue({ universe: parisUncoveredUniverse, gaps: opportunityGaps, decisions, maxReady: 20 });
    const pageFactory = buildPageFactoryQueue(productionQueue);
    const researchQueue = buildResearchVerificationQueue(pageFactory);
    const researchCollector = await collectResearchQueue(researchQueue.map((item) => item.packet), 2);

    const candidatePortfolio = researchCollector.map((collection) => {
      const candidates = normalizeAndMergeLeads(collection.leads);
      const claimVerification = buildClaimVerificationPortfolio(candidates);
      const safeCopy = buildSafeCopyPortfolio(candidates, claimVerification);
      const page = pageFactory.find((item) => item.id === collection.packet.pageId);
      const verification = page ? verifyPageResearch(page, candidates) : undefined;
      return {
        pageId: collection.packet.pageId,
        theme: collection.packet.theme,
        leadCount: collection.leadCount,
        candidateCount: candidates.length,
        candidates,
        claimVerification,
        safeCopy,
        verification,
      };
    });

    const pageAssembly = buildPageAssemblyPortfolio(
      pageFactory,
      candidatePortfolio.map((item) => ({ pageId: item.pageId, safeCopies: item.safeCopy, verification: item.verification })),
    );
    const renderPublish = buildRenderPublishPortfolio(pageAssembly);
    const learning = buildLearningPortfolio(renderPublish, []);
    const universeKeywords = flattenUniverse(parisUncoveredUniverse);

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      architecture: ["DEMAND", "DESTINATION", "OPPORTUNITY_GAP", "THEME_RESOLVER", "PRODUCTION_QUEUE", "PAGE_FACTORY", "RESEARCH_COLLECTOR", "EVIDENCE_NORMALIZER", "CANDIDATE_MERGER", "SOURCE_REPUTATION", "CONFLICT_STALENESS", "CLAIM_LEVEL_VERIFIER", "SAFE_COPY_COMPOSER", "PAGE_ASSEMBLY", "RENDER_PUBLISH", "LEARNING_FEEDBACK", "RESEARCH_VERIFICATION", "VELVET_JOURNEY", "INTERCEPT"],
      measurementRules: {
        demand: "MEASURED only when a volume source such as Keyword Planner or equivalent supplies numeric demand.",
        destination: "ESTIMATED from observed public SERP rank visibility. Click share remains unknown until a real clickstream/owned source exists.",
        opportunityGap: "Score combines relative demand, Velvet fit, intent, observed SERP weakness and commercial saturation. Confidence is reported separately and low-confidence gaps cannot become BUILD_IMMEDIATELY.",
        themeResolver: "Raw Radar themes are preserved, while production uses a canonical theme when an exact or controlled alias mapping exists. Unresolved themes remain visible as research tests rather than disappearing.",
        productionQueue: "Only BUILD_IMMEDIATELY and BUILD_NEXT themes become READY. TEST_FIRST themes become VALIDATE and missing evidence never becomes an automatic production order.",
        pageFactory: "The factory may generate page structure, SEO fields, CTA routing and tracking automatically. Specific discoveries and factual claims remain RESEARCH_REQUIRED until verified; such pages stay noindex.",
        researchCollector: "Free public collectors return research leads from Wikimedia, OpenStreetMap, official-domain search and editorial search. Leads are evidence candidates only.",
        evidenceNormalizer: "Leads are merged conservatively using name similarity, address agreement and geospatial proximity. Raw snippets remain candidate claims only; the normalizer no longer assigns editorial Velvet fit or factual truth.",
        sourceReputation: "Source authority is fact-domain specific. Official sources are preferred for operational facts, map sources for identity/location, and editorial sources remain supporting context rather than universal authority.",
        conflictStaleness: "Contradictory operational evidence creates CONFLICTED status and stale-only evidence creates STALE status. Both are non-publishable until refreshed or resolved.",
        claimLevelVerifier: "Every factual claim is evaluated independently. High-risk claims such as hours, prices, access, secrecy, popularity and atmosphere need stronger, fresher and domain-appropriate evidence. Non-verified claims are excluded from publishable copy.",
        safeCopyComposer: "Copy is generated strictly from VERIFIED publishable claims. Excluded claims cannot be paraphrased or reintroduced. Every factual sentence retains source IDs and URLs for auditability.",
        pageAssembly: "Page Factory structure and Safe Copy blocks are assembled only after verification. Indexing opens only when the page verification status is PUBLISHABLE, at least five discoveries have READY safe copy and a source audit trail exists; otherwise the assembled page remains noindex.",
        renderPublish: "Render manifests default to PREVIEW/noindex. PUBLIC/index is allowed only when the assembled page is READY_TO_RENDER, at least five READY discoveries remain, source audit exists and the indexing gate is already open. The render layer cannot override an upstream gate.",
        learningFeedback: "Learning uses measured first-party outcomes only. Small samples cannot amplify or suppress a theme. Purchases and revenue outweigh CTA, engagement and CTR when commerce data exists. Missing performance data returns NO_DATA rather than a synthetic score.",
        researchVerification: "Publication requires at least five VERIFIED discoveries. Each VERIFIED discovery needs at least two independent sources; an official source plus an independent source is preferred. Time-sensitive facts must be current. Empty or missing evidence never becomes publishable.",
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
      pageFactory,
      researchCollector,
      candidatePortfolio,
      pageAssembly,
      renderPublish,
      learning,
      researchVerification: researchQueue,
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
        pageResearchRequired: pageFactory.filter((item) => item.status === "RESEARCH_REQUIRED").length,
        pagePublishableStructure: pageFactory.filter((item) => item.status === "PUBLISHABLE_STRUCTURE").length,
        pageHold: pageFactory.filter((item) => item.status === "HOLD").length,
        researchPacketsCollected: researchCollector.length,
        researchLeadsCollected: researchCollector.reduce((sum, item) => sum + item.leadCount, 0),
        mergedCandidates: candidatePortfolio.reduce((sum, item) => sum + item.candidateCount, 0),
        mergedHighConfidence: candidatePortfolio.reduce((sum, item) => sum + item.candidates.filter((candidate) => candidate.mergeConfidence === "HIGH").length, 0),
        verifiedClaims: candidatePortfolio.reduce((sum, item) => sum + item.claimVerification.reduce((inner, result) => inner + result.publishableClaims.length, 0), 0),
        excludedClaims: candidatePortfolio.reduce((sum, item) => sum + item.claimVerification.reduce((inner, result) => inner + result.excludedClaims.length, 0), 0),
        conflictedClaims: candidatePortfolio.reduce((sum, item) => sum + item.claimVerification.reduce((inner, result) => inner + result.conflicts, 0), 0),
        staleClaims: candidatePortfolio.reduce((sum, item) => sum + item.claimVerification.reduce((inner, result) => inner + result.staleClaims, 0), 0),
        safeCopyCandidates: candidatePortfolio.reduce((sum, item) => sum + item.claimVerification.filter((result) => result.candidateSafeForCopy).length, 0),
        safeCopyReady: candidatePortfolio.reduce((sum, item) => sum + item.safeCopy.filter((result) => result.status === "READY").length, 0),
        safeCopyPartial: candidatePortfolio.reduce((sum, item) => sum + item.safeCopy.filter((result) => result.status === "PARTIAL").length, 0),
        safeCopyHold: candidatePortfolio.reduce((sum, item) => sum + item.safeCopy.filter((result) => result.status === "HOLD").length, 0),
        assemblyReadyToRender: pageAssembly.filter((item) => item.status === "READY_TO_RENDER").length,
        assemblyDraftNoIndex: pageAssembly.filter((item) => item.status === "DRAFT_NO_INDEX").length,
        assemblyHold: pageAssembly.filter((item) => item.status === "HOLD").length,
        renderPublic: renderPublish.filter((item) => item.mode === "PUBLIC").length,
        renderPreview: renderPublish.filter((item) => item.mode === "PREVIEW").length,
        renderBlocked: renderPublish.filter((item) => item.mode === "BLOCKED").length,
        publishAllowed: renderPublish.filter((item) => item.publishDecision === "PUBLISH_ALLOWED").length,
        learningMeasured: learning.scores.filter((item) => item.status === "MEASURED").length,
        learningInsufficient: learning.scores.filter((item) => item.status === "INSUFFICIENT").length,
        learningNoData: learning.scores.filter((item) => item.status === "NO_DATA").length,
        learningAmplify: learning.scores.filter((item) => item.action === "AMPLIFY").length,
        learningOptimize: learning.scores.filter((item) => item.action === "OPTIMIZE").length,
        learningDeprioritize: learning.scores.filter((item) => item.action === "DEPRIORITIZE").length,
        verificationPublishable: candidatePortfolio.filter((item) => item.verification?.status === "PUBLISHABLE").length,
        verificationResearchRequired: candidatePortfolio.filter((item) => item.verification?.status === "RESEARCH_REQUIRED").length,
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
