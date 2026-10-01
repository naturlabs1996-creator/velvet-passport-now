import type { EvidenceStatus, SearchDemandMetric } from "./demand-journey";

export type SearchVolumeSource = "GOOGLE_KEYWORD_PLANNER" | "GOOGLE_TRENDS" | "SEARCH_CONSOLE" | "MANUAL_IMPORT";

export type KeywordDemand = {
  keyword: string;
  theme: string;
  city: string;
  language: string;
  geography: string;
  monthlySearches?: number;
  lowRange?: number;
  highRange?: number;
  trendIndex?: number;
  status: EvidenceStatus;
  source: SearchVolumeSource;
  measuredAt?: string;
};

export type KeywordUniverse = {
  id: string;
  city: string;
  product: string;
  language: string;
  geography: string;
  themes: Array<{
    theme: string;
    keywords: string[];
  }>;
};

export type SearchVolumeProvider = {
  name: SearchVolumeSource;
  collect: (universe: KeywordUniverse) => Promise<KeywordDemand[]>;
};

export const parisUncoveredUniverse: KeywordUniverse = {
  id: "paris-uncovered-en",
  city: "Paris",
  product: "paris-uncovered",
  language: "en",
  geography: "Paris/France travel demand",
  themes: [
    {
      theme: "beyond-the-classics",
      keywords: [
        "paris beyond the classics",
        "paris off the beaten path",
        "hidden places paris no tourists",
        "non touristy paris",
        "paris hidden gems",
        "unusual things to do in paris",
        "second time in paris what to do",
        "paris for repeat visitors",
      ],
    },
    {
      theme: "quiet-paris",
      keywords: [
        "quiet places paris",
        "quiet hidden places paris",
        "peaceful places paris",
        "places in paris away from crowds",
        "quiet cafes paris",
        "calm places in paris",
      ],
    },
    {
      theme: "secret-gardens",
      keywords: [
        "secret gardens paris",
        "hidden gardens paris",
        "hidden gardens near opera paris",
        "quiet gardens paris",
        "secret courtyards paris",
      ],
    },
    {
      theme: "forgotten-passages",
      keywords: [
        "hidden passages paris",
        "forgotten passages paris",
        "secret passages paris",
        "covered passages paris hidden",
      ],
    },
    {
      theme: "hidden-bookshops",
      keywords: [
        "hidden bookshops paris",
        "secret bookshops paris",
        "literary bookshops paris",
        "unusual bookstores paris",
      ],
    },
    {
      theme: "unusual-museums",
      keywords: [
        "unusual museums paris",
        "hidden museums paris",
        "small unusual museums paris",
        "weird museums paris",
      ],
    },
    {
      theme: "paris-after-dark",
      keywords: [
        "paris after dark",
        "unusual things to do in paris at night",
        "hidden paris at night",
        "what to do in paris tonight unusual",
      ],
    },
    {
      theme: "rainy-day-paris",
      keywords: [
        "hidden places paris rainy day",
        "unusual things to do in paris when it rains",
        "quiet indoor places paris",
      ],
    },
  ],
};

export function flattenUniverse(universe: KeywordUniverse) {
  return universe.themes.flatMap(({ theme, keywords }) => keywords.map((keyword) => ({
    keyword,
    theme,
    city: universe.city,
    language: universe.language,
    geography: universe.geography,
  })));
}

export function aggregateThemeDemand(theme: string, rows: KeywordDemand[]): SearchDemandMetric {
  const relevant = rows.filter((row) => row.theme === theme);
  if (!relevant.length) return { theme, status: "UNKNOWN" };

  const measured = relevant.filter((row) => row.status === "MEASURED" && typeof row.monthlySearches === "number");
  const estimated = relevant.filter((row) => row.status !== "UNKNOWN");
  const usable = measured.length ? measured : estimated;

  if (!usable.length) return { theme, status: "UNKNOWN" };

  const monthlySearches = usable.every((row) => typeof row.monthlySearches === "number")
    ? usable.reduce((sum, row) => sum + (row.monthlySearches ?? 0), 0)
    : undefined;
  const lowRange = usable.every((row) => typeof row.lowRange === "number")
    ? usable.reduce((sum, row) => sum + (row.lowRange ?? 0), 0)
    : undefined;
  const highRange = usable.every((row) => typeof row.highRange === "number")
    ? usable.reduce((sum, row) => sum + (row.highRange ?? 0), 0)
    : undefined;
  const trendValues = usable.map((row) => row.trendIndex).filter((value): value is number => typeof value === "number");

  return {
    theme,
    monthlySearches,
    lowRange,
    highRange,
    trendIndex: trendValues.length ? Math.round(trendValues.reduce((sum, value) => sum + value, 0) / trendValues.length) : undefined,
    geography: usable[0]?.geography,
    language: usable[0]?.language,
    source: [...new Set(usable.map((row) => row.source))].join("+"),
    status: measured.length === relevant.length ? "MEASURED" : measured.length || estimated.length ? "ESTIMATED" : "UNKNOWN",
    measuredAt: usable.map((row) => row.measuredAt).filter(Boolean).sort().at(-1),
  };
}

export function emptyDemandRows(universe: KeywordUniverse): KeywordDemand[] {
  return flattenUniverse(universe).map((row) => ({
    ...row,
    status: "UNKNOWN",
    source: "MANUAL_IMPORT",
  }));
}
