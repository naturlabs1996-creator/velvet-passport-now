import type { FirstPartyPerformance } from "./learning-feedback";
import type { PerformanceSnapshot } from "./performance-memory";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://kbceicncyhjbegdbjhxl.supabase.co";
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_QcO_SHeSjxJqu88Cw36gVw_xtKFB-hl";

type AggregateRow = {
  page: string | null;
  theme: string;
  window_days: number;
  measured_at: string;
  page_views: number | string;
  primary_cta_clicks: number | string;
  secondary_cta_clicks: number | string;
  product_starts: number | string;
  engaged_events: number | string;
  store_selections: number | string;
  now_interest_events: number | string;
};

type HistoryRow = Omit<AggregateRow, "window_days" | "measured_at"> & {
  period_start: string;
  period_end: string;
};

export type FirstPartyAvailability = {
  velvetEvents: "AVAILABLE" | "UNAVAILABLE";
  searchConsole: "AVAILABLE" | "UNAVAILABLE";
  commerce: "AVAILABLE" | "UNAVAILABLE";
  reasons: string[];
};

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T[]> {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: supabasePublishableKey,
      authorization: `Bearer ${supabasePublishableKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`${name}_http_${response.status}`);
  return await response.json() as T[];
}

function performance(row: AggregateRow): FirstPartyPerformance {
  return {
    pageId: row.page || row.theme,
    theme: row.theme,
    windowDays: numeric(row.window_days),
    measuredAt: row.measured_at,
    pageViews: numeric(row.page_views),
    primaryCtaClicks: numeric(row.primary_cta_clicks),
    secondaryCtaClicks: numeric(row.secondary_cta_clicks),
    productStarts: numeric(row.product_starts),
    source: "VELVET_EVENTS",
  };
}

export async function readVelvetFirstPartyPerformance(windowDays = 30) {
  const rows = await rpc<AggregateRow>("vp_get_discovery_performance", { p_window_days: windowDays });
  return rows.filter((row) => row.theme !== "unknown").map(performance);
}

export async function readVelvetPerformanceHistory(weeks = 12): Promise<PerformanceSnapshot[]> {
  const rows = await rpc<HistoryRow>("vp_get_discovery_performance_history", { p_weeks: weeks });
  return rows.filter((row) => row.theme !== "unknown").map((row) => ({
    pageId: row.page || row.theme,
    theme: row.theme,
    windowDays: 7,
    measuredAt: row.period_end,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    pageViews: numeric(row.page_views),
    primaryCtaClicks: numeric(row.primary_cta_clicks),
    secondaryCtaClicks: numeric(row.secondary_cta_clicks),
    productStarts: numeric(row.product_starts),
    source: "VELVET_EVENTS",
  }));
}

export async function readFirstPartyBundle() {
  const reasons: string[] = [];
  try {
    const [performanceRows, performanceHistory] = await Promise.all([
      readVelvetFirstPartyPerformance(30),
      readVelvetPerformanceHistory(12),
    ]);
    reasons.push("Velvet event aggregation is connected to Supabase and returns only cohort-level metrics.");
    reasons.push("Search Console is not connected, so impressions and search clicks remain unavailable.");
    reasons.push("No Velvet-attributable commerce source is connected; purchases and revenue remain unavailable rather than inferred from store clicks.");
    return {
      performanceRows,
      performanceHistory,
      availability: { velvetEvents: "AVAILABLE", searchConsole: "UNAVAILABLE", commerce: "UNAVAILABLE", reasons } satisfies FirstPartyAvailability,
    };
  } catch (error) {
    reasons.push(error instanceof Error ? error.message : "first_party_read_failed");
    reasons.push("First-party read failure is treated as unavailable data, never as zero performance.");
    return {
      performanceRows: [] as FirstPartyPerformance[],
      performanceHistory: [] as PerformanceSnapshot[],
      availability: { velvetEvents: "UNAVAILABLE", searchConsole: "UNAVAILABLE", commerce: "UNAVAILABLE", reasons } satisfies FirstPartyAvailability,
    };
  }
}
