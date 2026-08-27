import { normalizeRadarObservation, type NormalizedRadarObservation, type RawRadarObservation } from "./radar-pipeline";
import { parisRadarSeeds } from "./radar-seeds";

const stripTags = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
const extract = (xml: string, tag: string) => [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "gi"))].map((m) => stripTags(m[1] ?? ""));
const itemBlocks = (xml: string) => [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map((m) => m[1] ?? "");
const uniqueBy = <T>(items: T[], key: (item: T) => string) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
};

export type CollectorResult = {
  source: string;
  ok: boolean;
  observations: RawRadarObservation[];
  normalized: NormalizedRadarObservation[];
  note?: string;
};

function radarQueries(limit = 12) {
  return parisRadarSeeds.flatMap((seed) => seed.phrases.slice(0, 1)).slice(0, limit);
}

export async function collectGoogleTrends(): Promise<CollectorResult> {
  const url = "https://trends.google.com/trending/rss?geo=FR";
  const response = await fetch(url, { headers: { "user-agent": "VelvetPassportRadar/1.0" }, next: { revalidate: 1800 } });
  if (!response.ok) return { source: "google-trends", ok: false, observations: [], normalized: [], note: `http_${response.status}` };
  const xml = await response.text();
  const observations = itemBlocks(xml).slice(0, 50).map((item) => {
    const title = extract(item, "title")[0] ?? "";
    const trafficRaw = extract(item, "ht:approx_traffic")[0] ?? "";
    const traffic = Number((trafficRaw.match(/[\d,.]+/)?.[0] ?? "0").replace(/,/g, ""));
    const volumeScore = traffic >= 100000 ? 95 : traffic >= 50000 ? 85 : traffic >= 10000 ? 70 : traffic >= 5000 ? 55 : 40;
    return { source: "google-trends", sourceType: "SEARCH" as const, text: title, query: title, observedAt: new Date().toISOString(), volumeScore, velocityScore: 80, sourceConfidence: 92, commercialIntent: 25, competitionPressure: 50, sourceUrl: "https://trends.google.com/trending?geo=FR" };
  }).filter((item) => item.text);
  return { source: "google-trends", ok: true, observations, normalized: observations.flatMap(normalizeRadarObservation) };
}

export async function collectGoogleSuggest(): Promise<CollectorResult> {
  const observations: RawRadarObservation[] = [];
  for (const query of radarQueries(10)) {
    try {
      const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=${encodeURIComponent(query)}`;
      const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 VelvetPassportRadar/1.0" }, next: { revalidate: 1800 } });
      if (!response.ok) continue;
      const payload = await response.json() as [string, string[]?];
      for (const suggestion of (payload[1] ?? []).slice(0, 8)) {
        if (!/\bparis\b/i.test(suggestion)) continue;
        observations.push({ source: "google-suggest", sourceType: "SEARCH", text: suggestion, query, observedAt: new Date().toISOString(), volumeScore: 48, velocityScore: 58, sourceConfidence: 90, commercialIntent: 38, competitionPressure: 55, sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(suggestion)}` });
      }
    } catch {
      // One autocomplete failure must not stop the cycle.
    }
  }
  const deduped = uniqueBy(observations, (item) => item.text.toLowerCase());
  return { source: "google-suggest", ok: deduped.length > 0, observations: deduped, normalized: deduped.flatMap(normalizeRadarObservation), note: deduped.length ? undefined : "no_paris_suggestions" };
}

export async function collectReddit(): Promise<CollectorResult> {
  const feedUrl = "https://www.reddit.com/r/ParisTravelGuide/new.rss?limit=50";
  try {
    const response = await fetch(feedUrl, { headers: { "user-agent": "VelvetPassportRadar/1.0 (+https://velvetpassport.com)" }, next: { revalidate: 1800 } });
    if (!response.ok) return { source: "reddit", ok: false, observations: [], normalized: [], note: `http_${response.status}` };
    const xml = await response.text();
    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].map((m) => m[1] ?? "");
    const now = Date.now();
    const observations: RawRadarObservation[] = [];
    for (const entry of entries.slice(0, 50)) {
      const title = extract(entry, "title")[0] ?? "";
      const content = extract(entry, "content")[0] ?? "";
      const updated = extract(entry, "updated")[0] ?? "";
      const link = entry.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1];
      const timestamp = Date.parse(updated);
      if (!link || !Number.isFinite(timestamp) || timestamp > now + 300000 || now - timestamp > 30 * 86400000) continue;
      const text = `${title} ${content}`.replace(/\[link\]/gi, " ").replace(/https?:\/\/\S+/g, " ").replace(/\s+/g, " ").trim();
      if (text.length < 40) continue;
      observations.push({ source: "reddit", sourceType: "ASK", text: text.slice(0, 1200), query: "ParisTravelGuide/new", observedAt: updated, volumeScore: 44, velocityScore: 60, sourceConfidence: 92, commercialIntent: 30, competitionPressure: 45, sourceUrl: link });
    }
    const deduped = uniqueBy(observations, (item) => item.sourceUrl ?? item.text.slice(0, 180).toLowerCase());
    return { source: "reddit", ok: true, observations: deduped, normalized: deduped.flatMap(normalizeRadarObservation), note: deduped.length ? undefined : "no_recent_posts" };
  } catch {
    return { source: "reddit", ok: false, observations: [], normalized: [], note: "fetch_failed" };
  }
}

async function collectBingSiteSource(options: { source: "tripadvisor" | "wanderlog" | "substack" | "getyourguide"; sourceType: "ASK" | "SAVE" | "DISCOVER" | "BUY"; siteQuery: string; domain: string; confidence: number; velocity: number; commercialIntent: number; limit?: number; requiredUrlPattern?: RegExp }): Promise<CollectorResult> {
  const observations: RawRadarObservation[] = [];
  for (const query of radarQueries(options.limit ?? 8)) {
    const searchUrl = `https://www.bing.com/search?format=rss&q=${encodeURIComponent(`site:${options.siteQuery} ${query}`)}`;
    try {
      const response = await fetch(searchUrl, { headers: { "user-agent": "Mozilla/5.0 VelvetPassportRadar/1.0" }, next: { revalidate: 1800 } });
      if (!response.ok) continue;
      const xml = await response.text();
      for (const item of itemBlocks(xml).slice(0, 8)) {
        const title = extract(item, "title")[0] ?? "";
        const description = extract(item, "description")[0] ?? "";
        const link = extract(item, "link")[0] ?? "";
        if (!title && !description) continue;
        if (link && !link.includes(options.domain)) continue;
        if (options.requiredUrlPattern && !options.requiredUrlPattern.test(link)) continue;
        const text = `${title} ${description}`.replace(/\s+/g, " ").trim();
        if (text.length < 35 || !/\bparis\b/i.test(text + " " + link)) continue;
        observations.push({ source: options.source, sourceType: options.sourceType, text: text.slice(0, 1200), query, observedAt: new Date().toISOString(), volumeScore: options.sourceType === "BUY" ? 52 : 38, velocityScore: options.velocity, sourceConfidence: options.confidence, commercialIntent: options.commercialIntent, competitionPressure: options.sourceType === "BUY" ? 62 : 45, sourceUrl: link || undefined });
      }
    } catch {
      // Search-provider blocking must not stop the full radar cycle.
    }
  }
  const deduped = uniqueBy(observations, (item) => item.sourceUrl ?? item.text.slice(0, 180).toLowerCase());
  return { source: options.source, ok: deduped.length > 0, observations: deduped, normalized: deduped.flatMap(normalizeRadarObservation), note: deduped.length ? undefined : "no_relevant_public_search_results" };
}

export function collectTripadvisor() {
  return collectBingSiteSource({ source: "tripadvisor", sourceType: "ASK", siteQuery: "tripadvisor.com/ShowTopic", domain: "tripadvisor.com", confidence: 86, velocity: 48, commercialIntent: 38, limit: 8, requiredUrlPattern: /tripadvisor\.com\/ShowTopic/i });
}

export function collectGetYourGuide() {
  return collectBingSiteSource({ source: "getyourguide", sourceType: "BUY", siteQuery: "getyourguide.com/paris", domain: "getyourguide.com", confidence: 88, velocity: 52, commercialIntent: 78, competitionPressure: undefined as never, limit: 8 });
}

export async function collectAtlas(): Promise<CollectorResult> {
  const feedUrl = "https://www.atlasobscura.com/feeds/latest";
  try {
    const response = await fetch(feedUrl, { headers: { "user-agent": "VelvetPassportRadar/1.0 (+https://velvetpassport.com)", accept: "application/rss+xml, application/xml, text/xml" }, next: { revalidate: 1800 } });
    if (!response.ok) return { source: "atlas", ok: false, observations: [], normalized: [], note: `rss_http_${response.status}` };
    const xml = await response.text();
    const observations: RawRadarObservation[] = [];
    for (const item of itemBlocks(xml).slice(0, 100)) {
      const title = extract(item, "title")[0] ?? "";
      const description = extract(item, "description")[0] ?? "";
      const link = extract(item, "link")[0] ?? "";
      const pubDate = extract(item, "pubDate")[0];
      const text = `${title} ${description}`.replace(/\s+/g, " ").trim();
      const parisMentions = (text.match(/\bparis\b/gi) ?? []).length;
      if (!/\bparis\b/i.test(title) && !/paris-france/i.test(link) && parisMentions < 2) continue;
      observations.push({ source: "atlas", sourceType: "SAVE", text: text.slice(0, 1200), query: title || "Paris Atlas Obscura", observedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(), volumeScore: 46, velocityScore: 48, sourceConfidence: 88, commercialIntent: 42, competitionPressure: 45, sourceUrl: link || feedUrl });
    }
    const deduped = uniqueBy(observations, (item) => item.sourceUrl ?? item.text.slice(0, 180).toLowerCase());
    return { source: "atlas", ok: true, observations: deduped, normalized: deduped.flatMap(normalizeRadarObservation), note: deduped.length ? undefined : "rss_no_paris_centric_items" };
  } catch {
    return { source: "atlas", ok: false, observations: [], normalized: [], note: "rss_fetch_failed" };
  }
}

export function collectWanderlog() {
  return collectBingSiteSource({ source: "wanderlog", sourceType: "SAVE", siteQuery: "wanderlog.com", domain: "wanderlog.com", confidence: 80, velocity: 44, commercialIntent: 48, limit: 6 });
}

export function collectSubstack() {
  return collectBingSiteSource({ source: "substack", sourceType: "DISCOVER", siteQuery: "substack.com", domain: "substack.com", confidence: 74, velocity: 48, commercialIntent: 38, limit: 6 });
}

export async function collectPinterest(): Promise<CollectorResult> {
  return { source: "pinterest", ok: false, observations: [], normalized: [], note: "disabled_by_product_decision" };
}

export async function collectFirstRadarSources() {
  return Promise.all([
    collectGoogleTrends(),
    collectGoogleSuggest(),
    collectReddit(),
    collectTripadvisor(),
    collectGetYourGuide(),
    collectAtlas(),
    collectWanderlog(),
    collectSubstack(),
    collectPinterest(),
  ]);
}
