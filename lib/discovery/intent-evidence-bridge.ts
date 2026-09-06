import type { ResearchLead } from "./research-collectors";
import type { ResearchEvidence } from "./research-verification";
import { discoverDirectSourceUrls, fetchDeepEvidenceWindows, sourceFamilyOf } from "./deep-source-evidence";
import { huntIndependentEvidence } from "./entity-specific-evidence-hunter";

export type IntentEvidenceStatus = "CONFIRMED" | "PARTIAL" | "UNCONFIRMED";

export type IntentEvidenceResult = {
  lead: ResearchLead;
  status: IntentEvidenceStatus;
  score: number;
  matchedTerms: string[];
  evidenceUrls: string[];
  independentSources: number;
  queries: string[];
  reasons: string[];
  deepPagesOpened: number;
  directSourceUrls: number;
  carriedSourceUrls: number;
  hunterSearches: number;
  hunterPagesOpened: number;
  hunterHits: number;
  hunterFamiliesAdded: string[];
};

const USER_AGENT = "VelvetPassportIntentBridge/3.0 (strong entity-bound intent phrases + official venue identity + independent corroboration)";
const THEME_TERMS: Record<string, string[]> = {
  "beyond-the-classics": ["unusual", "less known", "off the beaten", "hidden gem", "independent", "atypical", "insolite", "under-the-radar"],
  "quiet-paris": ["quiet", "calm", "peaceful", "tranquil", "away from crowds", "paisible", "uncrowded"],
  "secret-gardens": ["garden", "jardin", "courtyard", "cour", "green space"],
  "forgotten-passages": ["covered passage", "passage couvert", "galerie couverte", "covered arcade", "historic covered passage", "hidden passage", "secret passage", "forgotten passage", "passage méconnu"],
  "hidden-bookshops": ["bookshop", "bookstore", "librairie", "literary", "books", "independent bookstore"],
  "unusual-museums": ["museum", "musée", "collection", "cabinet", "unusual", "insolite", "small museum", "house museum"],
  "paris-after-dark": ["night", "evening", "late opening", "open late", "nocturne", "after dark", "soir", "soirée"],
  "rainy-day-paris": ["indoor", "covered", "inside", "museum", "gallery", "bookshop", "arcade"],
};
const GENERIC_HIGH_EXPOSURE = ["must-see", "must see", "top attraction", "iconic", "most visited", "world famous"];

function normalize(value: string) { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function stripHtml(value: string) { return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }
function hostOf(url: string) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "unknown"; } }
function wikidataEntityId(lead: ResearchLead) { return lead.rawClaims.map((claim) => claim.match(/^WIKIDATA_ENTITY\s+(Q\d+)$/i)?.[1]).find(Boolean); }
function carriedCanonicalUrls(lead: ResearchLead) {
  const claimUrls = lead.rawClaims.map((claim) => claim.match(/^(?:WIKIDATA_SOURCE_URL|PARIS_DATA_SOURCE_URL)\s+(https?:\/\/\S+)$/i)?.[1]).filter((value): value is string => Boolean(value));
  const directLeadUrl = lead.sourceType === "OFFICIAL" && /^https?:\/\//i.test(lead.url) ? [lead.url] : [];
  return [...new Set([...claimUrls, ...directLeadUrl])];
}
function primaryVenueAlias(name: string) {
  let alias = name.trim().replace(/\s{2,}/g, " ");
  alias = alias.split(/\s+-\s+/)[0]?.trim() || alias;
  alias = alias.split(/,\s+(?:Hôtel|Hotel)\b/i)[0]?.trim() || alias;
  alias = alias.replace(/\s+mus[eé]e\s+et\s+biblioth[eè]que\s*$/i, "").trim();
  alias = alias.replace(/^Les\s+Catacombes\s+de\s+Paris$/i, "Catacombes de Paris");
  return alias.length >= 4 ? alias : name.trim();
}
function venueAliases(name: string) {
  const primary = primaryVenueAlias(name);
  return [...new Set([primary, name.trim()].filter(Boolean))].slice(0, 2);
}
function xmlItems(xml: string) {
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  const read = (block: string, tag: string) => { const match = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i")); return stripHtml((match?.[1] ?? "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")); };
  return blocks.map((block) => ({ title: read(block, "title"), link: read(block, "link"), description: read(block, "description") })).filter((item) => item.title && item.link);
}
async function fetchWithTimeout(url: string, timeoutMs = 6500) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "application/rss+xml,text/xml,*/*" }, signal: controller.signal, next: { revalidate: 21600 } }); }
  finally { clearTimeout(timer); }
}
function placeLike(lead: ResearchLead) { return typeof lead.lat === "number" && typeof lead.lon === "number" || Boolean(lead.address); }
function buildQueries(lead: ResearchLead) {
  const terms = THEME_TERMS[lead.theme] ?? [];
  const families = [terms.slice(0, 3), terms.slice(3, 6), terms.slice(6, 9)].filter((group) => group.length);
  const name = primaryVenueAlias(lead.name);
  return families.map((group) => `\"${name}\" Paris (${group.join(" OR ")})`)
    .concat([`\"${name}\" Paris review ${lead.query}`, `\"${name}\" Paris official ${terms.slice(0, 4).join(" ")}`])
    .slice(0, 5);
}
function identityTokens(name: string) { return normalize(name).split(/[^a-z0-9]+/).filter((token) => token.length >= 4 && !["musee", "museum", "paris", "ville"].includes(token)); }
function identityMatchAliases(aliases: string[], text: string) {
  const normalizedText = normalize(text);
  return aliases.some((alias) => {
    const full = normalize(alias);
    if (full.length >= 7 && normalizedText.includes(full)) return true;
    const tokens = identityTokens(alias);
    if (!tokens.length) return false;
    return tokens.length === 1 ? normalizedText.includes(tokens[0]) : tokens.filter((token) => normalizedText.includes(token)).length >= Math.min(2, tokens.length);
  });
}
function localSegments(text: string) {
  return stripHtml(text).split(/(?<=[.!?;:])\s+|\s+[–—]\s+/).map((part) => part.trim()).filter((part) => part.length >= 10 && part.length <= 700);
}
function entityBoundSnippetTerms(aliases: string[], text: string, terms: string[]) {
  const segments = localSegments(text).filter((segment) => identityMatchAliases(aliases, segment));
  return [...new Set(terms.filter((term) => segments.some((segment) => normalize(segment).includes(normalize(term)))))];
}
function sourceTypeForUrl(url: string): ResearchEvidence["sourceType"] {
  const host = hostOf(url);
  if (/\.gouv\.fr$|(^|\.)paris\.fr$|(^|\.)musee-orangerie\.fr$|(^|\.)musee-orsay\.fr$/.test(host)) return "OFFICIAL";
  if (/wikipedia\.org$|wikimedia\.org$/.test(host)) return "WIKIDATA";
  return "EDITORIAL";
}
function traceEvidence(lead: ResearchLead, items: Array<{ url: string; sourceFamily: string; text: string; matchedTerms?: string[] }>): ResearchEvidence[] {
  const observedAt = new Date().toISOString();
  return [...new Map(items.map((item, index) => {
    const host = hostOf(item.url);
    const claims = [stripHtml(item.text).slice(0, 900), ...(item.matchedTerms ?? [])].filter(Boolean);
    const evidence: ResearchEvidence = {
      sourceId: `intent-trace:${Buffer.from(`${lead.id}|${item.url}|${index}`).toString("base64url").slice(0, 28)}`,
      sourceType: sourceTypeForUrl(item.url), publisher: host, url: item.url, title: `${lead.name} intent evidence`, observedAt, claims,
      independentKey: item.sourceFamily || sourceFamilyOf(item.url),
    };
    return [`${evidence.independentKey}|${evidence.url}`, evidence] as const;
  })).values()];
}

export async function verifyIntentEvidence(leads: ResearchLead[], maxLookups = 8) {
  const eligible = leads.filter(placeLike).slice(0, Math.max(1, Math.min(maxLookups, 16)));
  const results: IntentEvidenceResult[] = [];
  let lookups = 0;

  for (const lead of leads) {
    if (!eligible.includes(lead)) {
      results.push({ lead, status: "UNCONFIRMED", score: 0, matchedTerms: [], evidenceUrls: [], independentSources: 0, queries: [], reasons: ["Focused intent verification was not allocated to this candidate or it lacks a resolved physical place identity."], deepPagesOpened: 0, directSourceUrls: 0, carriedSourceUrls: 0, hunterSearches: 0, hunterPagesOpened: 0, hunterHits: 0, hunterFamiliesAdded: [] });
      continue;
    }

    const terms = THEME_TERMS[lead.theme] ?? [];
    const aliases = venueAliases(lead.name);
    const searchName = aliases[0] ?? lead.name;
    const queries = buildQueries(lead);
    const searchEvidence: Array<{ text: string; url: string; host: string; sourceFamily: string; matchedTerms: string[] }> = [];

    for (const query of queries) {
      lookups += 1;
      try {
        const response = await fetchWithTimeout(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`);
        if (!response.ok) continue;
        const xml = await response.text();
        for (const item of xmlItems(xml).slice(0, 8)) {
          const rawText = `${item.title}. ${item.description}`;
          if (!identityMatchAliases(aliases, rawText)) continue;
          const boundTerms = entityBoundSnippetTerms(aliases, rawText, terms);
          if (!boundTerms.length) continue;
          searchEvidence.push({ text: normalize(rawText), url: item.link, host: hostOf(item.link), sourceFamily: sourceFamilyOf(item.link), matchedTerms: boundTerms });
        }
      } catch { /* Search failure remains unknown. */ }
    }

    const entityId = wikidataEntityId(lead);
    const carriedUrls = carriedCanonicalUrls(lead);
    const rediscoveredUrls = await discoverDirectSourceUrls(searchName, 5, entityId);
    const directUrls = [...new Set([...carriedUrls, ...rediscoveredUrls])].slice(0, 7);
    const deep = await fetchDeepEvidenceWindows(searchName, [...directUrls, ...searchEvidence.map((item) => item.url)], terms, 5);
    const deepEvidence = deep.windows.filter((item) => item.terms.length > 0).map((item) => ({ text: normalize(item.text), url: item.url, host: item.host, sourceFamily: item.sourceFamily, matchedTerms: item.terms }));
    const combined = [...searchEvidence, ...deepEvidence];
    let themeEvidence = combined.filter((item) => item.matchedTerms.length > 0);
    let matchedTerms = [...new Set(themeEvidence.flatMap((item) => item.matchedTerms))];
    let sourceFamilies = [...new Set(themeEvidence.map((item) => item.sourceFamily))];
    let evidenceUrls = [...new Set(themeEvidence.map((item) => item.url))].slice(0, 8);
    let hunterSearches = 0;
    let hunterPagesOpened = 0;
    let hunterHits = 0;
    let hunterFamiliesAdded: string[] = [];
    let hunterEvidence: Array<{ text: string; url: string; host: string; sourceFamily: string; matchedTerms: string[] }> = [];
    let hunterMode: "CORROBORATE" | "COLD_START" | "NONE" = "NONE";

    if (matchedTerms.length === 0 && terms.length > 0) {
      const hunter = await huntIndependentEvidence({ name: searchName, theme: lead.theme, claimTerms: [], existingFamilies: [], existingUrls: directUrls, maxSearches: 3, maxPages: 5, allowColdStart: true });
      hunterMode = hunter.mode; hunterSearches += hunter.attemptedSearches; hunterPagesOpened += hunter.deepPagesOpened; hunterHits += hunter.hits.length;
      hunterFamiliesAdded = [...new Set([...hunterFamiliesAdded, ...hunter.independentFamiliesAdded])];
      hunterEvidence.push(...hunter.hits.map((hit) => ({ text: normalize(hit.text), url: hit.url, host: hostOf(hit.url), sourceFamily: hit.sourceFamily, matchedTerms: hit.matchedTerms })));
      themeEvidence = [...themeEvidence, ...hunterEvidence];
      matchedTerms = [...new Set(hunterEvidence.flatMap((item) => item.matchedTerms))];
      sourceFamilies = [...new Set(themeEvidence.map((item) => item.sourceFamily))];
      evidenceUrls = [...new Set(themeEvidence.map((item) => item.url))].slice(0, 10);
    }

    if (matchedTerms.length > 0 && sourceFamilies.length === 1) {
      const hunter = await huntIndependentEvidence({ name: searchName, theme: lead.theme, claimTerms: matchedTerms, existingFamilies: sourceFamilies, existingUrls: [...new Set([...evidenceUrls, ...directUrls])], maxSearches: 3, maxPages: 5 });
      if (hunterMode === "NONE") hunterMode = hunter.mode;
      hunterSearches += hunter.attemptedSearches; hunterPagesOpened += hunter.deepPagesOpened; hunterHits += hunter.hits.length;
      hunterFamiliesAdded = [...new Set([...hunterFamiliesAdded, ...hunter.independentFamiliesAdded])];
      const newEvidence = hunter.hits.map((hit) => ({ text: normalize(hit.text), url: hit.url, host: hostOf(hit.url), sourceFamily: hit.sourceFamily, matchedTerms: hit.matchedTerms }));
      hunterEvidence = [...hunterEvidence, ...newEvidence]; themeEvidence = [...themeEvidence, ...newEvidence];
      matchedTerms = [...new Set([...matchedTerms, ...newEvidence.flatMap((item) => item.matchedTerms)])];
      sourceFamilies = [...new Set(themeEvidence.map((item) => item.sourceFamily))]; evidenceUrls = [...new Set(themeEvidence.map((item) => item.url))].slice(0, 10);
    }

    const highExposureOnly = themeEvidence.length > 0 && themeEvidence.every((item) => GENERIC_HIGH_EXPOSURE.some((term) => item.text.includes(normalize(term))));
    let score = Math.min(100, matchedTerms.length * 18 + Math.min(48, sourceFamilies.length * 24) + Math.min(18, deepEvidence.length * 9) + Math.min(12, hunterHits * 6));
    if (highExposureOnly) score = Math.max(0, score - 25);
    const status: IntentEvidenceStatus = score >= 68 && sourceFamilies.length >= 2 ? "CONFIRMED" : score >= 32 ? "PARTIAL" : "UNCONFIRMED";
    const reasons = [status === "CONFIRMED" ? "Focused research plus entity-specific hunting found identity-bound theme evidence across at least two independent publisher families." : status === "PARTIAL" ? "Focused/direct-source research found some identity-bound theme evidence, but independent publisher-family confirmation remains incomplete." : "Focused search and direct-source deep research did not find enough identity-bound theme evidence to confirm the traveler-intent fit."];
    if (aliases[0] && aliases[0] !== lead.name) reasons.push(`Focused research used canonical venue alias “${aliases[0]}” while preserving the full source identity “${lead.name}”.`);
    if (entityId) reasons.push(`Pitbull Wikidata identity ${entityId} was reused for canonical-source discovery.`);
    if (carriedUrls.length) reasons.push(`Collector carried ${carriedUrls.length} official/canonical source URL(s) directly into intent research.`);
    if (directUrls.length) reasons.push(`Direct source pool contains ${directUrls.length} candidate canonical/official URL(s) for deeper reading.`);
    if (deepEvidence.length) reasons.push(`Deep context verification found entity-bound theme language on ${deepEvidence.length} source page(s).`);
    if (hunterMode === "COLD_START") reasons.push(`Cold-start hunter searched only the high-precision allowlist for theme ${lead.theme}; generic category membership was not accepted as intent evidence.`);
    if (hunterSearches) reasons.push(`Entity-specific hunter ran ${hunterSearches} targeted search(es) for the same entity.`);
    if (hunterFamiliesAdded.length) reasons.push(`Independent evidence hunter added ${hunterFamiliesAdded.length} new publisher family/families: ${hunterFamiliesAdded.join(", ")}.`);
    else if (hunterSearches) reasons.push("Independent evidence hunter found no qualifying new publisher family inside an identity-matched context window.");
    if (highExposureOnly) reasons.push("Observed intent language appears only in generic high-exposure tourism framing, so confidence is reduced.");

    const bridgeClaim = matchedTerms.length ? `INTENT_EVIDENCE ${lead.theme}: ${matchedTerms.join(", ")} | independent_sources=${sourceFamilies.length} | deep_pages=${deepEvidence.length} | hunter_hits=${hunterHits} | hunter_mode=${hunterMode} | direct_sources=${directUrls.length} | carried_sources=${carriedUrls.length} | status=${status}` : `INTENT_EVIDENCE ${lead.theme}: direct_sources=${directUrls.length} | carried_sources=${carriedUrls.length} | hunter_hits=${hunterHits} | hunter_mode=${hunterMode} | status=${status}`;
    const evidenceTrace = traceEvidence(lead, [...searchEvidence, ...deepEvidence, ...hunterEvidence].map((item) => ({ url: item.url, sourceFamily: item.sourceFamily, text: item.text, matchedTerms: item.matchedTerms })));
    results.push({ lead: { ...lead, rawClaims: [...lead.rawClaims, bridgeClaim], evidenceTrace: [...(lead.evidenceTrace ?? []), ...evidenceTrace] }, status, score, matchedTerms, evidenceUrls, independentSources: sourceFamilies.length, queries, reasons, deepPagesOpened: deep.opened, directSourceUrls: directUrls.length, carriedSourceUrls: carriedUrls.length, hunterSearches, hunterPagesOpened, hunterHits, hunterFamiliesAdded });
  }

  return {
    results,
    leads: results.map((item) => item.lead), confirmed: results.filter((item) => item.status === "CONFIRMED"), partial: results.filter((item) => item.status === "PARTIAL"), unconfirmed: results.filter((item) => item.status === "UNCONFIRMED"), lookups,
    deepPagesOpened: results.reduce((sum, item) => sum + item.deepPagesOpened, 0), directSourceUrls: results.reduce((sum, item) => sum + item.directSourceUrls, 0), carriedSourceUrls: results.reduce((sum, item) => sum + item.carriedSourceUrls, 0), hunterSearches: results.reduce((sum, item) => sum + item.hunterSearches, 0), hunterPagesOpened: results.reduce((sum, item) => sum + item.hunterPagesOpened, 0), hunterHits: results.reduce((sum, item) => sum + item.hunterHits, 0), hunterFamiliesAdded: [...new Set(results.flatMap((item) => item.hunterFamiliesAdded))],
    rule: "Focused Intent Evidence V3.0 requires theme language to be bound to the venue identity in the same local sentence/clause for both search snippets and deep pages. Forgotten-passages accepts only strong phrases such as covered/hidden/secret/forgotten passages or covered galleries/arcades; bare passage, galerie or arcade are not evidence. CONFIRMED still requires score >=68 and at least two independent publisher families; no threshold is relaxed.",
  };
}
