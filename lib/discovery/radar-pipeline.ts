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
  travelSpendIntent: IntentStrength;
  travelSpendIntentScore: number;
  velvetIntent: IntentStrength;
  velvetIntentScore: number;
  velvetOpportunity: IntentStrength;
  velvetOpportunityScore: number;
  purchaseCategory: PurchaseCategory;
  travelerCues: string[];
  buyCues: string[];
  velvetCues: string[];
};

const allowedSources: Record<RadarSourceType, Set<string>> = {
  ASK: new Set(["reddit", "tripadvisor", "facebook-groups"]),
  SEARCH: new Set(["google-trends", "google-suggest"]),
  SAVE: new Set(["pinterest", "atlas", "wanderlog", "polarsteps", "google-maps"]),
  DISCOVER: new Set(["threads", "substack", "instagram", "tiktok"]),
  BUY: new Set(["etsy", "amazon", "google-play-books", "getyourguide", "viator"]),
};

const sourceConfidenceDefaults: Record<string, number> = {
  "google-trends": 92,
  "google-suggest": 90,
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

const intentStrength = (score: number): IntentStrength => {
  if (score >= 75) return "STRONG";
  if (score >= 45) return "MEDIUM";
  if (score >= 20) return "WEAK";
  return "NONE";
};

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

  if (source === "reddit" && !isFreshEnough(raw.observedAt, 30)) return [];

  const observedText = raw.text.trim();
  if (!observedText) return [];

  const intent = classifyRadarIntent(observedText);
  if (raw.sourceType === "ASK" && intent.travelerIntentScore < 20) return [];

  const matches = findSeedMatches(observedText);
  const baseCommercialIntent = clampScore(raw.commercialIntent, raw.sourceType === "BUY" ? 75 : 35);
  const enrichedCommercialIntent = Math.max(baseCommercialIntent, intent.travelSpendIntentScore);

  return matches.map(({ seed, hits }) => {
    const velvetNeedScore = intent.velvetNeedScore ?? 0;
    const logisticsDominanceScore = intent.logisticsDominanceScore ?? 0;

    let velvetOpportunityScore = Math.round(
      seed.velvetFit * 0.35 +
      intent.travelerIntentScore * 0.18 +
      intent.velvetIntentScore * 0.12 +
      velvetNeedScore * 0.35
    );

    if (velvetNeedScore < 20) velvetOpportunityScore -= 18;
    if (logisticsDominanceScore >= 45 && velvetNeedScore < 45) velvetOpportunityScore -= 25;
    if ((intent.purchaseCategory === "LODGING" || intent.purchaseCategory === "TRANSPORT") && velvetNeedScore < 45) velvetOpportunityScore -= 18;
    if (hits.length >= 2 && velvetNeedScore >= 20) velvetOpportunityScore += 5;
    if (velvetNeedScore >= 75) velvetOpportunityScore += 8;
    velvetOpportunityScore = clampScore(velvetOpportunityScore, 0);

    return {
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
      travelSpendIntent: intent.travelSpendIntent,
      travelSpendIntentScore: intent.travelSpendIntentScore,
      velvetIntent: intent.velvetIntent,
      velvetIntentScore: intent.velvetIntentScore,
      velvetOpportunity: intentStrength(velvetOpportunityScore),
      velvetOpportunityScore,
      purchaseCategory: intent.purchaseCategory,
      travelerCues: intent.travelerCues,
      buyCues: intent.buyCues,
      velvetCues: intent.velvetCues,
    };
  });
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
