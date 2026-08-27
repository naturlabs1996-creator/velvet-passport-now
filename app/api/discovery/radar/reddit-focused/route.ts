import { NextResponse } from "next/server";
import { normalizeRadarObservation, type RawRadarObservation } from "@/lib/discovery/radar-pipeline";

const FEED_URL = "https://www.reddit.com/r/ParisTravelGuide/new/.rss?limit=50";

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
  const rejectedStale: Array<{ updated: string; title: string }> = [];

  let status = 0;
  try {
    const response = await fetch(FEED_URL, {
      headers: { "user-agent": "VelvetPassportRadar/1.0 (+https://velvetpassport.com)" },
      next: { revalidate: 1800 },
    });
    status = response.status;
    if (!response.ok) {
      return NextResponse.json({ ok: false, rawRecent: 0, matched: 0, sourceStatus: [{ source: "ParisTravelGuide/new", status }] });
    }

    const xml = await response.text();
    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].map((match) => match[1] ?? "");

    for (const entry of entries.slice(0, 50)) {
      const title = extract(entry, "title")[0] ?? "";
      const content = extract(entry, "content")[0] ?? "";
      const updated = extract(entry, "updated")[0] ?? "";
      const link = entry.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1];
      if (!link || !/reddit\.com\/r\/ParisTravelGuide\/comments\//i.test(link)) continue;
      if (!isFresh(updated)) {
        rejectedStale.push({ updated, title: safe(title, 120) });
        continue;
      }
      const text = `${title} ${content}`.replace(/\[link\]/gi, " ").replace(/https?:\/\/\S+/g, " ").replace(/\s+/g, " ").trim();
      if (text.length < 40) continue;
      observations.push({
        source: "reddit",
        sourceType: "ASK",
        text: text.slice(0, 1200),
        query: "r/ParisTravelGuide/new",
        observedAt: updated,
        volumeScore: 44,
        velocityScore: 60,
        sourceConfidence: 92,
        commercialIntent: 30,
        competitionPressure: 45,
        sourceUrl: link,
      });
    }
  } catch {
    return NextResponse.json({ ok: false, rawRecent: 0, matched: 0, sourceStatus: [{ source: "ParisTravelGuide/new", status: 0 }] });
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
    sourceStatus: [{ source: "ParisTravelGuide/new", status }],
    rawRecent: deduped.length,
    matched: normalized.length,
    staleRejected: rejectedStale.length,
    intent: {
      strong: normalized.filter((item) => item.travelerIntent === "STRONG").length,
      medium: normalized.filter((item) => item.travelerIntent === "MEDIUM").length,
      weak: normalized.filter((item) => item.travelerIntent === "WEAK").length,
    },
    travelSpendIntent: normalized.reduce<Record<string, number>>((acc, item) => {
      acc[item.travelSpendIntent] = (acc[item.travelSpendIntent] ?? 0) + 1;
      return acc;
    }, {}),
    explicitVelvetIntent: normalized.reduce<Record<string, number>>((acc, item) => {
      acc[item.velvetIntent] = (acc[item.velvetIntent] ?? 0) + 1;
      return acc;
    }, {}),
    velvetOpportunity: normalized.reduce<Record<string, number>>((acc, item) => {
      acc[item.velvetOpportunity] = (acc[item.velvetOpportunity] ?? 0) + 1;
      return acc;
    }, {}),
    matches: normalized
      .sort((a, b) => b.velvetOpportunityScore - a.velvetOpportunityScore)
      .slice(0, 15)
      .map((item) => ({
        theme: item.theme,
        travelerIntent: item.travelerIntent,
        travelerIntentScore: item.travelerIntentScore,
        travelSpendIntent: item.travelSpendIntent,
        travelSpendIntentScore: item.travelSpendIntentScore,
        explicitVelvetIntent: item.velvetIntent,
        explicitVelvetIntentScore: item.velvetIntentScore,
        velvetOpportunity: item.velvetOpportunity,
        velvetOpportunityScore: item.velvetOpportunityScore,
        purchaseCategory: item.purchaseCategory,
        text: safe(item.text),
        observedAt: item.observedAt,
        sourceUrl: item.sourceUrl,
        matchedPhrases: item.matchedPhrases,
        velvetCues: item.velvetCues,
      })),
    unmatchedRecent: deduped.filter((observation) => !normalized.some((item) => item.sourceUrl === observation.sourceUrl)).slice(0, 8).map((item) => ({
      observedAt: item.observedAt,
      text: safe(item.text),
      sourceUrl: item.sourceUrl,
    })),
    staleSamples: rejectedStale.slice(0, 5),
  });
}
