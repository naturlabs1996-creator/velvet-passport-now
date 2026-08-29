import type { DestinationShare, EvidenceStatus } from "./demand-journey";
import { parisUncoveredUniverse, type KeywordUniverse } from "./search-demand";

export type DestinationResultType = DestinationShare["resultType"];

export type DestinationSerpResult = {
  keyword: string;
  theme: string;
  rank: number;
  title: string;
  url: string;
  domain: string;
  resultType: DestinationResultType;
  visibilityWeight: number;
  source: "BING_RSS";
  status: EvidenceStatus;
  observedAt: string;
};

export type DestinationThemeCapture = {
  theme: string;
  queryCount: number;
  resultCount: number;
  domains: DestinationShare[];
  topDomains: Array<{
    domain: string;
    resultType: DestinationResultType;
    appearances: number;
    bestRank: number;
    visibilityShare: number;
  }>;
  status: EvidenceStatus;
  source: "BING_RSS";
  observedAt: string;
};

export type DestinationCaptureBudget = {
  maxKeywordsPerTheme?: number;
  maxTotalQueries?: number;
};

const DOMAIN_TYPES: Array<[RegExp, DestinationResultType]> = [
  [/reddit\.com$/i, "FORUM"],
  [/tripadvisor\./i, "FORUM"],
  [/quora\.com$/i, "FORUM"],
  [/(viator\.com|getyourguide\.com|tiqets\.com|headout\.com)$/i, "TOUR"],
  [/(etsy\.com|amazon\.|books\.google\.)/i, "MARKETPLACE"],
  [/(youtube\.com|youtu\.be|tiktok\.com|instagram\.com)$/i, "VIDEO"],
  [/(google\.[a-z.]+|bing\.com)$/i, "MAP"],
];

const TRAVEL_DOMAINS = /(tripadvisor\.|viator\.com|getyourguide\.com|parisjetaime\.com|lonelyplanet\.com|cntraveler\.com|timeout\.com|travel\.|atlasobscura\.com|france\.fr)/i;

function classifyDomain(domain: string): DestinationResultType {
  for (const [pattern, type] of DOMAIN_TYPES) {
    if (pattern.test(domain)) return type;
  }
  return "EDITORIAL";
}

function decodeXml(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function stripCdata(value: string) {
  return decodeXml(value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim());
}

function itemValue(item: string, tag: string) {
  const match = item.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? stripCdata(match[1]) : "";
}

function parseRss(xml: string) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => ({
    title: itemValue(match[1], "title"),
    link: itemValue(match[1], "link"),
    description: itemValue(match[1], "description"),
  })).filter((item) => item.title && item.link);
}

function rankVisibility(rank: number) {
  const weights = [32, 20, 14, 10, 7, 5, 4, 3, 3, 2];
  return weights[rank - 1] ?? 1;
}

function normalizeDomain(url: string) {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
}

function isParisTravelResult(item: { title: string; link: string; description: string }, domain: string) {
  const observed = `${item.title} ${item.description} ${item.link}`;
  if (/\bparis\b/i.test(observed)) return true;
  return TRAVEL_DOMAINS.test(domain) && /france|paris|travel|things to do|attractions|guide/i.test(observed);
}

async function collectKeyword(keyword: string, theme: string): Promise<DestinationSerpResult[]> {
  const searchQuery = `"${keyword}" Paris travel`;
  const url = `https://www.bing.com/search?format=rss&q=${encodeURIComponent(searchQuery)}`;
  try {
    const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 VelvetPassportDiscovery/1.0", accept: "application/rss+xml,application/xml,text/xml", "accept-language": "en-US,en;q=0.9" }, next: { revalidate: 21600 } });
    if (!response.ok) return [];
    const xml = await response.text();
    const now = new Date().toISOString();
    return parseRss(xml).slice(0, 10).flatMap((item, index) => {
      const domain = normalizeDomain(item.link);
      if (!domain || domain.includes("bing.com") || !isParisTravelResult(item, domain)) return [];
      return [{ keyword, theme, rank: index + 1, title: item.title.slice(0, 220), url: item.link.slice(0, 1000), domain, resultType: classifyDomain(domain), visibilityWeight: rankVisibility(index + 1), source: "BING_RSS" as const, status: "ESTIMATED" as const, observedAt: now }];
    });
  } catch { return []; }
}

function aggregateTheme(theme: string, results: DestinationSerpResult[]): DestinationThemeCapture {
  const relevant = results.filter((result) => result.theme === theme);
  const totalWeight = relevant.reduce((sum, result) => sum + result.visibilityWeight, 0);
  const byDomain = new Map<string, { type: DestinationResultType; appearances: number; bestRank: number; weight: number }>();
  for (const result of relevant) {
    const current = byDomain.get(result.domain) ?? { type: result.resultType, appearances: 0, bestRank: Number.POSITIVE_INFINITY, weight: 0 };
    current.appearances += 1;
    current.bestRank = Math.min(current.bestRank, result.rank);
    current.weight += result.visibilityWeight;
    byDomain.set(result.domain, current);
  }
  const topDomains = [...byDomain.entries()].map(([domain, data]) => ({ domain, resultType: data.type, appearances: data.appearances, bestRank: data.bestRank, visibilityShare: totalWeight ? Math.round((data.weight / totalWeight) * 1000) / 10 : 0 })).sort((a, b) => b.visibilityShare - a.visibilityShare || a.bestRank - b.bestRank);
  return { theme, queryCount: new Set(relevant.map((result) => result.keyword)).size, resultCount: relevant.length, domains: topDomains.map((item) => ({ domain: item.domain, resultType: item.resultType, visibilityShare: item.visibilityShare, status: "ESTIMATED", source: "BING_RSS_RANK_WEIGHT" })), topDomains: topDomains.slice(0, 10), status: relevant.length ? "ESTIMATED" : "UNKNOWN", source: "BING_RSS", observedAt: relevant[0]?.observedAt ?? new Date().toISOString() };
}

export async function collectDestinationCapture(universe: KeywordUniverse = parisUncoveredUniverse, budget: DestinationCaptureBudget | number = {}) {
  const normalized = typeof budget === "number" ? { maxKeywordsPerTheme: budget } : budget;
  const perTheme = Math.max(1, Math.min(normalized.maxKeywordsPerTheme ?? 3, 5));
  const maxTotalQueries = Math.max(1, Math.min(normalized.maxTotalQueries ?? 24, 50));
  const requests = universe.themes.flatMap(({ theme, keywords }) => keywords.slice(0, perTheme).map((keyword) => ({ keyword, theme }))).slice(0, maxTotalQueries);
  const results = (await Promise.all(requests.map(({ keyword, theme }) => collectKeyword(keyword, theme)))).flat();
  const themes = universe.themes.map(({ theme }) => aggregateTheme(theme, results));
  return { universe: universe.id, source: "BING_RSS" as const, measurement: "ESTIMATED_SERP_VISIBILITY" as const, note: "Only Paris/travel-relevant public SERP results are retained. Query count is budget-capped; visibility share is rank-weighted and is not click share or traffic volume.", keywordCount: new Set(results.map((result) => result.keyword)).size, resultCount: results.length, results, themes };
}
