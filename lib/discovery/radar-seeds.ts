export type RadarSeed = {
  theme: string;
  label: string;
  intent: string;
  velvetFit: number;
  phrases: string[];
  conceptGroups?: string[][];
};

const DISCOVERY_WORDS = [
  "hidden", "secret", "unusual", "obscure", "overlooked", "unknown", "underrated",
  "unexpected", "alternative", "quirky", "curious", "forgotten", "local", "uncrowded",
  "quiet", "peaceful", "tranquil", "serene", "rare", "offbeat", "off-beat",
];

export const parisRadarSeeds: RadarSeed[] = [
  {
    theme: "non-touristy-paris",
    label: "Paris without the crowds",
    intent: "Find places that feel local, calm or overlooked rather than mass-tourism stops.",
    velvetFit: 96,
    phrases: [
      "non touristy paris", "paris without tourists", "where locals go in paris", "away from crowds in paris",
      "paris like a local", "places tourists miss in paris", "what to do after seeing the main sights in paris",
      "off the beaten path paris", "off the beaten track paris", "beyond tourist traps paris", "avoid tourist traps paris",
      "hidden side of paris", "less touristy paris", "local side of paris", "under the radar paris", "overlooked places paris",
    ],
    conceptGroups: [
      ["tourist", "crowd"], ["tourists", "crowds"], ["local", "place"], ["locals", "go"],
      ["off", "beaten", "path"], ["tourist", "trap"], ["under", "radar"], ["overlooked", "place"],
    ],
  },
  {
    theme: "hidden-bookshops",
    label: "Hidden bookshops",
    intent: "Discover literary places, independent bookshops and atmospheric reading spaces.",
    velvetFit: 96,
    phrases: [
      "hidden bookshops paris", "independent bookstores paris", "literary paris bookstores", "unusual bookstores paris",
      "bookshops tourists miss paris", "best small bookstores paris", "secret bookshops paris", "quirky bookstores paris",
      "book lover places paris", "rare bookstores paris", "atmospheric bookstores paris",
    ],
    conceptGroups: [
      ["bookshop", ...DISCOVERY_WORDS], ["bookstore", ...DISCOVERY_WORDS], ["books", "independent"],
      ["literary", "bookshop"], ["literary", "bookstore"], ["book", "lover"],
    ],
  },
  {
    theme: "quiet-paris",
    label: "Quiet Paris",
    intent: "Escape noise, crowds and overstimulation while remaining inside Paris.",
    velvetFit: 94,
    phrases: [
      "quiet places paris", "peaceful places paris", "calm places paris", "quiet neighborhoods paris", "escape crowds paris",
      "relaxing places paris", "calm paris", "slow paris", "serene places paris", "peaceful corners paris", "uncrowded paris", "tranquil paris",
    ],
    conceptGroups: [
      ["quiet", "place"], ["quiet", "neighborhood"], ["peaceful", "place"], ["calm", "place"],
      ["escape", "crowd"], ["avoid", "crowd"], ["tranquil", "place"], ["serene", "place"], ["slow", "paris"],
    ],
  },
  {
    theme: "forgotten-passages",
    label: "Forgotten passages",
    intent: "Find old passages, alleys, courtyards and overlooked fragments of historic Paris.",
    velvetFit: 99,
    phrases: [
      "hidden passages paris", "forgotten passages paris", "secret passageways paris", "hidden courtyards paris", "old alleys paris",
      "covered passages paris hidden", "historic passageways paris", "secret alleys paris", "forgotten alleys paris",
      "hidden arcades paris", "secret courtyards paris", "overlooked courtyards paris",
    ],
    conceptGroups: [
      ["passage", ...DISCOVERY_WORDS], ["passageway", ...DISCOVERY_WORDS], ["alley", ...DISCOVERY_WORDS],
      ["courtyard", ...DISCOVERY_WORDS], ["arcade", ...DISCOVERY_WORDS], ["covered", "passage"],
    ],
  },
  {
    theme: "secret-gardens",
    label: "Secret gardens",
    intent: "Find small, hidden or less crowded green spaces with atmosphere.",
    velvetFit: 96,
    phrases: [
      "secret gardens paris", "hidden gardens paris", "quiet gardens paris", "small gardens paris", "peaceful parks paris",
      "romantic gardens paris", "hidden parks paris", "secret parks paris", "green oasis paris", "hidden green spaces paris", "quiet parks paris",
    ],
    conceptGroups: [
      ["garden", ...DISCOVERY_WORDS], ["park", ...DISCOVERY_WORDS], ["green", "oasis"], ["green", "space", "hidden"],
    ],
  },
  {
    theme: "unusual-museums",
    label: "Unusual museums",
    intent: "Find small, strange, specialist or overlooked museums beyond the headline institutions.",
    velvetFit: 91,
    phrases: [
      "unusual museums paris", "small museums paris", "hidden museums paris", "weird museums paris", "lesser known museums paris",
      "museums tourists miss paris", "quirky museums paris", "strange museums paris", "obscure museums paris", "specialist museums paris",
      "unusual attractions paris", "curious places paris",
    ],
    conceptGroups: [
      ["museum", ...DISCOVERY_WORDS, "weird", "strange", "specialist", "small"],
      ["attraction", "unusual"], ["attraction", "quirky"], ["attraction", "obscure"],
    ],
  },
  {
    theme: "literary-paris",
    label: "Literary Paris",
    intent: "Experience Paris through writers, books, historic cafés and literary neighborhoods.",
    velvetFit: 95,
    phrases: [
      "literary paris", "writers paris", "book lover paris", "literary walk paris", "authors places paris", "literary cafes paris",
      "writers cafes paris", "bookish paris", "literary neighborhoods paris", "historic literary paris", "authors paris",
    ],
    conceptGroups: [
      ["literary", "cafe"], ["literary", "walk"], ["literary", "neighborhood"], ["writer", "cafe"],
      ["author", "place"], ["bookish", "paris"], ["writer", "paris"],
    ],
  },
  {
    theme: "paris-after-dark",
    label: "Paris after dark",
    intent: "Discover atmospheric, discreet and memorable Paris experiences after evening begins.",
    velvetFit: 92,
    phrases: [
      "paris after dark", "hidden paris at night", "unusual things to do paris at night", "quiet paris evening", "romantic paris at night",
      "secret paris nightlife", "atmospheric paris at night", "late night paris hidden", "nighttime paris hidden gems", "unusual paris evening",
    ],
    conceptGroups: [
      ["night", ...DISCOVERY_WORDS], ["nighttime", ...DISCOVERY_WORDS], ["evening", "unusual"],
      ["evening", "hidden"], ["after", "dark"], ["nightlife", "secret"],
    ],
  },
  {
    theme: "rainy-day-paris",
    label: "Rainy-day Paris",
    intent: "Find atmospheric indoor or weather-resistant discoveries when plans are disrupted by rain.",
    velvetFit: 86,
    phrases: [
      "paris rainy day", "what to do in paris when it rains", "indoor hidden gems paris", "rainy afternoon paris",
      "paris rain itinerary", "indoor unusual places paris", "hidden indoor paris", "rainy day hidden paris",
    ],
    conceptGroups: [
      ["rain", "indoor"], ["rainy", "indoor"], ["rainy", "day"], ["when", "rains"], ["indoor", "hidden"], ["indoor", "unusual"],
    ],
  },
  {
    theme: "beyond-the-classics",
    label: "Beyond the classics",
    intent: "Help repeat visitors or experienced travelers find worthwhile places after the standard Paris checklist.",
    velvetFit: 98,
    phrases: [
      "paris beyond the classics", "second time in paris what to do", "been to paris before what should i see", "paris after main attractions",
      "different things to do paris", "unique paris experiences", "lesser known paris", "unusual things to do paris", "hidden gems paris",
      "secret places paris", "unexpected paris", "obscure places paris", "overlooked paris", "alternative paris", "curious paris",
    ],
    conceptGroups: [
      ["second", "time", "paris"], ["repeat", "visitor"], ["beyond", "classic"],
      ["main", "attraction", "after"], ["hidden", "gem"], ["lesser", "known"], ["different", "thing"],
      ["unique", "experience"], ["unexpected", "place"], ["alternative", "paris"],
    ],
  },
];

const normalizeText = (value: string) => value
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9\s-]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const singularize = (token: string) => token.length > 4 && token.endsWith("s") ? token.slice(0, -1) : token;
const orderedTokensOf = (value: string) => normalizeText(value).split(" ").filter(Boolean).map(singularize);
const tokensOf = (value: string) => new Set(orderedTokensOf(value));
const STOPWORDS = new Set(["paris", "france", "the", "a", "an", "and", "or", "to", "of", "in", "for", "at", "on", "what", "do", "i", "see"]);

function phraseSimilarity(textTokens: Set<string>, phrase: string) {
  const phraseTokens = [...tokensOf(phrase)].filter((token) => !STOPWORDS.has(token));
  if (!phraseTokens.length) return 0;
  const matched = phraseTokens.filter((token) => textTokens.has(token)).length;
  return matched / phraseTokens.length;
}

function phraseProximity(text: string, phrase: string, maxWindow = 14) {
  const textTokens = orderedTokensOf(text);
  const phraseTokens = orderedTokensOf(phrase).filter((token) => !STOPWORDS.has(token));
  if (phraseTokens.length < 2) return true;
  const positions = phraseTokens.map((token) => textTokens.reduce<number[]>((acc, current, index) => {
    if (current === token) acc.push(index);
    return acc;
  }, []));
  if (positions.some((group) => group.length === 0)) return false;

  let bestSpan = Number.POSITIVE_INFINITY;
  const walk = (depth: number, chosen: number[]) => {
    if (depth === positions.length) {
      const span = Math.max(...chosen) - Math.min(...chosen);
      bestSpan = Math.min(bestSpan, span);
      return;
    }
    for (const position of positions[depth]) {
      if (bestSpan <= maxWindow) return;
      walk(depth + 1, [...chosen, position]);
    }
  };
  walk(0, []);
  return bestSpan <= maxWindow;
}

function conceptGroupHit(textTokens: Set<string>, group: string[]) {
  const normalized = group.map(singularize);
  if (normalized.length <= 2) return normalized.every((token) => textTokens.has(token));

  const anchor = normalized[0];
  return textTokens.has(anchor) && normalized.slice(1).some((token) => textTokens.has(token));
}

function authorRepeatVisitorSignal(normalized: string) {
  const positive = [
    /\b(i|we|my partner and i|my family and i)\s+(have\s+)?(already\s+)?(been|visited|traveled|travelled)\s+to\s+paris\b/,
    /\b(i|we)\s+(have\s+)?been\s+in\s+paris\s+before\b/,
    /\b(i|we)\s+(am|are|'m|'re)?\s*(returning|going back|back)\s+to\s+paris\b/,
    /\b(my|our)\s+(second|third|fourth|fifth)\s+(trip|visit|time)\s+(to|in)\s+paris\b/,
    /\b(second|third|fourth|fifth)\s+time\s+(visiting|in|to)\s+paris\b/,
  ];
  return positive.some((pattern) => pattern.test(normalized));
}

function suppressRepeatVisitorFalsePositive(normalized: string) {
  const adviceFromOthers = [
    /\bpeople who have (already )?been to paris\b/,
    /\bothers who have (already )?been to paris\b/,
    /\banyone who has (already )?been to paris\b/,
    /\bpeople who have visited paris\b/,
    /\bfrom people who (have )?know paris\b/,
  ];
  return adviceFromOthers.some((pattern) => pattern.test(normalized)) && !authorRepeatVisitorSignal(normalized);
}

export function findSeedMatches(text: string) {
  const normalized = normalizeText(text);
  const textTokens = tokensOf(normalized);
  const repeatVisitor = authorRepeatVisitorSignal(normalized);
  const suppressRepeat = suppressRepeatVisitorFalsePositive(normalized);

  return parisRadarSeeds
    .map((seed) => {
      const exactHits = seed.phrases.filter((phrase) => {
        const normalizedPhrase = normalizeText(phrase);
        if (!normalized.includes(normalizedPhrase)) return false;
        if (seed.theme === "beyond-the-classics" && normalizedPhrase.includes("been to paris before") && !repeatVisitor) return false;
        return true;
      });

      const fuzzyHits = seed.phrases
        .filter((phrase) => {
          if (exactHits.includes(phrase)) return false;
          if (phraseSimilarity(textTokens, phrase) < 0.72) return false;
          if (!phraseProximity(normalized, phrase)) return false;
          if (seed.theme === "beyond-the-classics" && /been to paris before|second time in paris/i.test(phrase) && (!repeatVisitor || suppressRepeat)) return false;
          return true;
        })
        .map((phrase) => `~${phrase}`);

      const conceptHits = (seed.conceptGroups ?? [])
        .filter((group) => conceptGroupHit(textTokens, group))
        .map((group) => `#${group.slice(0, 3).join("+")}`);

      const hits = [...exactHits, ...fuzzyHits, ...conceptHits];
      return { seed, hits };
    })
    .filter((match) => match.hits.length > 0);
}
