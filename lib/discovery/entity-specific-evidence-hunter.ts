import { fetchDeepEvidenceWindows, sourceFamilyOf } from "./deep-source-evidence";
import { CLAIM_EQUIVALENCE_RULE, equivalentClaimMatch, expandEquivalentClaimTerms } from "./claim-equivalence";
import { searchPublicWeb } from "./public-search-provider";

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

const USER_AGENT = "VelvetPassportEvidenceHunter/2.4 (overfetch before carried-url filtering + fair trusted-publisher sitemap budgets + strict entity-bound proof)";

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

const TRUSTED_SITEMAP_ROOTS = [
  "https://www.visitparisregion.com/sitemap.xml",
  "https://parisjetaime.com/sitemap.xml",
  "https://www.sortiraparis.com/sitemap.xml",
  "https://www.paris.fr/sitemap.xml.gz",
  "https://cdn.paris.fr/paris/sitemaps/parisfr/sitemap.xml.gz",
];

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "unknown"; }
}
function sitemapPublisherFamily(url: string) {
  const host = hostOf(url);
  if (host === "paris.fr" || host.endsWith(".paris.fr")) return "paris.fr";
  return sourceFamilyOf(url).toLowerCase() || host;
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
function quote(term: string) { return `\"${term.replace(/\"/g, "")}\"`; }
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
  return [...new Set([
    strict[0] ? `${quote(primary)} Paris ${quote(strict[0])}` : "",
    french ? `${quote(short)} Paris ${quote(french)}` : (strict[1] ? `${quote(short)} Paris ${quote(strict[1])}` : ""),
    probes[0] ? `${quote(short)} Paris ${quote(probes[0])}` : "",
    strict[2] ? `${quote(short)} Paris ${quote(strict[2])}` : "",
    probes[1] ? `${quote(primary)} Paris ${quote(probes[1])}` : "",
    strict.length ? `${quote(short)} Paris ${strict.slice(0, 4).join(" ")} -site:wikipedia.org` : "",
  ].filter(Boolean))];
}

async function decodeResponseText(response: Response, requestedUrl: string) {
  const bytes = await response.arrayBuffer();
  const decoded = new TextDecoder().decode(bytes);
  if (/^\s*<\?xml|<urlset|<sitemapindex/i.test(decoded)) return decoded;

  const finalUrl = response.url || requestedUrl;
  const looksGzipped = /\.gz(?:$|[?#])/i.test(finalUrl) || /gzip/i.test(response.headers.get("content-type") ?? "");
  if (looksGzipped && typeof DecompressionStream !== "undefined") {
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
      return await new Response(stream).text();
    } catch {
      return decoded;
    }
  }
  return decoded;
}

async function fetchText(url: string, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "application/xml,text/xml,application/gzip,text/plain,*/*" },
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
    });
    if (!response.ok) return null;
    const text = await decodeResponseText(response, url);
    return text.includes("<loc>") ? text : null;
  } catch { return null; }
  finally { clearTimeout(timer); }
}

function sitemapLocs(xml: string) {
  return [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)]
    .map((match) => stripHtml(match[1].replace(/&amp;/g, "&")))
    .filter((url) => /^https?:\/\//i.test(url));
}

function slugIdentityScore(aliases: string[], url: string) {
  const normalizedUrl = normalize(decodeURIComponent(url)).replace(/[^a-z0-9]+/g, " ");
  let best = 0;
  for (const alias of aliases) {
    const tokens = identityTokens(alias);
    if (!tokens.length) continue;
    const matched = tokens.filter((token) => normalizedUrl.includes(token)).length;
    best = Math.max(best, matched / tokens.length);
  }
  return best;
}

function childSitemapPriority(url: string) {
  const value = normalize(url);
  let score = 0;
  if (/pages?/.test(value)) score += 100;
  if (/lieux?|places?/.test(value)) score += 90;
  if (/actualit|article|news/.test(value)) score += 80;
  if (/culture|patrimoine|museum|musee/.test(value)) score += 70;
  if (/agenda|evenement|event/.test(value)) score += 40;
  return score;
}

function diversifyCandidateFamilies(candidates: Array<{ url: string; score: number }>, maxUrls: number) {
  const deduped = [...new Map(candidates.sort((a, b) => b.score - a.score).map((item) => [item.url, item])).values()];
  const groups = new Map<string, Array<{ url: string; score: number }>>();
  for (const item of deduped) {
    const family = sourceFamilyOf(item.url).toLowerCase() || hostOf(item.url);
    const bucket = groups.get(family) ?? [];
    bucket.push(item);
    groups.set(family, bucket);
  }

  const selected: Array<{ url: string; score: number }> = [];
  const families = [...groups.keys()];
  let round = 0;
  while (selected.length < maxUrls) {
    let added = false;
    for (const family of families) {
      const item = groups.get(family)?.[round];
      if (!item) continue;
      selected.push(item);
      added = true;
      if (selected.length >= maxUrls) break;
    }
    if (!added) break;
    round += 1;
  }
  return selected;
}

async function discoverTrustedSitemapUrls(aliases: string[], maxUrls = 8) {
  const candidates: Array<{ url: string; score: number }> = [];
  let rootsOpened = 0;
  let childSitemapsOpened = 0;
  const rootDiagnostics: Array<{ root: string; opened: boolean; locs: number; matched: number }> = [];
  const openedPublishers = new Set<string>();

  for (const root of TRUSTED_SITEMAP_ROOTS) {
    const publisher = sitemapPublisherFamily(root);
    if (openedPublishers.has(publisher)) continue;

    const rootXml = await fetchText(root);
    if (!rootXml) {
      rootDiagnostics.push({ root, opened: false, locs: 0, matched: 0 });
      continue;
    }
    openedPublishers.add(publisher);
    rootsOpened += 1;
    const rootLocs = sitemapLocs(rootXml);
    const childBudget = publisher === "paris.fr" ? 10 : 6;
    const childSitemaps = rootLocs
      .filter((url) => /sitemap/i.test(url))
      .sort((a, b) => childSitemapPriority(b) - childSitemapPriority(a))
      .slice(0, childBudget);
    const pageLocs = rootLocs.filter((url) => !/sitemap/i.test(url));
    let matched = 0;

    for (const url of pageLocs) {
      const score = slugIdentityScore(aliases, url);
      if (score >= 0.5) {
        candidates.push({ url, score });
        matched += 1;
      }
    }

    const childResults = await Promise.all(childSitemaps.map(async (child) => ({ child, xml: await fetchText(child) })));
    for (const childResult of childResults) {
      if (!childResult.xml) continue;
      childSitemapsOpened += 1;
      for (const url of sitemapLocs(childResult.xml)) {
        const score = slugIdentityScore(aliases, url);
        if (score >= 0.5) {
          candidates.push({ url, score });
          matched += 1;
        }
      }
    }
    rootDiagnostics.push({ root, opened: true, locs: rootLocs.length, matched });
  }

  const limit = Math.max(1, Math.min(maxUrls, 12));
  const unique = diversifyCandidateFamilies(candidates, limit);
  return { urls: unique.map((item) => item.url), rootsOpened, childSitemapsOpened, rootDiagnostics };
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
    searchItems: 0,
    identityMatched: 0,
    duplicateOrCarried: 0,
    existingFamilyRejected: 0,
    providers: [] as string[],
    samples: [] as Array<{ query: string; provider: string; title: string; link: string; host: string; description: string }>,
  };
  let attemptedSearches = 0;

  const desiredPages = Math.max(1, Math.min(params.maxPages ?? 6, 8));
  const sitemapCandidateBudget = Math.max(8, Math.min(12, desiredPages * 2));
  const sitemapDiscovery = await discoverTrustedSitemapUrls(aliases, sitemapCandidateBudget);
  for (const url of sitemapDiscovery.urls) {
    if (existingUrls.has(url)) {
      diagnostics.duplicateOrCarried += 1;
      continue;
    }
    const family = sourceFamilyOf(url).toLowerCase();
    if (!family || existingFamilies.has(family)) {
      diagnostics.existingFamilyRejected += 1;
      continue;
    }
    candidateUrls.push(url);
  }

  const sitemapBudgetFilled = candidateUrls.length >= Math.max(2, Math.min(params.maxPages ?? 6, 4));
  if (!sitemapBudgetFilled) {
    for (const query of queries) {
      attemptedSearches += 1;
      try {
        const search = await searchPublicWeb(query, 10);
        diagnostics.providers.push(search.provider);
        let sampledForQuery = 0;
        for (const item of search.results) {
          diagnostics.searchItems += 1;
          if (sampledForQuery < 3) {
            diagnostics.samples.push({ query, provider: item.provider, title: stripHtml(item.title).slice(0, 180), link: item.link, host: hostOf(item.link), description: stripHtml(item.description).slice(0, 240) });
            sampledForQuery += 1;
          }
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
      } catch { /* Search failure remains unknown and never becomes negative evidence. */ }
    }
  }

  const uniqueUrls = [...new Set(candidateUrls)].slice(0, desiredPages);
  const deep = await fetchDeepEvidenceWindows(aliases[1] ?? aliases[0] ?? params.name, uniqueUrls, claimTerms, uniqueUrls.length || 1);
  const hits = deep.windows
    .filter((window) => window.terms.length > 0)
    .filter((window) => !existingFamilies.has(window.sourceFamily.toLowerCase()))
    .map((window) => ({ window, match: equivalentClaimMatch(params.theme, observedTerms, window.terms) }))
    .filter(({ match }) => match.matched)
    .map(({ window, match }) => ({ url: window.url, sourceFamily: window.sourceFamily, matchedTerms: window.terms, equivalentFamilies: match.sharedFamilies, text: window.text }));
  const independentFamiliesAdded = [...new Set(hits.map((hit) => hit.sourceFamily))];

  console.info("[IntentHunterDiagnostic]", JSON.stringify({
    name: params.name,
    theme: params.theme ?? null,
    mode: coldStart ? "COLD_START" : "CORROBORATE",
    queries,
    attemptedSearches,
    sitemapRootsOpened: sitemapDiscovery.rootsOpened,
    sitemapChildrenOpened: sitemapDiscovery.childSitemapsOpened,
    sitemapCandidateUrls: sitemapDiscovery.urls.length,
    sitemapRootDiagnostics: sitemapDiscovery.rootDiagnostics,
    providers: diagnostics.providers,
    searchItems: diagnostics.searchItems,
    samples: diagnostics.samples,
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
    rule: `Hunter V2.4 overfetches a bounded diversified sitemap candidate set before carried URLs and already-known source families are removed, so a known venue page cannot crowd out a second editorial page from the same trusted publisher. Trusted Paris publisher sitemaps retain bounded per-publisher child budgets, gzipped index support and direct CDN fallback. Sitemap URLs establish navigation identity only; the opened page must still contain identity-bound allowlisted claim language or an allowlisted equivalent before becoming a hit. Generic search remains a fallback only. Semantic probes, URL wording, recurrence and category membership never count as proof. ${CLAIM_EQUIVALENCE_RULE}`,
  };
}