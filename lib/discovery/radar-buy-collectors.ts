import { normalizeRadarObservation, type NormalizedRadarObservation, type RawRadarObservation } from "./radar-pipeline";

export type BuyCollectorResult = {
  source: "viator" | "etsy" | "amazon";
  ok: boolean;
  observations: RawRadarObservation[];
  normalized: NormalizedRadarObservation[];
  note?: string;
};

const stripTags = (value: string) => value
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]*>/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&#x27;/g, "'")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&nbsp;/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const uniqueBy = <T>(items: T[], key: (item: T) => string) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
};

const ACTIVITY_QUERIES = [
  "Paris hidden gems",
  "Paris off the beaten path",
  "Paris secret places",
  "Paris unusual",
];

const GUIDE_QUERIES = [
  "Paris hidden gems travel guide",
  "Paris travel guide PDF hidden gems",
  "Paris off the beaten path guide",
  "Paris secret places guide",
];

function surroundingText(html: string, index: number, radius = 650) {
  return stripTags(html.slice(Math.max(0, index - radius), Math.min(html.length, index + radius)));
}

function buildObservation(options: {
  source: "viator" | "etsy" | "amazon";
  query: string;
  text: string;
  url: string;
  confidence: number;
  commercialIntent: number;
  competitionPressure: number;
}): RawRadarObservation | null {
  const observedText = options.text.replace(/\s+/g, " ").trim();
  // Classification must be based only on observed marketplace content.
  // The query is provenance and must never create a theme match by itself.
  if (!/\bparis\b/i.test(observedText)) return null;
  if (observedText.length < 35) return null;

  return {
    source: options.source,
    sourceType: "BUY",
    text: observedText.slice(0, 1200),
    query: options.query,
    observedAt: new Date().toISOString(),
    volumeScore: 58,
    velocityScore: 46,
    sourceConfidence: options.confidence,
    commercialIntent: options.commercialIntent,
    competitionPressure: options.competitionPressure,
    sourceUrl: options.url,
  };
}

function normalizeBuyProducts(observations: RawRadarObservation[]) {
  return observations.flatMap((observation) => {
    const normalized = normalizeRadarObservation(observation);
    const strongestByTheme = new Map<string, NormalizedRadarObservation>();

    for (const signal of normalized) {
      const current = strongestByTheme.get(signal.theme);
      if (!current || signal.velvetOpportunityScore > current.velvetOpportunityScore) {
        strongestByTheme.set(signal.theme, signal);
      }
    }

    return [...strongestByTheme.values()]
      .sort((a, b) => {
        if (b.matchedPhrases.length !== a.matchedPhrases.length) {
          return b.matchedPhrases.length - a.matchedPhrases.length;
        }
        return b.velvetOpportunityScore - a.velvetOpportunityScore;
      })
      .slice(0, 2);
  });
}

async function fetchMarketplace(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9",
    },
    next: { revalidate: 1800 },
  });
  return { response, html: response.ok ? await response.text() : "" };
}

export async function collectViatorBuy(): Promise<BuyCollectorResult> {
  const observations: RawRadarObservation[] = [];
  let blocked = 0;
  for (const query of ACTIVITY_QUERIES) {
    const searchUrl = `https://www.viator.com/searchResults/all?text=${encodeURIComponent(query)}`;
    try {
      const { response, html } = await fetchMarketplace(searchUrl);
      if (!response.ok) { blocked += 1; continue; }
      const regex = /(?:https?:\/\/www\.viator\.com)?((?:\/[a-z]{2}-[A-Z]{2})?\/tours\/Paris\/[^"'<>\s?#]+)/g;
      for (const match of html.matchAll(regex)) {
        const path = match[1];
        if (!path) continue;
        const index = match.index ?? 0;
        const text = surroundingText(html, index);
        const url = `https://www.viator.com${path}`;
        const observation = buildObservation({ source: "viator", query, text, url, confidence: 90, commercialIntent: 90, competitionPressure: 74 });
        if (observation) observations.push(observation);
      }
    } catch { blocked += 1; }
  }
  const deduped = uniqueBy(observations, (item) => item.sourceUrl ?? "").slice(0, 40);
  return { source: "viator", ok: deduped.length > 0, observations: deduped, normalized: normalizeBuyProducts(deduped), note: deduped.length ? undefined : blocked === ACTIVITY_QUERIES.length ? "marketplace_fetch_blocked" : "no_product_links_found" };
}

export async function collectEtsyBuy(): Promise<BuyCollectorResult> {
  const observations: RawRadarObservation[] = [];
  let blocked = 0;
  for (const query of GUIDE_QUERIES) {
    const searchUrl = `https://www.etsy.com/search?q=${encodeURIComponent(query)}&digital=true`;
    try {
      const { response, html } = await fetchMarketplace(searchUrl);
      if (!response.ok) { blocked += 1; continue; }
      const regex = /(?:https?:\/\/www\.etsy\.com)?(\/listing\/\d+\/[^"'<>\s?#]+)/g;
      for (const match of html.matchAll(regex)) {
        const path = match[1];
        if (!path) continue;
        const index = match.index ?? 0;
        const text = surroundingText(html, index);
        const url = `https://www.etsy.com${path}`;
        const observation = buildObservation({ source: "etsy", query, text, url, confidence: 92, commercialIntent: 94, competitionPressure: 72 });
        if (observation) observations.push(observation);
      }
    } catch { blocked += 1; }
  }
  const deduped = uniqueBy(observations, (item) => item.sourceUrl ?? "").slice(0, 40);
  return { source: "etsy", ok: deduped.length > 0, observations: deduped, normalized: normalizeBuyProducts(deduped), note: deduped.length ? undefined : blocked === GUIDE_QUERIES.length ? "marketplace_fetch_blocked" : "no_listing_links_found" };
}

export async function collectAmazonBuy(): Promise<BuyCollectorResult> {
  const observations: RawRadarObservation[] = [];
  let blocked = 0;
  for (const query of GUIDE_QUERIES) {
    const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(query)}&i=stripbooks`;
    try {
      const { response, html } = await fetchMarketplace(searchUrl);
      if (!response.ok || /robot check|enter the characters you see below/i.test(html)) { blocked += 1; continue; }
      const regex = /href=["']([^"']*\/dp\/[A-Z0-9]{10}[^"']*)["']/g;
      for (const match of html.matchAll(regex)) {
        const href = match[1];
        if (!href) continue;
        const index = match.index ?? 0;
        const text = surroundingText(html, index);
        const path = href.startsWith("http") ? new URL(href).pathname : href;
        const url = `https://www.amazon.com${path.split("?")[0]}`;
        const observation = buildObservation({ source: "amazon", query, text, url, confidence: 82, commercialIntent: 86, competitionPressure: 78 });
        if (observation) observations.push(observation);
      }
    } catch { blocked += 1; }
  }
  const deduped = uniqueBy(observations, (item) => item.sourceUrl ?? "").slice(0, 40);
  return { source: "amazon", ok: deduped.length > 0, observations: deduped, normalized: normalizeBuyProducts(deduped), note: deduped.length ? undefined : blocked === GUIDE_QUERIES.length ? "marketplace_fetch_blocked" : "no_product_links_found" };
}

export async function collectBuyRadarSources() {
  return Promise.all([
    collectViatorBuy(),
    collectEtsyBuy(),
    collectAmazonBuy(),
  ]);
}
