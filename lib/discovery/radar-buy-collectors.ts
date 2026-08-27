import { normalizeRadarObservation, type NormalizedRadarObservation, type RawRadarObservation } from "./radar-pipeline";

export type BuyCollectorResult = {
  source: "viator" | "etsy" | "amazon";
  ok: boolean;
  observations: RawRadarObservation[];
  normalized: NormalizedRadarObservation[];
  note?: string;
};

const stripTags = (value: string) => value
  .replace(/<[^>]*>/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/\s+/g, " ")
  .trim();

const extract = (xml: string, tag: string) =>
  [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "gi"))]
    .map((match) => stripTags(match[1] ?? ""));

const itemBlocks = (xml: string) =>
  [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map((match) => match[1] ?? "");

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
  "Paris hidden gems tour",
  "Paris off the beaten path tour",
  "Paris secret places tour",
  "Paris unusual tour",
  "Paris local walking tour",
  "Paris private hidden gems",
];

const GUIDE_QUERIES = [
  "Paris hidden gems travel guide",
  "Paris travel guide PDF hidden gems",
  "Paris insider guide digital download",
  "Paris off the beaten path guide",
  "Paris secret places guide",
  "Paris itinerary digital guide",
];

async function collectIndexedBuySource(options: {
  source: "viator" | "etsy" | "amazon";
  domain: string;
  queries: string[];
  confidence: number;
  commercialIntent: number;
  competitionPressure: number;
  requiredUrlPattern?: RegExp;
}): Promise<BuyCollectorResult> {
  const observations: RawRadarObservation[] = [];
  let httpFailures = 0;

  for (const query of options.queries) {
    const searchUrl = `https://www.bing.com/search?format=rss&q=${encodeURIComponent(`site:${options.domain} ${query}`)}`;
    try {
      const response = await fetch(searchUrl, {
        headers: { "user-agent": "Mozilla/5.0 VelvetPassportRadar/1.0" },
        next: { revalidate: 1800 },
      });
      if (!response.ok) {
        httpFailures += 1;
        continue;
      }

      const xml = await response.text();
      for (const item of itemBlocks(xml).slice(0, 8)) {
        const title = extract(item, "title")[0] ?? "";
        const description = extract(item, "description")[0] ?? "";
        const link = extract(item, "link")[0] ?? "";
        if (!title && !description) continue;
        if (!link.includes(options.domain)) continue;
        if (options.requiredUrlPattern && !options.requiredUrlPattern.test(link)) continue;

        const text = `${title} ${description}`.replace(/\s+/g, " ").trim();
        if (text.length < 35 || !/\bparis\b/i.test(text + " " + link)) continue;

        observations.push({
          source: options.source,
          sourceType: "BUY",
          text: text.slice(0, 1200),
          query,
          observedAt: new Date().toISOString(),
          volumeScore: 58,
          velocityScore: 46,
          sourceConfidence: options.confidence,
          commercialIntent: options.commercialIntent,
          competitionPressure: options.competitionPressure,
          sourceUrl: link,
        });
      }
    } catch {
      httpFailures += 1;
    }
  }

  const deduped = uniqueBy(observations, (item) => item.sourceUrl ?? item.text.slice(0, 180).toLowerCase());
  const normalized = deduped.flatMap(normalizeRadarObservation);

  return {
    source: options.source,
    ok: deduped.length > 0,
    observations: deduped,
    normalized,
    note: deduped.length ? undefined : httpFailures === options.queries.length ? "search_provider_unavailable" : "no_relevant_indexed_products",
  };
}

export function collectViatorBuy() {
  return collectIndexedBuySource({
    source: "viator",
    domain: "viator.com",
    queries: ACTIVITY_QUERIES,
    confidence: 90,
    commercialIntent: 88,
    competitionPressure: 74,
    requiredUrlPattern: /viator\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?tours\/Paris\//i,
  });
}

export function collectEtsyBuy() {
  return collectIndexedBuySource({
    source: "etsy",
    domain: "etsy.com",
    queries: GUIDE_QUERIES,
    confidence: 90,
    commercialIntent: 92,
    competitionPressure: 72,
    requiredUrlPattern: /etsy\.com\/listing\//i,
  });
}

export function collectAmazonBuy() {
  return collectIndexedBuySource({
    source: "amazon",
    domain: "amazon.com",
    queries: GUIDE_QUERIES,
    confidence: 82,
    commercialIntent: 84,
    competitionPressure: 78,
    requiredUrlPattern: /amazon\.com\/.+\/(?:dp|gp\/product)\//i,
  });
}

export async function collectBuyRadarSources() {
  return Promise.all([
    collectViatorBuy(),
    collectEtsyBuy(),
    collectAmazonBuy(),
  ]);
}
