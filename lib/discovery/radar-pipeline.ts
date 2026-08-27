import { findSeedMatches, parisRadarSeeds } from "./radar-seeds";
import { classifyRadarIntent, type IntentStrength, type PurchaseCategory } from "./radar-intent";
import type { RadarSignal } from "./radar";

export type RadarSourceType = "ASK" | "SEARCH" | "SAVE" | "DISCOVER" | "BUY";

export type RawRadarObservation = {
  source: string;
  sourceType: RadarSourceType;
  text: string;
  query?: string;
  observedAt?: string;
  volumeScore?: number;
  velocityScore?: number;
  sourceConfidence?: number;
  commercialIntent?: number;
  competitionPressure?: number;
  sourceUrl?: string;
};

export type NormalizedRadarObservation = RawRadarObservation & {
  theme: string;
  velvetFit: number;
  matchedPhrases: string[];
  travelerIntent: IntentStrength;
  travelerIntentScore: number;
  buyIntent: IntentStrength;
  buyIntentScore: number;
  purchaseCategory: PurchaseCategory;
  travelerCues: string[];
  buyCues: string[];
};

const allowedSources: Record<RadarSourceType, Set<string>> = {
  ASK: new Set(["reddit", "tripadvisor", "facebook-groups"]),
  SEARCH: new Set(["google-trends"]),
  SAVE: new Set(["pinterest", "atlas", "wanderlog", "polarsteps", "google-maps"]),
  DISCOVER: new Set(["threads", "substack", "instagram", "tiktok"]),
  BUY: new Set(["etsy", "amazon", "google-play-books", "getyourguide", "viator"]),
};

const sourceConfidenceDefaults: Record<string, number> = {
  "google-trends": 92,
  pinterest: 90,
  reddit: 82,
  tripadvisor: 82,
  "facebook-groups": 72,
  atlas: 75,
  wanderlog: 78,
  polarsteps: 76,
  "google-maps": 82,
  threads: 68,
  substack: 72,
  instagram: 66,
  tiktok: 64,
  etsy: 86,
  amazon: 88,
  "google-play-books": 82,
  getyourguide: 86,
  viator: 86,
};

const clampScore = (value: number | undefined, fallback: number) =>
  Math.round(Math.max(0, Math.min(100, Number.isFinite(value) ? Number(value) : fallback)));

const isFreshEnough = (observedAt: string | undefined, maxAgeDays: number) => {
  if (!observedAt) return false;
  const timestamp = Date.parse(observedAt);
  if (!Number.isFinite(timestamp)) return false;
  const ageMs = Date.now() - timestamp;
  return ageMs >= 0 && ageMs <= maxAgeDays * 24 * 60 * 60 * 1000;
};

export function normalizeRadarObservation(raw: RawRadarObservation): NormalizedRadarObservation[] {
  const source = raw.source.trim().toLowerCase();
  if (!allowedSources[raw.sourceType]?.has(source)) return [];

  // Reddit is used as a live demand source. Search APIs can occasionally surface stale posts even with
  // a recent-time query, so enforce freshness independently before any scoring or theme matching.
  if (source === "reddit" && !isFreshEnough(raw.observedAt, 30)) return [];

  // Theme classification and intent classification must come from observed content only.
  // Search queries are provenance and must never manufacture intent.
  const observedText = raw.text.trim();
  if (!observedText) return [];

  const intent = classifyRadarIntent(observedText);

  // ASK sources represent people asking for help. Require evidence that the post is actually about travel/planning,
  // otherwise generic Paris chatter, photography, schools, news, etc. must not enter the demand radar.
  if (raw.sourceType === "ASK" && intent.travelerIntentScore < 20) return [];

  const matches = findSeedMatches(observedText);
  const baseCommercialIntent = clampScore(raw.commercialIntent, raw.sourceType === "BUY" ? 75 : 35);
  const enrichedCommercialIntent = Math.max(baseCommercialIntent, intent.buyIntentScore);

  return matches.map(({ seed, hits }) => ({
    ...raw,
    source,
    text: observedText.slice(0, 1200),
    query: raw.query?.trim().slice(0, 300),
    observedAt: raw.observedAt ?? new Date().toISOString(),
    volumeScore: clampScore(raw.volumeScore, 35),
    velocityScore: clampScore(raw.velocityScore, 25),
    sourceConfidence: clampScore(raw.sourceConfidence, sourceConfidenceDefaults[source] ?? 60),
    commercialIntent: enrichedCommercialIntent,
    competitionPressure: clampScore(raw.competitionPressure, 50),
    sourceUrl: raw.sourceUrl?.trim().slice(0, 1000),
    theme: seed.theme,
    velvetFit: seed.velvetFit,
    matchedPhrases: hits,
    travelerIntent: intent.travelerIntent,
    travelerIntentScore: intent.travelerIntentScore,
    buyIntent: intent.buyIntent,
    buyIntentScore: intent.buyIntentScore,
    purchaseCategory: intent.purchaseCategory,
    travelerCues: intent.travelerCues,
    buyCues: intent.buyCues,
  }));
}

export function toRadarSignal(observation: NormalizedRadarObservation): RadarSignal {
  return {
    theme: observation.theme,
    source: observation.source,
    observedAt: observation.observedAt ?? new Date().toISOString(),
    volumeScore: observation.volumeScore ?? 35,
    velocityScore: observation.velocityScore ?? 25,
    sourceConfidence: observation.sourceConfidence ?? 60,
    velvetFit: observation.velvetFit,
    commercialIntent: observation.commercialIntent ?? 35,
    competitionPressure: observation.competitionPressure ?? 50,
  };
}

export function getUnmatchedSeedPrompts() {
  return parisRadarSeeds.map((seed) => ({
    theme: seed.theme,
    phrases: seed.phrases,
  }));
}
