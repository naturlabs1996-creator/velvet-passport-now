import type { FirstPartyPerformance } from "./learning-feedback";

export type Trajectory = "EMERGING" | "ACCELERATING" | "PLATEAU" | "DECLINING" | "SEASONAL_CANDIDATE" | "INSUFFICIENT_HISTORY";
export type MemoryConfidence = "HIGH" | "MEDIUM" | "LOW" | "NONE";

export type PerformanceSnapshot = FirstPartyPerformance & {
  periodStart: string;
  periodEnd: string;
};

export type PerformanceMemory = {
  pageId: string;
  theme: string;
  trajectory: Trajectory;
  confidence: MemoryConfidence;
  samples: number;
  observedDays: number;
  latestScore: number | null;
  priorScore: number | null;
  delta: number | null;
  reasons: string[];
  safeguards: string[];
};

function rate(numerator?: number, denominator?: number) {
  if (typeof numerator !== "number" || typeof denominator !== "number" || denominator <= 0) return undefined;
  return numerator / denominator;
}

function outcomeScore(row: FirstPartyPerformance) {
  const ctr = rate(row.searchClicks, row.impressions);
  const engagement = rate(row.engagedSessions, row.pageViews);
  const cta = rate(row.primaryCtaClicks, row.pageViews);
  const purchase = rate(row.purchases, row.productStarts ?? row.primaryCtaClicks);
  const revenuePerView = rate(row.revenue, row.pageViews);

  const parts: Array<[number | undefined, number, number]> = [
    [ctr, 0.12, 1000],
    [engagement, 0.18, 125],
    [cta, 0.25, 800],
    [purchase, 0.35, 1000],
    [revenuePerView, 0.1, 50],
  ];

  let score = 0;
  let weight = 0;
  for (const [value, partWeight, scale] of parts) {
    if (typeof value !== "number") continue;
    score += Math.min(100, value * scale) * partWeight;
    weight += partWeight;
  }
  return weight ? Math.max(0, Math.min(100, Math.round(score / weight))) : null;
}

function daysBetween(a: string, b: string) {
  const start = new Date(a).getTime();
  const end = new Date(b).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

function confidence(samples: number, days: number, totalViews: number, purchases: number): MemoryConfidence {
  if (samples >= 8 && days >= 56 && (totalViews >= 2000 || purchases >= 20)) return "HIGH";
  if (samples >= 5 && days >= 28 && (totalViews >= 750 || purchases >= 8)) return "MEDIUM";
  if (samples >= 3 && days >= 14 && totalViews >= 250) return "LOW";
  return "NONE";
}

export function buildPerformanceMemory(history: PerformanceSnapshot[]): PerformanceMemory[] {
  const grouped = new Map<string, PerformanceSnapshot[]>();
  for (const row of history) {
    const key = `${row.pageId}::${row.theme}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(row);
    grouped.set(key, bucket);
  }

  return [...grouped.values()].map((rows) => {
    rows.sort((a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime());
    const first = rows[0];
    const last = rows[rows.length - 1];
    const days = daysBetween(first.periodStart, last.periodEnd);
    const scores = rows.map(outcomeScore).filter((value): value is number => typeof value === "number");
    const latestScore = scores.length ? scores[scores.length - 1] : null;
    const priorScore = scores.length >= 2 ? scores[scores.length - 2] : null;
    const delta = latestScore !== null && priorScore !== null ? latestScore - priorScore : null;
    const totalViews = rows.reduce((sum, row) => sum + (row.pageViews ?? 0), 0);
    const purchases = rows.reduce((sum, row) => sum + (row.purchases ?? 0), 0);
    const memoryConfidence = confidence(rows.length, days, totalViews, purchases);
    const reasons: string[] = [];

    let trajectory: Trajectory = "INSUFFICIENT_HISTORY";
    if (rows.length >= 3 && scores.length >= 3) {
      const recent = scores.slice(-3);
      const d1 = recent[1] - recent[0];
      const d2 = recent[2] - recent[1];
      if (d1 >= 8 && d2 >= 8) {
        trajectory = "ACCELERATING";
        reasons.push("Three consecutive measured periods show material score acceleration.");
      } else if (d1 >= 5 || d2 >= 5) {
        trajectory = "EMERGING";
        reasons.push("Recent measured performance is improving, but the trend is not yet strong enough for acceleration classification.");
      } else if (d1 <= -8 && d2 <= -8) {
        trajectory = "DECLINING";
        reasons.push("Three consecutive measured periods show material deterioration.");
      } else if (Math.max(...recent) - Math.min(...recent) <= 6) {
        trajectory = "PLATEAU";
        reasons.push("Recent measured periods are stable within a narrow performance band.");
      }
    }

    if (rows.length >= 8 && days >= 56 && trajectory === "PLATEAU") {
      const viewSeries = rows.map((row) => row.pageViews ?? 0);
      const alternating = viewSeries.slice(2).filter((value, index) => {
        const prev2 = viewSeries[index];
        const baseline = Math.max(1, prev2);
        return Math.abs(value - prev2) / baseline <= 0.25;
      }).length;
      if (alternating >= Math.floor((viewSeries.length - 2) * 0.6)) {
        trajectory = "SEASONAL_CANDIDATE";
        reasons.push("A repeating exposure pattern is visible, but seasonality remains a hypothesis until a longer cycle exists.");
      }
    }

    if (trajectory === "INSUFFICIENT_HISTORY") reasons.push("Not enough measured periods exist to classify a reliable trajectory.");

    return {
      pageId: first.pageId,
      theme: first.theme,
      trajectory,
      confidence: memoryConfidence,
      samples: rows.length,
      observedDays: days,
      latestScore,
      priorScore,
      delta,
      reasons,
      safeguards: [
        "Trajectory classification never substitutes for factual verification or publication safety gates.",
        "Seasonality is labeled candidate until enough historical cycles exist.",
        "Small samples cannot create acceleration or decline decisions.",
      ],
    };
  });
}
