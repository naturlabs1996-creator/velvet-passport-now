export type RadarState = "LIVE" | "RISING" | "STRUCTURAL" | "WATCH";

export type RadarSignal = {
  theme: string;
  source: string;
  observedAt: string;
  volumeScore: number;
  velocityScore: number;
  sourceConfidence: number;
  velvetFit: number;
  commercialIntent: number;
  competitionPressure: number;
};

export type RadarOpportunity = {
  theme: string;
  score: number;
  state: RadarState;
  sources: string[];
  sourceCount: number;
  avgVelocity: number;
  avgVelvetFit: number;
  avgCommercialIntent: number;
  avgCompetitionPressure: number;
  action: "AMPLIFY" | "TEST" | "MONITOR";
};

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export function scoreOpportunity(signals: RadarSignal[]): RadarOpportunity | null {
  if (signals.length === 0) return null;

  const theme = signals[0].theme;
  const sources = [...new Set(signals.map((signal) => signal.source))];
  const avg = (key: keyof Pick<RadarSignal, "volumeScore" | "velocityScore" | "sourceConfidence" | "velvetFit" | "commercialIntent" | "competitionPressure">) =>
    signals.reduce((sum, signal) => sum + signal[key], 0) / signals.length;

  const volume = avg("volumeScore");
  const velocity = avg("velocityScore");
  const confidence = avg("sourceConfidence");
  const velvetFit = avg("velvetFit");
  const commercialIntent = avg("commercialIntent");
  const competitionPressure = avg("competitionPressure");
  const convergence = clamp(sources.length * 18);

  const score = clamp(
    volume * 0.16 +
      velocity * 0.26 +
      confidence * 0.12 +
      velvetFit * 0.2 +
      commercialIntent * 0.16 +
      convergence * 0.16 -
      competitionPressure * 0.06,
  );

  let state: RadarState = "WATCH";
  if (velocity >= 80 && sources.length >= 2 && score >= 72) state = "LIVE";
  else if (velocity >= 58 && sources.length >= 2 && score >= 62) state = "RISING";
  else if (volume >= 55 && velvetFit >= 70 && sources.length >= 3) state = "STRUCTURAL";

  const action = state === "LIVE" ? "AMPLIFY" : state === "RISING" || state === "STRUCTURAL" ? "TEST" : "MONITOR";

  return {
    theme,
    score: Math.round(score),
    state,
    sources,
    sourceCount: sources.length,
    avgVelocity: Math.round(velocity),
    avgVelvetFit: Math.round(velvetFit),
    avgCommercialIntent: Math.round(commercialIntent),
    avgCompetitionPressure: Math.round(competitionPressure),
    action,
  };
}

export const parisRadarThemes = [
  "non-touristy-paris",
  "hidden-bookshops",
  "quiet-paris",
  "forgotten-passages",
  "secret-gardens",
  "unusual-museums",
  "literary-paris",
  "paris-after-dark",
  "rainy-day-paris",
  "local-neighborhoods",
  "romantic-hidden-places",
  "beyond-the-classics",
] as const;

export const parisRadarSources = {
  ASK: ["reddit", "tripadvisor", "facebook-groups"],
  SEARCH: ["google-trends"],
  SAVE: ["pinterest", "atlas", "wanderlog", "polarsteps", "google-maps"],
  DISCOVER: ["threads", "substack", "instagram", "tiktok"],
  BUY: ["etsy", "amazon", "google-play-books", "getyourguide", "viator"],
} as const;
