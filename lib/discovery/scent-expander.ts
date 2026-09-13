export type ScentTrail = {
  theme: string;
  queries: string[];
  microLocations: string[];
  strategy: string[];
};

const THEME_SCENTS: Record<string, string[]> = {
  "beyond-the-classics": [
    "small museum Paris France",
    "historic house museum Paris France",
    "unusual places Paris France",
    "less known places Paris France",
    "independent places Paris France",
    "historic courtyard Paris France",
    "covered passage Paris France",
    "atelier visit Paris France",
  ],
  "quiet-paris": [
    "small museum Paris France",
    "garden courtyard Paris France",
    "quiet places Paris France",
    "peaceful courtyard Paris France",
    "calm garden Paris France",
    "quiet square Paris France",
    "cloister Paris France",
    "quiet library Paris France",
  ],
  "secret-gardens": [
    "garden Paris France",
    "historic garden Paris France",
    "hidden garden Paris France",
    "small garden Paris France",
    "courtyard garden Paris France",
    "jardin confidentiel Paris",
  ],
  "forgotten-passages": [
    "passage Paris France",
    "covered passage Paris France",
    "historic passage Paris France",
    "galerie passage Paris France",
    "arcade Paris France historic",
    "passage couvert Paris",
  ],
  "hidden-bookshops": [
    "bookshop Paris France",
    "independent bookshop Paris France",
    "literary bookstore Paris France",
    "rare books Paris France",
    "historic bookshop Paris France",
    "librairie ancienne Paris",
    "specialist bookshop Paris France",
  ],
  "unusual-museums": [
    "museum Paris France",
    "house museum Paris France",
    "small unusual museum Paris France",
    "private collection museum Paris France",
    "cabinet collection Paris France",
    "musée insolite Paris",
  ],
  "paris-after-dark": [
    "museum Paris France",
    "cultural venue Paris France",
    "late opening museum Paris France",
    "night visit Paris France",
    "evening cultural place Paris France",
    "nocturne Paris museum",
    "late open gallery Paris France",
  ],
  "rainy-day-paris": [
    "small museum Paris France",
    "covered passage Paris France",
    "covered place Paris France",
    "indoor unusual place Paris France",
    "independent bookshop Paris France",
  ],
};

const MICRO_LOCATIONS = [
  "1st arrondissement", "2nd arrondissement", "3rd arrondissement", "4th arrondissement",
  "5th arrondissement", "6th arrondissement", "7th arrondissement", "8th arrondissement",
  "9th arrondissement", "10th arrondissement", "11th arrondissement", "12th arrondissement",
  "13th arrondissement", "14th arrondissement", "15th arrondissement", "16th arrondissement",
  "17th arrondissement", "18th arrondissement", "19th arrondissement", "20th arrondissement",
  "Le Marais", "Montmartre", "Saint-Germain-des-Prés", "Latin Quarter", "Canal Saint-Martin",
  "Belleville", "Batignolles", "Butte-aux-Cailles", "Passy", "Ménilmontant",
];

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function buildScentTrail(theme: string, primaryQuery: string, maxQueries = 8): ScentTrail {
  const base = THEME_SCENTS[theme] ?? [`${primaryQuery} Paris France place`, `${primaryQuery} Paris France address`];
  const queries = unique([
    primaryQuery,
    ...base,
    `${primaryQuery} Paris France official`,
    `${primaryQuery} Paris France address`,
  ]).slice(0, Math.max(2, Math.min(maxQueries, 12)));

  return {
    theme,
    queries,
    microLocations: MICRO_LOCATIONS,
    strategy: [
      "Acquire a concrete physical-place pool before asking whether each place fits the active traveler intent.",
      "Expand the traveler intent into several place-oriented semantic formulations.",
      "Prefer concrete venue/place terms over generic listicle language.",
      "Use micro-location follow-up only after a promising trail exists; do not fan out across all arrondissements blindly.",
      "Keep Destination Entity Lock and Research Relevance Engine mandatory for every expanded result.",
    ],
  };
}

export function buildMicroLocationFollowUps(query: string, candidateText: string, max = 3) {
  const haystack = candidateText.toLowerCase();
  const matched = MICRO_LOCATIONS.filter((place) => haystack.includes(place.toLowerCase()));
  return matched.slice(0, Math.max(0, Math.min(max, 5))).map((place) => `${query} ${place} Paris France`);
}
