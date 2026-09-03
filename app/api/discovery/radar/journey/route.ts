import { NextResponse } from "next/server";
import { collectFirstRadarSources } from "@/lib/discovery/radar-collectors";
import { collectBuyRadarSources } from "@/lib/discovery/radar-buy-collectors";
import { collectDestinationCapture } from "@/lib/discovery/destination-capture";
import { buildVelvetDecisions } from "@/lib/discovery/decision-engine";
import { buildThemeJourney } from "@/lib/discovery/demand-journey";
import { buildInterceptPortfolio } from "@/lib/discovery/intercept-engine";
import { buildOpportunityGapPortfolio } from "@/lib/discovery/opportunity-gap";
import { buildGemPortfolio, GEM_FILTER_RULES } from "@/lib/discovery/gem-filter";
import { resolveDemandVolume } from "@/lib/discovery/demand-volume-resolver";
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
import { readFirstPartyBundle } from "@/lib/discovery/first-party-performance";
import { runPredatorCore } from "@/lib/discovery/predator-core";
import { emptyDemandRows, flattenUniverse, parisUncoveredUniverse } from "@/lib/discovery/search-demand";
import { runPublicationCanary } from "@/lib/discovery/publication-canary";
import { runResearchQualityAudit } from "@/lib/discovery/research-quality-audit";

export async function GET() {
  try {
    const [coreSources, buySources, destinationCapture, firstParty] = await Promise.all([
      collectFirstRadarSources(), collectBuyRadarSources(), collectDestinationCapture(parisUncoveredUniverse), readFirstPartyBundle(),
    ]);
    const signals = [...coreSources.flatMap((result) => result.normalized), ...buySources.flatMap((result) => result.normalized)];
    const buyHealth = buySources.map((result) => ({ source: result.source, available: result.ok, matchedThemes: [...new Set(result.normalized.map((signal) => signal.theme))] }));
    const demandRows = emptyDemandRows(parisUncoveredUniverse); const demandVolume = resolveDemandVolume(parisUncoveredUniverse, demandRows); const demandByTheme = new Map(demandVolume.themes.map((item) => [item.theme, item]));
    const decisions = buildVelvetDecisions(signals, buyHealth);
    const portfolio = decisions.map((decision) => { const destination = destinationCapture.themes.find((item) => item.theme === decision.theme); return buildThemeJourney({ theme: decision.theme, decision, demand: demandByTheme.get(decision.theme), destinations: destination?.domains ?? [] }); });
    const interceptPlan = buildInterceptPortfolio(portfolio);
    const opportunityGaps = buildOpportunityGapPortfolio(decisions.map((decision) => ({ decision, destination: destinationCapture.themes.find((item) => item.theme === decision.theme), demand: demandByTheme.get(decision.theme) })));
    const gemPortfolio = buildGemPortfolio(opportunityGaps); const gemRank = new Map(gemPortfolio.map((item, index) => [item.theme, index]));
    const productionQueue = buildProductionQueue({ universe: parisUncoveredUniverse, gaps: opportunityGaps, decisions, maxReady: 20 }); const pageFactory = buildPageFactoryQueue(productionQueue);
    const researchQueue = buildResearchVerificationQueue(pageFactory).sort((a, b) => (gemRank.get(a.packet.theme) ?? 999) - (gemRank.get(b.packet.theme) ?? 999));
    const researchCollector = await collectResearchQueue(researchQueue.map((item) => item.packet), {
      maxPackets: 2, maxCollectorsPerPacket: 4, maxLeadsPerCollector: 8, maxScentQueries: 6, maxPlaceLookups: 24, maxIntentLookups: 16, maxSourcePages: 12, maxHistoryLookups: 10, concurrency: 2,
    });

    const candidatePortfolio = researchCollector.map((collection) => {
      const candidates = normalizeAndMergeLeads(collection.leads); const claimVerification = buildClaimVerificationPortfolio(candidates); const safeCopy = buildSafeCopyPortfolio(candidates, claimVerification); const page = pageFactory.find((item) => item.id === collection.packet.pageId); const verification = page ? verifyPageResearch(page, candidates) : undefined;
      return { pageId: collection.packet.pageId, theme: collection.packet.theme, leadCount: collection.leadCount, candidateCount: candidates.length, candidates, claimVerification, safeCopy, verification };
    });

    const pageAssembly = buildPageAssemblyPortfolio(pageFactory, candidatePortfolio.map((item) => ({ pageId: item.pageId, safeCopies: item.safeCopy, verification: item.verification })));
    const publicationCanary = pageAssembly.map((assembly) => {
      const candidate = candidatePortfolio.find((item) => item.pageId === assembly.pageId);
      return runPublicationCanary({ assembly, verification: candidate?.verification, safeCopies: candidate?.safeCopy ?? [] });
    });
    const renderPublish = buildRenderPublishPortfolio(pageAssembly);
    const pageVerifications = candidatePortfolio.flatMap((item) => item.verification ? [item.verification] : []);
    const researchQualityAudit = runResearchQualityAudit({ researchCollections: researchCollector, claimPortfolios: candidatePortfolio.map((item) => item.claimVerification), safeCopyPortfolios: candidatePortfolio.map((item) => item.safeCopy), pageVerifications });
    const controlledPublicationAttempt = publicationCanary.map((canary) => {
      const render = renderPublish.find((item) => item.pageId === canary.pageId);
      const eligible = canary.eligibleForPublic && researchQualityAudit.status === "PASS" && render?.mode === "PUBLIC";
      return { pageId: canary.pageId, theme: canary.theme, result: eligible ? "ELIGIBLE_CONTROLLED_PUBLICATION" as const : "BLOCKED_BY_GATES" as const, publicMutationPerformed: false, branchOnly: true, blockers: [...canary.blockers, ...(researchQualityAudit.status === "PASS" ? [] : ["RESEARCH_QUALITY_AUDIT_FAILED"]), ...(render?.mode === "PUBLIC" ? [] : ["RENDER_NOT_PUBLIC"])] };
    });

    const pageIdForTheme = new Map(pageFactory.map((item) => [item.theme, item.id]));
    const performanceRows = firstParty.performanceRows.map((row) => ({ ...row, pageId: pageIdForTheme.get(row.theme) ?? row.pageId }));
    const performanceHistory = firstParty.performanceHistory.map((row) => ({ ...row, pageId: pageIdForTheme.get(row.theme) ?? row.pageId }));
    const learning = buildLearningPortfolio(renderPublish, performanceRows); const safeCopyByTheme = Object.fromEntries(candidatePortfolio.map((item) => [item.theme, item.safeCopy]));
    const predatorCore = runPredatorCore({ opportunityGaps, learning: learning.scores, performanceRows, performanceHistory, safeCopyByTheme }); const universeKeywords = flattenUniverse(parisUncoveredUniverse);

    const blockReadiness = {
      block1HumanFacingClaimExtractor: "IMPLEMENTED",
      block2RealClaimVerification: "IMPLEMENTED",
      block3ExposureBeforeRelevance: "IMPLEMENTED",
      block4FiveVerifiedSamePage: pageVerifications.some((item) => item.usableDiscoveries.length >= 5) ? "PASSED" : "GATED",
      block5FiveReadySafeCopy: candidatePortfolio.some((item) => item.safeCopy.filter((copy) => copy.status === "READY").length >= 5) ? "PASSED" : "GATED",
      block6ControlledPreviewCanary: publicationCanary.length > 0 ? "EXECUTED" : "NOT_EXECUTED",
      block7MultiThemeFalsePositiveAudit: researchQualityAudit.status,
      block8ControlledPublicationAttempt: controlledPublicationAttempt.some((item) => item.result === "ELIGIBLE_CONTROLLED_PUBLICATION") ? "ELIGIBLE" : "BLOCKED_SAFELY",
    };

    return NextResponse.json({
      ok: true, generatedAt: new Date().toISOString(),
      architecture: [
        "DEMAND", "DEMAND_VOLUME_RESOLVER", "DESTINATION", "OPPORTUNITY_GAP", "GEM_FILTER", "THEME_RESOLVER", "PRODUCTION_QUEUE", "PAGE_FACTORY", "SCENT_EXPANDER", "DEEP_RESEARCH_COLLECTOR_V2",
        "PLACE_ENTITY_EXTRACTION", "PLACE_RESOLVER", "DESTINATION_ENTITY_LOCK", "DEEP_EVIDENCE_FETCHER", "CONTEXT_WINDOW_VERIFIER", "FOCUSED_INTENT_EVIDENCE_V2", "INDEPENDENT_EVIDENCE_HUNTER", "CLAIM_EQUIVALENCE", "HISTORY_EVIDENCE", "EXPOSURE_INTELLIGENCE", "RESEARCH_RELEVANCE",
        "EVIDENCE_NORMALIZER", "CANDIDATE_MERGER", "HUMAN_FACING_CLAIM_EXTRACTOR", "SOURCE_REPUTATION", "CONFLICT_STALENESS", "INTERNAL_CLAIM_FIREWALL", "CLAIM_LEVEL_VERIFIER", "SAFE_COPY_COMPOSER", "PAGE_ASSEMBLY", "RESEARCH_QUALITY_AUDIT", "PUBLICATION_CANARY", "RENDER_PUBLISH", "FIRST_PARTY_AGGREGATION",
        "PERFORMANCE_MEMORY", "LEARNING_FEEDBACK", "BEHAVIOR_PREDICTION", "PRECISION_TARGETING", "TARGET_REFINEMENT", "SPEED_CONTROLLER", "SMART_CACHE_POLICY", "ADAPTIVE_TARGET_BUDGETS", "DYNAMIC_REALLOCATION", "RESOURCE_ALLOCATION", "EXPERIMENT_ENGINE", "CREATIVE_STRIKE_ENGINE", "RESEARCH_VERIFICATION", "VELVET_JOURNEY", "INTERCEPT",
      ],
      measurementRules: {
        demand: "MEASURED only when a volume source such as Keyword Planner or equivalent supplies numeric demand.", demandVolume: "Suggestions, SERP counts and source recurrence can guide relative prioritization but cannot manufacture monthly search volume.", destination: "ESTIMATED from observed public SERP rank visibility. Click share remains unknown until a real clickstream/owned source exists.", opportunityGap: "Score combines relative demand, Velvet fit, intent, observed SERP weakness and commercial saturation. Confidence is reported separately and low-confidence gaps cannot become BUILD_IMMEDIATELY.", gemFilter: "A priority gem requires measured absolute search volume plus strong relevance, rarity/opportunity scarcity and commercial potential. Unknown volume can never create PRIORITY_GEM status.", deepResearch: "Collector V2 expands semantic scent queries and strengthens trails that recur across independent sources or query variants; recurrence never upgrades a factual claim to VERIFIED.", firstParty: "Velvet event metrics are aggregated in Supabase by page/theme. Individual event rows are not returned to Predator. Missing Search Console or commerce data remains unavailable rather than inferred.", learningFeedback: "Learning uses measured first-party outcomes only. Small samples cannot amplify or suppress a theme. Purchases and revenue receive weight only when an attributable commerce source exists.", performanceMemory: "Long-horizon memory uses real weekly aggregate snapshots, not overlapping cumulative windows. Insufficient history remains INSUFFICIENT_HISTORY.", behaviorPrediction: "Behavior prediction uses aggregate first-party cohorts only and cannot infer sensitive traits or claim certainty about an individual.", predatorCore: "Targeting, adaptive budgets, reallocation, experiments and creative strikes consume measured evidence while preserving all verification, privacy, publication and paid-spend gates.", researchVerification: "Publication requires at least five VERIFIED discoveries. Each VERIFIED discovery needs at least two canonical independent publisher families supporting human-facing claims; time-sensitive facts must be current.", velvetJourney: "MEASURED only from first-party Velvet events, Search Console or attributable commerce inputs.", intercept: "FREE channels first. Paid retargeting remains HOLD until first-party intent is measured and spend is explicitly authorized.",
      },
      readiness: blockReadiness,
      qualitySummary: {
        auditStatus: researchQualityAudit.status,
        auditErrors: researchQualityAudit.errors,
        auditedThemes: researchQualityAudit.auditedThemes,
        canaryPassed: publicationCanary.filter((item) => item.eligibleForPublic).length,
        canaryBlocked: publicationCanary.filter((item) => !item.eligibleForPublic).length,
        maxVerifiedDiscoveriesOnOnePage: Math.max(0, ...pageVerifications.map((item) => item.usableDiscoveries.length)),
        maxReadySafeCopyOnOnePage: Math.max(0, ...candidatePortfolio.map((item) => item.safeCopy.filter((copy) => copy.status === "READY").length)),
        controlledPublicationEligible: controlledPublicationAttempt.filter((item) => item.result === "ELIGIBLE_CONTROLLED_PUBLICATION").length,
      },
      publicationCanary, researchQualityAudit, controlledPublicationAttempt,
      demandVolume,
      firstParty: { availability: firstParty.availability, currentRows: performanceRows.length, historicalSnapshots: performanceHistory.length, rows: performanceRows },
      universe: { id: parisUncoveredUniverse.id, city: parisUncoveredUniverse.city, product: parisUncoveredUniverse.product, themes: parisUncoveredUniverse.themes.length, keywordCount: universeKeywords.length, keywords: demandRows },
      destinationCapture: { source: destinationCapture.source, measurement: destinationCapture.measurement, note: destinationCapture.note, keywordCount: destinationCapture.keywordCount, resultCount: destinationCapture.resultCount, themes: destinationCapture.themes },
      opportunityGaps, gemFilter: { rules: GEM_FILTER_RULES, portfolio: gemPortfolio }, productionQueue, pageFactory, researchCollector, candidatePortfolio, pageAssembly, renderPublish, learning, predatorCore, researchVerification: researchQueue,
      summary: {
        themes: portfolio.length, actionable: portfolio.filter((item) => item.readiness === "ACTIONABLE").length, partial: portfolio.filter((item) => item.readiness === "PARTIAL").length, insufficient: portfolio.filter((item) => item.readiness === "INSUFFICIENT").length, missingSearchVolume: portfolio.filter((item) => item.gaps.includes("SEARCH_VOLUME")).length, measuredDemandThemes: demandVolume.measuredThemes, missingDestinationCapture: portfolio.filter((item) => item.gaps.includes("DESTINATION_CAPTURE")).length, missingFirstPartyJourney: portfolio.filter((item) => item.gaps.includes("FIRST_PARTY_JOURNEY")).length, firstPartyRows: performanceRows.length, firstPartyHistorySnapshots: performanceHistory.length,
        buildImmediately: opportunityGaps.filter((item) => item.action === "BUILD_IMMEDIATELY").length, buildNext: opportunityGaps.filter((item) => item.action === "BUILD_NEXT").length, testFirst: opportunityGaps.filter((item) => item.action === "TEST_FIRST").length, priorityGems: gemPortfolio.filter((item) => item.classification === "PRIORITY_GEM").length, gemTests: gemPortfolio.filter((item) => item.classification === "TEST").length, gemUnknownVolume: gemPortfolio.filter((item) => item.classification === "HOLD_UNKNOWN_VOLUME").length, productionReady: productionQueue.filter((item) => item.status === "READY").length, productionValidate: productionQueue.filter((item) => item.status === "VALIDATE").length,
        researchPacketsCollected: researchCollector.length, researchScentQueries: researchCollector.reduce((sum, item) => sum + item.scentTrail.queryCount, 0), researchLeadsCollected: researchCollector.reduce((sum, item) => sum + item.leadCount, 0), recurringTrails: researchCollector.reduce((sum, item) => sum + item.trailSignals.filter((trail) => trail.independentSources >= 2 || trail.queryVariants >= 2).length, 0), mergedCandidates: candidatePortfolio.reduce((sum, item) => sum + item.candidateCount, 0), verifiedClaims: candidatePortfolio.reduce((sum, item) => sum + item.claimVerification.reduce((inner, result) => inner + result.publishableClaims.length, 0), 0), conflictedClaims: candidatePortfolio.reduce((sum, item) => sum + item.claimVerification.reduce((inner, result) => inner + result.conflicts, 0), 0), staleClaims: candidatePortfolio.reduce((sum, item) => sum + item.claimVerification.reduce((inner, result) => inner + result.staleClaims, 0), 0), safeCopyReady: candidatePortfolio.reduce((sum, item) => sum + item.safeCopy.filter((result) => result.status === "READY").length, 0), renderPublic: renderPublish.filter((item) => item.mode === "PUBLIC").length, renderPreview: renderPublish.filter((item) => item.mode === "PREVIEW").length,
        learningMeasured: learning.scores.filter((item) => item.status === "MEASURED").length, learningInsufficient: learning.scores.filter((item) => item.status === "INSUFFICIENT").length, learningNoData: learning.scores.filter((item) => item.status === "NO_DATA").length, lockedTargets: predatorCore.summary.lockedTargets, superchargedTargets: predatorCore.summary.superchargedTargets, reallocationReceivers: predatorCore.summary.reallocationReceivers, reallocatedUnits: predatorCore.summary.reallocatedUnits, strikesReadyToTest: predatorCore.summary.strikesReadyToTest, freeInterceptActions: interceptPlan.filter((item) => item.costMode === "FREE").length, paidOptionalActions: interceptPlan.filter((item) => item.costMode === "PAID_OPTIONAL").length,
      },
      portfolio, interceptPlan,
    });
  } catch (error) {
    console.error("VELVET_DEMAND_JOURNEY_ERROR", error);
    return NextResponse.json({ ok: false, error: "demand_journey_failed" }, { status: 500 });
  }
}
