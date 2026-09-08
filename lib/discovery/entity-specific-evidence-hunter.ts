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

const USER_AGENT = "VelvetPassportEvidenceHunter/1.8 (raw RSS diagnostics + URL-aware identity navigation + strict deep proof)";

const COLD_START_TERMS: Record<string, string[]> = {
  "beyond-the-classics": ["unusual", "off the beaten", "less known", "insolite", "atypical", "under the radar", "méconnu", "peu connu", "hors du commun", "entrée discrète"],
  "quiet-paris": ["quiet", "peaceful", "calm", "tranquil", "away from crowds", "paisible", "peu fréquenté"],
  "secret-gardens": ["hidden garden", "secret garden", "jardin secret", "courtyard garden"],
  "forgotten-passages": ["covered passage", "passage couvert", "historic covered passage", "hidden passage", "secret passage", "forgotten passage", "passage méconnu"],
  "hidden-bookshops": ["independent bookstore", "independent bookshop", "literary bookshop", "librairie indépendante"],
  "unusual-museums": ["unusual museum", "musée insolite", "insolite", "atypical museum", "musée atypique", "quirky museum", "offbeat museum", "cabinet of curiosities", "cabinet de curiosités", "méconnu", "singulier", "hors du commun"],
  "paris-after-dark": ["late opening", "open late", "nocturne", "evening opening", "night visit", "soirée", "ouvert le soir", "ouverture nocturne"],
  "rainy-day-paris": ["indoor", "covered", "inside", "sheltered"],
};

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
function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "unknown"; }
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
function entityAliases(name: string) {
  const clean = name.replace(/\s+/g, " ").trim();
  const beforeDash = clean.split(/\s+-\s+/)[0]?.trim() || clean;
  const withoutParisSuffix = beforeDash.replace(/\s+(?:de|du)\s+Paris$/i, "").trim();
  const shortCrypte = beforeDash.replace(/\s+de\s+l['’]île\s+de\s+la\s+Cité$/i, "").trim();
  const withoutMuseumTail = beforeDash.replace(/\s+mus[eé]e\s+et\s+biblioth[eè]que$/i, "").trim();
  return [...new Set([clean, beforeDash, withoutParisSuffix, shortCrypte, withoutMuseumTail].filter((alias) => alias.length >= 6))].slice(0, 4);
}
function identityTokens(name: string) {
  return normalize(name).split(/[^a-z0-9]+/).filter((token) => token.length >= 4 && !["musee", "museum", "paris", "france", "ville"].includes(token));
}
function identityMatchAny(aliases: string[], text: string) {
  const normalized = normalize(text);
  return aliases.some((name) => {
    const full = normalize(name);
    if (full.length >= 7 && normalized.includes(full)) return true;
    const tokens = identityTokens(name);
    if (!tokens.length) return false;
    return tokens.length === 1 ? normalized.includes(tokens[0]) : tokens.filter((token) => normalized.includes(token)).length >= Math.min(2, tokens.length);
  });
}
function quote(term: string) {
  return `\"${term.replace(/\"/g, "")}\"`;
}
function frenchPriorityTerm(terms: string[]) {
  const preferred = ["insolite", "méconnu", "peu connu", "hors du commun", "entrée discrète", "paisible", "peu fréquenté", "nocturne", "ouverture nocturne", "ouvert le soir", "passage couvert", "jardin secret", "librairie indépendante", "musée insolite", "musée atypique"];
  return preferred.find((candidate) => terms.some((term) => normalize(term) === normalize(candidate))) ?? terms.find((term) => /[éèêàùçôîï]/i.test(term));
}
function buildQueries(name: string, claimTerms: string[], theme?: string) {
  const aliases = entityAliases(name);
  const primary = aliases[0] ?? name;
  const short = aliases[1] ?? primary;
  const strict = claimTerms.slice(0, 12);
  const french = frenchPriorityTerm(strict);
  const probes = (SEMANTIC_DISCOVERY_PROBES[theme ?? ""] ?? []).slice(0, 6);
  const queries = [
    strict[0] ? `${quote(primary)} Paris ${quote(strict[0])}` : "",
    french ? `${quote(short)} Paris ${quote(french)}` : (strict[1] ? `${quote(short)} Paris ${quote(strict[1])}` : ""),
    probes[0] ? `${quote(short)} Paris ${quote(probes[0])}` : "",
    strict[2] ? `${quote(short)} Paris ${quote(strict[2])}` : "",
    probes[1] ? `${quote(primary)} Paris ${quote(probes[1])}` : "",
    strict.length ? `${quote(short)} Paris ${strict.slice(0, 4).join(" ")} -site:wikipedia.org` : "",
    probes[2] ? `${quote(short)} Paris ${quote(probes[2])}` : "",
    strict.length ? `${quote(primary)} Paris review ${strict.slice(0, 3).join(" ")}` : "",
  ];
  return [...new Set(queries.filter(Boolean))];
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
  const observedTerms = coldStart ? (COLD_START_TERMS[params.theme ?? ""] ?? []).slice(0, 14) : explicitTerms;
  const equivalence = expandEquivalentClaimTerms(params.theme, observedTerms);
  const claimTerms = [...new Set([...observedTerms, ...equivalence.terms])].slice(0, 28);
  const existingFamilies = new Set(params.existingFamilies.map((family) => family.toLowerCase()));
  const existingUrls = new Set(params.existingUrls ?? []);
  const maxSearches = Math.max(1, Math.min(params.maxSearches ?? 4, 6));
  const queries = claimTerms.length ? buildQueries(params.name, claimTerms, params.theme).slice(0, maxSearches) : [];
  const aliases = entityAliases(params.name);
  const candidateUrls: string[] = [];
  const diagnostics = {
    rssItems: 0,
    identityMatched: 0,
    duplicateOrCarried: 0,
    existingFamilyRejected: 0,
    rssSamples: [] as Array<{ query: string; title: string; link: string; host: string; description: string }>,
  };
  let attemptedSearches = 0;

  for (const query of queries) {
    attemptedSearches += 1;
    try {
      const response = await fetchWithTimeout(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`);
      if (!response.ok) continue;
      const xml = await response.text();
      let sampledForQuery = 0;
      for (const item of xmlItems(xml).slice(0, 10)) {
        diagnostics.rssItems += 1;
        if (sampledForQuery < 3) {
          diagnostics.rssSamples.push({
            query,
            title: item.title.slice(0, 180),
            link: item.link,
            host: hostOf(item.link),
            description: item.description.slice(0, 240),
          });
          sampledForQuery += 1;
        }
        // Title/snippet are preferred, but URL tokens may establish page identity for navigation only.
        // URL identity never counts as traveler-intent evidence; the opened page must still prove the angle.
        if (!identityMatchAny(aliases, `${item.title} ${item.description} ${item.link}`)) continue;
        diagnostics.identityMatched += 1;
        if (existingUrls.has(item.link)) {
          diagnostics.duplicateOrCarried += 1;
          continue;
        }
        const family = sourceFamilyOf(item.link).toLowerCase();
        if (!family || existingFamilies.has(family)) {
          diagnostics.existingFamilyRejected += 1;
          continue;
        }
        candidateUrls.push(item.link);
      }
    } catch {
      // Search failure remains unknown and never becomes negative evidence.
    }
  }

  const uniqueUrls = [...new Set(candidateUrls)].slice(0, Math.max(1, Math.min(params.maxPages ?? 6, 8)));
  const deep = await fetchDeepEvidenceWindows(aliases[1] ?? aliases[0] ?? params.name, uniqueUrls, claimTerms, uniqueUrls.length || 1);
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

  console.info("[IntentHunterDiagnostic]", JSON.stringify({
    name: params.name,
    theme: params.theme ?? null,
    mode: coldStart ? "COLD_START" : "CORROBORATE",
    queries,
    attemptedSearches,
    rssItems: diagnostics.rssItems,
    rssSamples: diagnostics.rssSamples,
    identityMatched: diagnostics.identityMatched,
    duplicateOrCarried: diagnostics.duplicateOrCarried,
    existingFamilyRejected: diagnostics.existingFamilyRejected,
    candidateUrlCount: uniqueUrls.length,
    candidateHosts: uniqueUrls.map(hostOf),
    deepPagesOpened: deep.opened,
    deepWindows: deep.windows.length,
    hitCount: hits.length,
    hitFamilies: independentFamiliesAdded,
  }));

  return {
    queries,
    attemptedSearches,
    candidateUrls: uniqueUrls.length,
    deepPagesOpened: deep.opened,
    hits,
    independentFamiliesAdded,
    equivalenceFamiliesUsed: equivalence.families,
    mode: coldStart ? "COLD_START" : "CORROBORATE",
    rule: `Hunter V1.8 exposes a bounded raw sample of public RSS search results for retrieval diagnostics while preserving V1.7 evidence rules. Title, snippet or URL path may establish navigation identity only. The opened page must still contain identity-bound allowlisted claim language or an allowlisted equivalent before becoming a hit. Semantic probes remain navigation only and are never proof. Generic category membership, search recurrence, and free semantic similarity never count as corroboration. ${CLAIM_EQUIVALENCE_RULE}`,
  };
}
