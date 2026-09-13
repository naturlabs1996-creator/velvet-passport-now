import type { KeywordUniverse } from "./search-demand";

export type ThemeResolutionMethod = "EXACT" | "ALIAS" | "SEMANTIC" | "UNRESOLVED";

export type ThemeResolution = {
  rawTheme: string;
  canonicalTheme?: string;
  method: ThemeResolutionMethod;
  confidence: number;
  reason: string;
};

const ALIASES: Record<string, string> = {
  "non-touristy-paris": "beyond-the-classics",
  "off-the-beaten-path-paris": "beyond-the-classics",
  "hidden-gems-paris": "beyond-the-classics",
  "away-from-tourists-paris": "beyond-the-classics",
  "literary-paris": "hidden-bookshops",
  "literary-bookshops-paris": "hidden-bookshops",
  "secret-bookshops-paris": "hidden-bookshops",
  "quiet-places-paris": "quiet-paris",
  "peaceful-paris": "quiet-paris",
  "hidden-gardens-paris": "secret-gardens",
  "secret-courtyards-paris": "secret-gardens",
  "hidden-passages-paris": "forgotten-passages",
  "secret-passages-paris": "forgotten-passages",
  "hidden-museums-paris": "unusual-museums",
  "paris-at-night": "paris-after-dark",
  "rainy-paris": "rainy-day-paris",
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function tokens(value: string) {
  return new Set(normalize(value).split("-").filter((token) => token.length >= 3 && token !== "paris"));
}

function similarity(a: string, b: string) {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size || !right.size) return 0;
  const overlap = [...left].filter((token) => right.has(token)).length;
  return overlap / Math.max(left.size, right.size);
}

export function resolveTheme(rawTheme: string, universe: KeywordUniverse): ThemeResolution {
  const normalizedRaw = normalize(rawTheme);
  const exact = universe.themes.find((item) => normalize(item.theme) === normalizedRaw);
  if (exact) {
    return {
      rawTheme,
      canonicalTheme: exact.theme,
      method: "EXACT",
      confidence: 100,
      reason: "Raw theme exactly matches a canonical universe theme.",
    };
  }

  const alias = ALIASES[normalizedRaw];
  if (alias && universe.themes.some((item) => item.theme === alias)) {
    return {
      rawTheme,
      canonicalTheme: alias,
      method: "ALIAS",
      confidence: 95,
      reason: `Known intent alias resolves ${rawTheme} to ${alias}.`,
    };
  }

  const ranked = universe.themes
    .map((item) => ({
      theme: item.theme,
      score: Math.max(
        similarity(rawTheme, item.theme),
        ...item.keywords.map((keyword) => similarity(rawTheme, keyword)),
      ),
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const second = ranked[1];
  const margin = (best?.score ?? 0) - (second?.score ?? 0);
  if (best && best.score >= 0.6 && margin >= 0.15) {
    return {
      rawTheme,
      canonicalTheme: best.theme,
      method: "SEMANTIC",
      confidence: Math.min(90, Math.round(best.score * 100)),
      reason: `Theme intent has strong lexical overlap with canonical cluster ${best.theme}.`,
    };
  }

  return {
    rawTheme,
    method: "UNRESOLVED",
    confidence: 0,
    reason: "No canonical theme matched with sufficient confidence. Preserve this signal for research instead of dropping it silently.",
  };
}

export function resolveThemePortfolio(rawThemes: string[], universe: KeywordUniverse) {
  return rawThemes.map((theme) => resolveTheme(theme, universe));
}
