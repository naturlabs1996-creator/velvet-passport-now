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

const USER_AGENT = "VelvetPassportEvidenceHunter/1.4 (semantic discovery probes + strict entity-bound proof)";

const COLD_START_TERMS: Record<string, string[]> = {
  "beyond-the-classics": ["unusual", "off the beaten", "less known", "insolite", "atypical", "under the radar", "méconnu", "peu connu"],
  "quiet-paris": ["quiet", "peaceful", "calm", "tranquil", "away from crowds", "paisible", "peu fréquenté"],
  "secret-gardens": ["hidden garden", "secret garden", "jardin secret", "courtyard garden"],
  "forgotten-passages": ["covered passage", "passage couvert", "historic covered passage", "hidden passage", "secret passage", "forgotten passage", "passage méconnu"],
  "hidden-bookshops": ["independent bookstore", "independent bookshop", "literary bookshop", "librairie indépendante"],
  "unusual-museums": ["unusual museum", "musée insolite", "insolite", "atypical museum", "musée atypique", "quirky museum", "offbeat museum", "cabinet of curiosities", "cabinet de curiosités", "méconnu", "singulier"],
  "paris-after-dark": ["late opening", "open late", "nocturne", "evening opening", "night visit", "soirée", "ouvert le soir", "ouverture nocturne"],
  "rainy-day-paris": ["indoor", "covered", "inside", "sheltered"],
};

// Discovery probes are allowed to FIND pages, never to prove the active intent.
// A page found through one of these probes must still contain an entity-bound
// allowlisted claim term before it can become an IndependentEvidenceHit.
const SEMANTIC_DISCOVERY_PROBES: Record<string, string[]> = {
  "beyond-the-classics": ["underground", "beneath Paris", "artist house", "house museum", "archaeological remains", "hidden courtyard", "specialist collection"],
  "unusual-museums": ["underground museum", "beneath Paris", "sewer museum", "archaeological crypt", "artist house museum", "specialist collection", "curiosity collection"],
  "paris-after-dark": ["Friday night", "Thursday night", "evening hours", "last admission", "night tour", "after-hours"],
  "quiet-paris": ["small museum", "garden studio", "residential museum", "courtyard", "intimate museum"],
  "forgotten-passages": ["covered arcade", "historic arcade", "passageway", "gallery passage"],
  "secret-gardens": ["courtyard", "inner garden", "private garden open to public"],
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
function quote(term: string) {
  return `\"${term.replace(/\"/g, "")}\"`;
}
function buildQueries(name: string, claimTerms: string[], theme?: string) {
  const strict = claimTerms.slice(0, 8);
  const probes = (SEMANTIC_DISCOVERY_PROBES[theme ?? ""] ?? []).slice(0, 6);
  const simpleStrict = strict.slice(0, 4).map((term) => `${quote(name)} Paris ${quote(term)}`);
  const simpleProbe = probes.slice(0, 3).map((term) => `${quote(name)} Paris ${quote(term)}`);
  const broadStrict = strict.length ? `${quote(name)} Paris ${strict.slice(0, 4).join(" ")} -site:wikipedia.org` : "";
  const editorial = strict.length ? `${quote(name)} Paris review ${strict.slice(0, 3).join(" ")}` : "";
  return [...new Set([...simpleStrict, ...simpleProbe, broadStrict, editorial].filter(Boolean))];
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
  const explicitTerms = [...new Set(params.claimTerms.map((term) => term.trim()).filter(Boolean))].slice(0, 8);
  const coldStart = explicitTerms.length === 0 && Boolean(params.allowColdStart && params.theme);
  const observedTerms = coldStart ? (COLD_START_TERMS[params.theme ?? ""] ?? []).slice(0, 12) : explicitTerms;
  const equivalence = expandEquivalentClaimTerms(params.theme, observedTerms);
  const claimTerms = [...new Set([...observedTerms, ...equivalence.terms])].slice(0, 24);
  const existingFamilies = new Set(params.existingFamilies.map((family) => family.toLowerCase()));
  const existingUrls = new Set(params.existingUrls ?? []);
  const maxSearches = Math.max(1, Math.min(params.maxSearches ?? 4, 6));
  const queries = claimTerms.length ? buildQueries(params.name, claimTerms, params.theme).slice(0, maxSearches) : [];
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

  const uniqueUrls = [...new Set(candidateUrls)].slice(0, Math.max(1, Math.min(params.maxPages ?? 6, 8)));
  // Critical safeguard: semantic discovery probes are NOT passed as evidence terms.
  // They can discover a page, but the page must contain an allowlisted claim/equivalent.
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
    rule: `Hunter V1.4 uses simple multilingual intent queries plus semantic discovery probes to locate harder-to-find editorial pages. Discovery probes never count as intent evidence: a returned page must still contain identity-matched, allowlisted claim language or an allowlisted equivalent before it becomes a hit. For unusual-museums, generic museum/category membership remains insufficient. Existing publisher families and URLs are excluded, and search recurrence alone never counts as corroboration. ${CLAIM_EQUIVALENCE_RULE}`,
  };
}
