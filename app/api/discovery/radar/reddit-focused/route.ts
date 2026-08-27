import { NextResponse } from "next/server";
import { normalizeRadarObservation, type RawRadarObservation } from "@/lib/discovery/radar-pipeline";

const SUBREDDITS = ["ParisTravelGuide", "travel", "solotravel"] as const;
const QUERIES = [
  "hidden gems Paris",
  "non touristy Paris",
  "quiet Paris",
  "secret Paris",
  "unusual Paris",
  "local Paris recommendations",
  "second time Paris",
  "returning to Paris",
  "Paris rainy day",
  "Paris guide",
] as const;

const stripTags = (value: string) => value
  .replace(/<[^>]*>/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/\s+/g, " ")
  .trim();

const extract = (xml: string, tag: string) => [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "gi"))]
  .map((match) => stripTags(match[1] ?? ""));

function isFresh(value?: string) {
  if (!value) return false;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;
  return Date.now() - timestamp <= 30 * 24 * 60 * 60 * 1000 && timestamp <= Date.now() + 5 * 60 * 1000;
}

function safe(value: unknown, max = 280) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export async function GET() {
  const observations: RawRadarObservation[] = [];
  const rejectedStale: Array<{ subreddit: string; updated: string; title: string }> = [];
  const sourceStatus: Array<{ subreddit: string; query: string; status: number }> = [];

  for (const subreddit of SUBREDDITS) {
    for (const query of QUERIES) {
      const url = `https://www.reddit.com/r/${subreddit}/search.rss?q=${encodeURIComponent(query)}&restrict_sr=on&sort=new&t=month`;
      try {
        const response = await fetch(url, {
          headers: { "user-agent": "VelvetPassportRadar/1.0 (+https://velvetpassport.com)" },
          cache: "no-store",
        });
        sourceStatus.push({ subreddit, query, status: response.status });
        if (!response.ok) continue;

        const xml = await response.text();
        const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].map((match) => match[1] ?? "");
        for (const entry of entries.slice(0, 8)) {
          const title = extract(entry, "title")[0] ?? "";
          const content = extract(entry, "content")[0] ?? "";
          const updated = extract(entry, "updated")[0] ?? "";
          const link = entry.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1];
          if (!link || !new RegExp(`reddit\\.com/r/${subreddit}/comments/`, "i").test(link)) continue;
          if (!isFresh(updated)) {
            rejectedStale.push({ subreddit, updated, title: safe(title, 120) });
            continue;
          }
          const text = `${title} ${content}`.replace(/\[link\]/gi, " ").replace(/https?:\/\/\S+/g, " ").replace(/\s+/g, " ").trim();
          if (text.length < 40) continue;
          observations.push({
            source: "reddit",
            sourceType: "ASK",
            text: text.slice(0, 1200),
            query,
            observedAt: updated,
            volumeScore: subreddit === "ParisTravelGuide" ? 44 : 36,
            velocityScore: 60,
            sourceConfidence: subreddit === "ParisTravelGuide" ? 92 : 84,
            commercialIntent: 30,
            competitionPressure: 45,
            sourceUrl: link,
          });
        }
      } catch {
        sourceStatus.push({ subreddit, query, status: 0 });
      }
    }
  }

  const seen = new Set<string>();
  const deduped = observations.filter((observation) => {
    const key = observation.sourceUrl ?? observation.text.slice(0, 180).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const normalized = deduped.flatMap(normalizeRadarObservation);

  return NextResponse.json({
    ok: true,
    rawRecent: deduped.length,
    matched: normalized.length,
    staleRejected: rejectedStale.length,
    intent: {
      strong: normalized.filter((item) => item.travelerIntent === "STRONG").length,
      medium: normalized.filter((item) => item.travelerIntent === "MEDIUM").length,
      weak: normalized.filter((item) => item.travelerIntent === "WEAK").length,
    },
    buyIntent: normalized.reduce<Record<string, number>>((acc, item) => {
      acc[item.buyIntent] = (acc[item.buyIntent] ?? 0) + 1;
      return acc;
    }, {}),
    matches: normalized.slice(0, 12).map((item) => ({
      theme: item.theme,
      travelerIntent: item.travelerIntent,
      travelerIntentScore: item.travelerIntentScore,
      buyIntent: item.buyIntent,
      buyIntentScore: item.buyIntentScore,
      purchaseCategory: item.purchaseCategory,
      text: safe(item.text),
      observedAt: item.observedAt,
      sourceUrl: item.sourceUrl,
      matchedPhrases: item.matchedPhrases,
    })),
    unmatchedRecent: deduped.filter((observation) => !normalized.some((item) => item.sourceUrl === observation.sourceUrl)).slice(0, 8).map((item) => ({
      query: item.query,
      observedAt: item.observedAt,
      text: safe(item.text),
      sourceUrl: item.sourceUrl,
    })),
    staleSamples: rejectedStale.slice(0, 5),
    sourceStatus: sourceStatus.filter((item) => item.status !== 200).slice(0, 12),
  });
}
