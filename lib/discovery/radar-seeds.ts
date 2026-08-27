export type RadarSeed = {
  theme: string;
  label: string;
  intent: string;
  velvetFit: number;
  phrases: string[];
};

export const parisRadarSeeds: RadarSeed[] = [
  {
    theme: "non-touristy-paris",
    label: "Paris without the crowds",
    intent: "Find places that feel local, calm or overlooked rather than mass-tourism stops.",
    velvetFit: 96,
    phrases: [
      "non touristy paris",
      "paris without tourists",
      "where locals go in paris",
      "away from crowds in paris",
      "paris like a local",
      "places tourists miss in paris",
      "what to do after seeing the main sights in paris",
    ],
  },
  {
    theme: "hidden-bookshops",
    label: "Hidden bookshops",
    intent: "Discover literary places, independent bookshops and atmospheric reading spaces.",
    velvetFit: 96,
    phrases: [
      "hidden bookshops paris",
      "independent bookstores paris",
      "literary paris bookstores",
      "unusual bookstores paris",
      "bookshops tourists miss paris",
      "best small bookstores paris",
    ],
  },
  {
    theme: "quiet-paris",
    label: "Quiet Paris",
    intent: "Escape noise, crowds and overstimulation while remaining inside Paris.",
    velvetFit: 94,
    phrases: [
      "quiet places paris",
      "peaceful places paris",
      "calm places paris",
      "quiet neighborhoods paris",
      "escape crowds paris",
      "relaxing places paris",
    ],
  },
  {
    theme: "forgotten-passages",
    label: "Forgotten passages",
    intent: "Find old passages, alleys, courtyards and overlooked fragments of historic Paris.",
    velvetFit: 99,
    phrases: [
      "hidden passages paris",
      "forgotten passages paris",
      "secret passageways paris",
      "hidden courtyards paris",
      "old alleys paris",
      "covered passages paris hidden",
    ],
  },
  {
    theme: "secret-gardens",
    label: "Secret gardens",
    intent: "Find small, hidden or less crowded green spaces with atmosphere.",
    velvetFit: 96,
    phrases: [
      "secret gardens paris",
      "hidden gardens paris",
      "quiet gardens paris",
      "small gardens paris",
      "peaceful parks paris",
      "romantic gardens paris",
    ],
  },
  {
    theme: "unusual-museums",
    label: "Unusual museums",
    intent: "Find small, strange, specialist or overlooked museums beyond the headline institutions.",
    velvetFit: 91,
    phrases: [
      "unusual museums paris",
      "small museums paris",
      "hidden museums paris",
      "weird museums paris",
      "lesser known museums paris",
      "museums tourists miss paris",
    ],
  },
  {
    theme: "literary-paris",
    label: "Literary Paris",
    intent: "Experience Paris through writers, books, historic cafés and literary neighborhoods.",
    velvetFit: 95,
    phrases: [
      "literary paris",
      "writers paris",
      "book lover paris",
      "literary walk paris",
      "authors places paris",
      "literary cafes paris",
    ],
  },
  {
    theme: "paris-after-dark",
    label: "Paris after dark",
    intent: "Discover atmospheric, discreet and memorable Paris experiences after evening begins.",
    velvetFit: 92,
    phrases: [
      "paris after dark",
      "hidden paris at night",
      "unusual things to do paris at night",
      "quiet paris evening",
      "romantic paris at night",
      "secret paris nightlife",
    ],
  },
  {
    theme: "rainy-day-paris",
    label: "Rainy-day Paris",
    intent: "Find atmospheric indoor or weather-resistant discoveries when plans are disrupted by rain.",
    velvetFit: 86,
    phrases: [
      "paris rainy day",
      "what to do in paris when it rains",
      "indoor hidden gems paris",
      "rainy afternoon paris",
      "paris rain itinerary",
    ],
  },
  {
    theme: "beyond-the-classics",
    label: "Beyond the classics",
    intent: "Help repeat visitors or experienced travelers find worthwhile places after the standard Paris checklist.",
    velvetFit: 98,
    phrases: [
      "paris beyond the classics",
      "second time in paris what to do",
      "been to paris before what should i see",
      "paris after main attractions",
      "different things to do paris",
      "unique paris experiences",
    ],
  },
];

export function findSeedMatches(text: string) {
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  return parisRadarSeeds
    .map((seed) => ({
      seed,
      hits: seed.phrases.filter((phrase) => normalized.includes(phrase.toLowerCase())),
    }))
    .filter((match) => match.hits.length > 0);
}
