import { fetchDeepEvidenceWindows, sourceFamilyOf } from "./deep-source-evidence";
import { CLAIM_EQUIVALENCE_RULE, equivalentClaimMatch, expandEquivalentClaimTerms } from "./claim-equivalence";

export type IndependentEvidenceHit = {
  url: string;
  sourceFamily: string;
  matchedTerms: string[];
  equivalentFamilies: string[];
  text: string;
};

export type IndependentEvidenceHunterResult = {
  queries: string[];
  attemptedSearches: number;
  candidateUrls: number;
  deepPagesOpened: number;
  hits: IndependentEvidenceHit[];
  independentFamiliesAdded: string[];
  equivalenceFamiliesUsed: string[];
  mode: "CORROBORATE" | "COLD_START";
  rule: string;
};

const USER_AGENT = "VelvetPassportEvidenceHunter/1.3 (explicit unusualness cold-start + independent corroboration + allowlisted equivalence)";

const COLD_START_TERMS: Record<string, string[]> = {
  "beyond-the-classics": ["unusual", "off the beaten", "less known", "insolite", "atypical", "under the radar"],
  "quiet-paris": ["quiet", "peaceful", "calm", "tranquil", "away from crowds"],
  "secret-gardens": ["hidden garden", "secret garden", "jardin secret", "courtyard garden"],
  "forgotten-passages": ["covered passage", "passage couvert", "historic covered passage", "hidden passage", "secret passage", "forgotten passage"],
  "hidden-bookshops": ["independent bookstore", "independent bookshop", "literary bookshop", "librairie indépendante"],
  "unusual-museums": ["unusual museum", "musée insolite", "insolite", "atypical museum", "musée atypique", "quirky museum", "offbeat museum", "cabinet of curiosities", "cabinet de curiosités"],
  "paris-after-dark": ["late opening", "open late", "nocturne", "evening opening", "night visit", "soirée"],
  "rainy-day-paris": ["indoor", "covered", "inside", "sheltered"],
};

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function xmlItems(xml: string) {
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  const read = (block: string, tag: string) => {
    const match = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i"));
    return stripHtml((match?.[1] ?? "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
  };
  return blocks.map((block) => ({ title: read(block, "title"), link: read(block, "link"), description: read(block, "description") })).filter((item) => item.title && item.link);
}
async function fetchWithTimeout(url: string, timeoutMs = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "application/rss+xml,text/xml,*/*" },
      signal: controller.signal,
      next: { revalidate: 21600 },
    });
  } finally {
    clearTimeout(timer);
  }
}
function identityTokens(name: string) {
  return normalize(name).split(/[^a-z0-9]+/).filter((token) => token.length >= 4 && !["musee", "museum", "paris", "france"].includes(token));
}
function identityMatch(name: string, text: string) {
  const normalized = normalize(text);
  const full = normalize(name);
  if (full.length >= 7 && normalized.includes(full)) return true;
  const tokens = identityTokens(name);
  if (!tokens.length) return false;
  return tokens.length === 1 ? normalized.includes(tokens[0]) : tokens.filter((token) => normalized.includes(token)).length >= Math.min(2, tokens.length);
}
function buildQueries(name: string, claimTerms: string[]) {
  const terms = claimTerms.slice(0, 6);
  const quotedTerms = terms.slice(0, 4).map((term) => `\"${term}\"`).join(" OR ");
  const primary = `\"${name}\" Paris (${quotedTerms})`;
  const corroborate = `\"${name}\" Paris ${terms.slice(0, 4).join(" ")} -site:wikipedia.org`;
  const editorial = `\"${name}\" Paris review ${terms.slice(0, 4).join(" ")}`;
  return [...new Set([primary, corroborate, editorial])].slice(0, 3);
}

export async function huntIndependentEvidence(params: {
  name: string;
  theme?: string;
  claimTerms: string[];
  existingFamilies: string[];
  existingUrls?: string[];
  maxSearches?: number;
  maxPages?: number;
  allowColdStart?: boolean;
}): Promise<IndependentEvidenceHunterResult> {
  const explicitTerms = [...new Set(params.claimTerms.map((term) => term.trim()).filter(Boolean))].slice(0, 6);
  const coldStart = explicitTerms.length === 0 && Boolean(params.allowColdStart && params.theme);
  const observedTerms = coldStart ? (COLD_START_TERMS[params.theme ?? ""] ?? []).slice(0, 9) : explicitTerms;
  const equivalence = expandEquivalentClaimTerms(params.theme, observedTerms);
  const claimTerms = [...new Set([...observedTerms, ...equivalence.terms])].slice(0, 18);
  const existingFamilies = new Set(params.existingFamilies.map((family) => family.toLowerCase()));
  const existingUrls = new Set(params.existingUrls ?? []);
  const queries = claimTerms.length ? buildQueries(params.name, claimTerms).slice(0, Math.max(1, Math.min(params.maxSearches ?? 3, 4))) : [];
  const candidateUrls: string[] = [];
  let attemptedSearches = 0;

  for (const query of queries) {
    attemptedSearches += 1;
    try {
      const response = await fetchWithTimeout(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`);
      if (!response.ok) continue;
      const xml = await response.text();
      for (const item of xmlItems(xml).slice(0, 10)) {
        if (!identityMatch(params.name, `${item.title} ${item.description}`)) continue;
        if (existingUrls.has(item.link)) continue;
        const family = sourceFamilyOf(item.link).toLowerCase();
        if (!family || existingFamilies.has(family)) continue;
        candidateUrls.push(item.link);
      }
    } catch {
      // Search failure remains unknown and never becomes negative evidence.
    }
  }

  const uniqueUrls = [...new Set(candidateUrls)].slice(0, Math.max(1, Math.min(params.maxPages ?? 5, 6)));
  const deep = await fetchDeepEvidenceWindows(params.name, uniqueUrls, claimTerms, uniqueUrls.length || 1);
  const hits = deep.windows
    .filter((window) => window.terms.length > 0)
    .filter((window) => !existingFamilies.has(window.sourceFamily.toLowerCase()))
    .map((window) => ({ window, match: equivalentClaimMatch(params.theme, observedTerms, window.terms) }))
    .filter(({ match }) => match.matched)
    .map(({ window, match }) => ({
      url: window.url,
      sourceFamily: window.sourceFamily,
      matchedTerms: window.terms,
      equivalentFamilies: match.sharedFamilies,
      text: window.text,
    }));
  const independentFamiliesAdded = [...new Set(hits.map((hit) => hit.sourceFamily))];

  return {
    queries,
    attemptedSearches,
    candidateUrls: uniqueUrls.length,
    deepPagesOpened: deep.opened,
    hits,
    independentFamiliesAdded,
    equivalenceFamiliesUsed: equivalence.families,
    mode: coldStart ? "COLD_START" : "CORROBORATE",
    rule: `Hunter V1.3 may cold-start only from a small theme-specific allowlist when a concrete resolved entity has no initial theme evidence. For unusual-museums, generic category words such as museum, musée, collection, cabinet, house museum or specialist museum are prohibited as cold-start proof; explicit unusualness is required. It still requires identity-matched local context, excludes already-counted families/URLs, and never grants CONFIRMED status by itself. Corroboration mode continues to search only the observed claim or an allowlisted equivalent. Search recurrence alone never counts as corroboration. ${CLAIM_EQUIVALENCE_RULE}`,
  };
}
