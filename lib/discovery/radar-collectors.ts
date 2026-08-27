import { normalizeRadarObservation, type NormalizedRadarObservation, type RawRadarObservation } from "./radar-pipeline";
import { parisRadarSeeds } from "./radar-seeds";

const stripTags = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
const extract = (xml: string, tag: string) => [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "gi"))].map((m) => stripTags(m[1] ?? ""));
const itemBlocks = (xml: string) => [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map((m) => m[1] ?? "");

export type CollectorResult = {
  source: string;
  ok: boolean;
  observations: RawRadarObservation[];
  normalized: NormalizedRadarObservation[];
  note?: string;
};

export async function collectGoogleTrends(): Promise<CollectorResult> {
  const url = "https://trends.google.com/trending/rss?geo=FR";
  const response = await fetch(url, { headers: { "user-agent": "VelvetPassportRadar/1.0" }, cache: "no-store" });
  if (!response.ok) return { source: "google-trends", ok: false, observations: [], normalized: [], note: `http_${response.status}` };
  const xml = await response.text();
  const observations = itemBlocks(xml).slice(0, 50).map((item) => {
    const title = extract(item, "title")[0] ?? "";
    const trafficRaw = extract(item, "ht:approx_traffic")[0] ?? "";
    const traffic = Number((trafficRaw.match(/[\d,.]+/)?.[0] ?? "0").replace(/,/g, ""));
    const volumeScore = traffic >= 100000 ? 95 : traffic >= 50000 ? 85 : traffic >= 10000 ? 70 : traffic >= 5000 ? 55 : 40;
    return {
      source: "google-trends",
      sourceType: "SEARCH" as const,
      text: title,
      query: title,
      observedAt: new Date().toISOString(),
      volumeScore,
      velocityScore: 80,
      sourceConfidence: 92,
      commercialIntent: 25,
      competitionPressure: 50,
      sourceUrl: "https://trends.google.com/trending?geo=FR",
    };
  }).filter((item) => item.text);
  return { source: "google-trends", ok: true, observations, normalized: observations.flatMap(normalizeRadarObservation) };
}

function radarQueries(limit = 20) {
  return parisRadarSeeds.flatMap((seed) => seed.phrases.slice(0, 2)).slice(0, limit);
}

export async function collectReddit(): Promise<CollectorResult> {
  const observations: RawRadarObservation[] = [];
  for (const query of radarQueries()) {
    const url = `https://www.reddit.com/search.rss?q=${encodeURIComponent(`${query} Paris`)}&sort=new&t=month`;
    try {
      const response = await fetch(url, { headers: { "user-agent": "VelvetPassportRadar/1.0 (+https://velvetpassport.com)" }, cache: "no-store" });
      if (!response.ok) continue;
      const xml = await response.text();
      const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].map((m) => m[1] ?? "");
      for (const entry of entries.slice(0, 8)) {
        const title = extract(entry, "title")[0] ?? "";
        const content = extract(entry, "content")[0] ?? "";
        const link = entry.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1];
        const updated = extract(entry, "updated")[0];
        if (!title && !content) continue;
        observations.push({
          source: "reddit",
          sourceType: "ASK",
          text: `${title} ${content}`.slice(0, 1200),
          query,
          observedAt: updated || new Date().toISOString(),
          volumeScore: 35,
          velocityScore: 55,
          sourceConfidence: 82,
          commercialIntent: 30,
          competitionPressure: 45,
          sourceUrl: link,
        });
      }
    } catch {
      // One blocked query must not stop the full radar cycle.
    }
  }
  const normalized = observations.flatMap(normalizeRadarObservation);
  return { source: "reddit", ok: observations.length > 0, observations, normalized, note: observations.length ? undefined : "no_public_feed_results" };
}

async function collectPublicSearchSource(options: {
  source: "tripadvisor" | "atlas" | "wanderlog" | "substack";
  sourceType: "ASK" | "SAVE" | "DISCOVER";
  site: string;
  confidence: number;
  velocity: number;
  commercialIntent: number;
  limit?: number;
}): Promise<CollectorResult> {
  const observations: RawRadarObservation[] = [];
  for (const query of radarQueries(options.limit ?? 16)) {
    const searchUrl = `https://www.bing.com/search?format=rss&q=${encodeURIComponent(`site:${options.site} Paris ${query}`)}`;
    try {
      const response = await fetch(searchUrl, { headers: { "user-agent": "VelvetPassportRadar/1.0" }, cache: "no-store" });
      if (!response.ok) continue;
      const xml = await response.text();
      for (const item of itemBlocks(xml).slice(0, 8)) {
        const title = extract(item, "title")[0] ?? "";
        const description = extract(item, "description")[0] ?? "";
        const link = extract(item, "link")[0] ?? "";
        if (!title && !description) continue;
        if (link && !link.includes(options.site.split("/")[0])) continue;
        observations.push({
          source: options.source,
          sourceType: options.sourceType,
          text: `${title} ${description}`.slice(0, 1200),
          query,
          observedAt: new Date().toISOString(),
          volumeScore: 34,
          velocityScore: options.velocity,
          sourceConfidence: options.confidence,
          commercialIntent: options.commercialIntent,
          competitionPressure: 45,
          sourceUrl: link || undefined,
        });
      }
    } catch {
      // Search-provider blocking must not stop the full radar cycle.
    }
  }
  const normalized = observations.flatMap(normalizeRadarObservation);
  return { source: options.source, ok: observations.length > 0, observations, normalized, note: observations.length ? undefined : "no_public_search_results" };
}

export function collectTripadvisor() {
  return collectPublicSearchSource({ source: "tripadvisor", sourceType: "ASK", site: "tripadvisor.com/ShowTopic", confidence: 82, velocity: 45, commercialIntent: 35 });
}

export function collectAtlas() {
  return collectPublicSearchSource({ source: "atlas", sourceType: "SAVE", site: "atlasobscura.com", confidence: 78, velocity: 42, commercialIntent: 40, limit: 14 });
}

export function collectWanderlog() {
  return collectPublicSearchSource({ source: "wanderlog", sourceType: "SAVE", site: "wanderlog.com", confidence: 80, velocity: 44, commercialIntent: 48, limit: 14 });
}

export function collectSubstack() {
  return collectPublicSearchSource({ source: "substack", sourceType: "DISCOVER", site: "substack.com", confidence: 74, velocity: 48, commercialIntent: 38, limit: 14 });
}

export async function collectPinterest(): Promise<CollectorResult> {
  const token = process.env.PINTEREST_ACCESS_TOKEN;
  if (!token) return { source: "pinterest", ok: false, observations: [], normalized: [], note: "token_required" };
  const response = await fetch("https://api.pinterest.com/v5/trends/keywords/FR/top/growing?limit=50", {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!response.ok) return { source: "pinterest", ok: false, observations: [], normalized: [], note: `http_${response.status}` };
  const payload = await response.json() as { trends?: Array<{ keyword?: string; pct_growth_wow?: number; pct_growth_mom?: number }> };
  const observations = (payload.trends ?? []).map((trend) => ({
    source: "pinterest",
    sourceType: "SAVE" as const,
    text: trend.keyword ?? "",
    query: trend.keyword,
    observedAt: new Date().toISOString(),
    volumeScore: 55,
    velocityScore: Math.max(0, Math.min(100, Math.round(Math.abs(trend.pct_growth_wow ?? trend.pct_growth_mom ?? 0) / 5))),
    sourceConfidence: 90,
    commercialIntent: 45,
    competitionPressure: 50,
    sourceUrl: "https://trends.pinterest.com/",
  })).filter((item) => item.text);
  return { source: "pinterest", ok: true, observations, normalized: observations.flatMap(normalizeRadarObservation) };
}

export async function collectFirstRadarSources() {
  return Promise.all([
    collectGoogleTrends(),
    collectReddit(),
    collectTripadvisor(),
    collectAtlas(),
    collectWanderlog(),
    collectSubstack(),
    collectPinterest(),
  ]);
}
