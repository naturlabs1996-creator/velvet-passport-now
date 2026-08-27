import { findSeedMatches, parisRadarSeeds } from "./radar-seeds";
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

export function normalizeRadarObservation(raw: RawRadarObservation): NormalizedRadarObservation[] {
  const source = raw.source.trim().toLowerCase();
  if (!allowedSources[raw.sourceType]?.has(source)) return [];

  // Theme classification must come from what the traveler/content actually says.
  // The search query is retained only as provenance and must never force a match.
  const observedText = raw.text.trim();
  if (!observedText) return [];

  const matches = findSeedMatches(observedText);
  return matches.map(({ seed, hits }) => ({
    ...raw,
    source,
    text: observedText.slice(0, 1200),
    query: raw.query?.trim().slice(0, 300),
    observedAt: raw.observedAt ?? new Date().toISOString(),
    volumeScore: clampScore(raw.volumeScore, 35),
    velocityScore: clampScore(raw.velocityScore, 25),
    sourceConfidence: clampScore(raw.sourceConfidence, sourceConfidenceDefaults[source] ?? 60),
    commercialIntent: clampScore(raw.commercialIntent, raw.sourceType === "BUY" ? 75 : 35),
    competitionPressure: clampScore(raw.competitionPressure, 50),
    sourceUrl: raw.sourceUrl?.trim().slice(0, 1000),
    theme: seed.theme,
    velvetFit: seed.velvetFit,
    matchedPhrases: hits,
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
