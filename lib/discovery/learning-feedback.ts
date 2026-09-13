import type { RenderManifest } from "./render-publish";

export type LearningEvidenceStatus = "MEASURED" | "INSUFFICIENT" | "NO_DATA";
export type LearningAction = "AMPLIFY" | "OPTIMIZE" | "KEEP_LEARNING" | "DEPRIORITIZE" | "NO_ACTION";

export type FirstPartyPerformance = {
  pageId: string;
  theme: string;
  windowDays: number;
  measuredAt: string;
  impressions?: number;
  searchClicks?: number;
  pageViews?: number;
  engagedSessions?: number;
  primaryCtaClicks?: number;
  secondaryCtaClicks?: number;
  productStarts?: number;
  purchases?: number;
  revenue?: number;
  source: "SEARCH_CONSOLE" | "VELVET_EVENTS" | "COMMERCE" | "COMBINED";
};

export type LearningScore = {
  pageId: string;
  theme: string;
  status: LearningEvidenceStatus;
  action: LearningAction;
  performanceScore?: number;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  metrics: {
    ctr?: number;
    engagementRate?: number;
    primaryCtaRate?: number;
    purchaseRate?: number;
    revenuePerView?: number;
  };
  reasons: string[];
  recommendedAdjustments: string[];
};

export type LearningPortfolio = {
  generatedAt: string;
  scores: LearningScore[];
  amplifyThemes: string[];
  optimizeThemes: string[];
  deprioritizeThemes: string[];
  rules: string[];
};

function rate(numerator?: number, denominator?: number) {
  if (typeof numerator !== "number" || typeof denominator !== "number" || denominator <= 0) return undefined;
  return numerator / denominator;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function evidenceStatus(row?: FirstPartyPerformance): LearningEvidenceStatus {
  if (!row) return "NO_DATA";
  const exposure = Math.max(row.impressions ?? 0, row.pageViews ?? 0);
  if (exposure < 50) return "INSUFFICIENT";
  return "MEASURED";
}

function confidenceFor(row?: FirstPartyPerformance): LearningScore["confidence"] {
  if (!row) return "NONE";
  const views = row.pageViews ?? 0;
  const impressions = row.impressions ?? 0;
  const purchases = row.purchases ?? 0;
  if (views >= 1000 || impressions >= 5000 || purchases >= 20) return "HIGH";
  if (views >= 250 || impressions >= 1000 || purchases >= 5) return "MEDIUM";
  if (views >= 50 || impressions >= 200) return "LOW";
  return "NONE";
}

function scoreMeasured(row: FirstPartyPerformance) {
  const ctr = rate(row.searchClicks, row.impressions);
  const engagement = rate(row.engagedSessions, row.pageViews);
  const cta = rate(row.primaryCtaClicks, row.pageViews);
  const purchase = rate(row.purchases, row.productStarts ?? row.primaryCtaClicks);
  const revenuePerView = rate(row.revenue, row.pageViews);

  let score = 0;
  let weight = 0;

  if (typeof ctr === "number") {
    score += Math.min(100, ctr * 1000) * 0.15;
    weight += 0.15;
  }
  if (typeof engagement === "number") {
    score += Math.min(100, engagement * 125) * 0.2;
    weight += 0.2;
  }
  if (typeof cta === "number") {
    score += Math.min(100, cta * 800) * 0.25;
    weight += 0.25;
  }
  if (typeof purchase === "number") {
    score += Math.min(100, purchase * 1000) * 0.3;
    weight += 0.3;
  }
  if (typeof revenuePerView === "number") {
    score += Math.min(100, revenuePerView * 50) * 0.1;
    weight += 0.1;
  }

  return {
    score: weight > 0 ? clamp(score / weight) : undefined,
    ctr,
    engagement,
    cta,
    purchase,
    revenuePerView,
  };
}

export function evaluateLearning(
  manifest: RenderManifest,
  row?: FirstPartyPerformance,
): LearningScore {
  const status = evidenceStatus(row);
  const confidence = confidenceFor(row);
  const reasons: string[] = [];
  const recommendedAdjustments: string[] = [];

  if (!row) {
    return {
      pageId: manifest.pageId,
      theme: manifest.pageId,
      status: "NO_DATA",
      action: "NO_ACTION",
      confidence: "NONE",
      metrics: {},
      reasons: ["No first-party performance row exists for this page."],
      recommendedAdjustments: ["Collect Search Console, Velvet event and commerce outcomes before changing priority."],
    };
  }

  const measured = scoreMeasured(row);

  if (status === "INSUFFICIENT") {
    reasons.push("Exposure is too small to safely change production priority.");
    return {
      pageId: manifest.pageId,
      theme: row.theme,
      status,
      action: "KEEP_LEARNING",
      confidence,
      performanceScore: measured.score,
      metrics: {
        ctr: measured.ctr,
        engagementRate: measured.engagement,
        primaryCtaRate: measured.cta,
        purchaseRate: measured.purchase,
        revenuePerView: measured.revenuePerView,
      },
      reasons,
      recommendedAdjustments: ["Keep collecting first-party outcomes; do not amplify or suppress from a small sample."],
    };
  }

  const score = measured.score ?? 0;
  let action: LearningAction = "KEEP_LEARNING";

  if (score >= 75 && confidence !== "NONE") {
    action = "AMPLIFY";
    reasons.push("Measured first-party performance is strong enough to justify additional production or distribution effort.");
    recommendedAdjustments.push("Increase production priority for this canonical theme.");
    recommendedAdjustments.push("Test adjacent intents and transfer the winning pattern to comparable cities only after preserving local research verification.");
  } else if (score >= 45) {
    action = "OPTIMIZE";
    reasons.push("The page shows useful demand or engagement but has room to improve conversion efficiency.");
    if ((measured.ctr ?? 1) < 0.03) recommendedAdjustments.push("Test title/meta alignment to the measured search intent.");
    if ((measured.engagement ?? 1) < 0.45) recommendedAdjustments.push("Improve the first answer and discovery ordering before adding more traffic.");
    if ((measured.cta ?? 1) < 0.04) recommendedAdjustments.push("Improve product-message fit after the useful answer; do not move the CTA ahead of value delivery.");
  } else if (confidence === "HIGH" || confidence === "MEDIUM") {
    action = "DEPRIORITIZE";
    reasons.push("A meaningful first-party sample is underperforming across the weighted outcome stack.");
    recommendedAdjustments.push("Reduce production priority until intent, answer quality or product fit is corrected.");
  } else {
    action = "KEEP_LEARNING";
    reasons.push("Performance is weak but confidence is not yet high enough for suppression.");
  }

  return {
    pageId: manifest.pageId,
    theme: row.theme,
    status,
    action,
    performanceScore: score,
    confidence,
    metrics: {
      ctr: measured.ctr,
      engagementRate: measured.engagement,
      primaryCtaRate: measured.cta,
      purchaseRate: measured.purchase,
      revenuePerView: measured.revenuePerView,
    },
    reasons,
    recommendedAdjustments,
  };
}

export function buildLearningPortfolio(
  manifests: RenderManifest[],
  performanceRows: FirstPartyPerformance[],
  now = new Date(),
): LearningPortfolio {
  const scores = manifests.map((manifest) => {
    const row = performanceRows.find((item) => item.pageId === manifest.pageId);
    return evaluateLearning(manifest, row);
  });

  return {
    generatedAt: now.toISOString(),
    scores,
    amplifyThemes: [...new Set(scores.filter((item) => item.action === "AMPLIFY").map((item) => item.theme))],
    optimizeThemes: [...new Set(scores.filter((item) => item.action === "OPTIMIZE").map((item) => item.theme))],
    deprioritizeThemes: [...new Set(scores.filter((item) => item.action === "DEPRIORITIZE").map((item) => item.theme))],
    rules: [
      "Learning may reprioritize production only from measured first-party outcomes; missing data is never treated as failure.",
      "Small samples remain KEEP_LEARNING and cannot trigger amplification or suppression.",
      "Purchases and revenue receive more weight than vanity engagement metrics when commerce data exists.",
      "A winning pattern may transfer to another city only as a hypothesis; local demand, evidence and verification gates still apply.",
      "Learning cannot override factual verification, Safe Copy, Page Assembly or Publish gates.",
    ],
  };
}
