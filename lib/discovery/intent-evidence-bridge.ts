import type { ResearchLead } from "./research-collectors";
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

const USER_AGENT = "VelvetPassportIntentBridge/2.6 (carried canonical handles + source-family aware focused intent + entity-specific independent evidence hunting; cached public search)";
const THEME_TERMS: Record<string, string[]> = {
  "beyond-the-classics": ["unusual", "less known", "off the beaten", "hidden gem", "independent", "atypical", "insolite", "under-the-radar"],
  "quiet-paris": ["quiet", "calm", "peaceful", "tranquil", "away from crowds", "paisible", "uncrowded"],
  "secret-gardens": ["garden", "jardin", "courtyard", "cour", "green space"],
  "forgotten-passages": ["passage", "covered passage", "galerie", "arcade"],
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
function carriedWikidataUrls(lead: ResearchLead) { return [...new Set(lead.rawClaims.map((claim) => claim.match(/^WIKIDATA_SOURCE_URL\s+(https?:\/\/\S+)$/i)?.[1]).filter((value): value is string => Boolean(value)))]; }
function xmlItems(xml: string) {
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  const read = (block: string, tag: string) => { const match = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i")); return stripHtml((match?.[1] ?? "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")); };
  return blocks.map((block) => ({ title: read(block, "title"), link: read(block, "link"), description: read(block, "description") })).filter((item) => item.title && item.link);
}
async function fetchWithTimeout(url: string, timeoutMs = 6500) { const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs); try { return await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "application/rss+xml,text/xml,*/*" }, signal: controller.signal, next: { revalidate: 21600 } }); } finally { clearTimeout(timer); } }
function placeLike(lead: ResearchLead) { return typeof lead.lat === "number" && typeof lead.lon === "number" || Boolean(lead.address); }
function buildQueries(lead: ResearchLead) { const terms = THEME_TERMS[lead.theme] ?? []; const families = [terms.slice(0, 3), terms.slice(3, 6), terms.slice(6, 9)].filter((group) => group.length); return families.map((group) => `\"${lead.name}\" Paris (${group.join(" OR ")})`).concat([`\"${lead.name}\" Paris review ${lead.query}`, `\"${lead.name}\" Paris official ${lead.query}`]).slice(0, 5); }
function identityTokens(name: string) { return normalize(name).split(/[^a-z0-9]+/).filter((token) => token.length >= 4 && !["musee", "museum", "paris"].includes(token)); }

export async function verifyIntentEvidence(leads: ResearchLead[], maxLookups = 8) {
  const eligible = leads.filter(placeLike).slice(0, Math.max(1, Math.min(maxLookups, 16))); const results: IntentEvidenceResult[] = []; let lookups = 0;
  for (const lead of leads) {
    if (!eligible.includes(lead)) { results.push({ lead, status: "UNCONFIRMED", score: 0, matchedTerms: [], evidenceUrls: [], independentSources: 0, queries: [], reasons: ["Focused intent verification was not allocated to this candidate or it lacks a resolved physical place identity."], deepPagesOpened: 0, directSourceUrls: 0, carriedSourceUrls: 0, hunterSearches: 0, hunterPagesOpened: 0, hunterHits: 0, hunterFamiliesAdded: [] }); continue; }
    const terms = THEME_TERMS[lead.theme] ?? []; const queries = buildQueries(lead); const tokens = identityTokens(lead.name); const searchEvidence: Array<{ text: string; url: string; host: string; sourceFamily: string }> = [];
    for (const query of queries) {
      lookups += 1;
      try {
        const response = await fetchWithTimeout(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`); if (!response.ok) continue; const xml = await response.text();
        for (const item of xmlItems(xml).slice(0, 8)) { const text = normalize(`${item.title} ${item.description}`); const identityMatch = tokens.length ? tokens.some((token) => text.includes(token)) : text.includes(normalize(lead.name)); if (!identityMatch) continue; searchEvidence.push({ text, url: item.link, host: hostOf(item.link), sourceFamily: sourceFamilyOf(item.link) }); }
      } catch { /* Search failure remains unknown. */ }
    }
    const entityId = wikidataEntityId(lead); const carriedUrls = carriedWikidataUrls(lead); const rediscoveredUrls = await discoverDirectSourceUrls(lead.name, 5, entityId); const directUrls = [...new Set([...carriedUrls, ...rediscoveredUrls])].slice(0, 6);
    const deep = await fetchDeepEvidenceWindows(lead.name, [...directUrls, ...searchEvidence.map((item) => item.url)], terms, 5);
    const deepEvidence = deep.windows.filter((item) => item.terms.length > 0).map((item) => ({ text: normalize(item.text), url: item.url, host: item.host, sourceFamily: item.sourceFamily }));
    const combined = [...searchEvidence, ...deepEvidence]; let themeEvidence = combined.filter((item) => terms.some((term) => item.text.includes(normalize(term))));
    let matchedTerms = [...new Set(terms.filter((term) => themeEvidence.some((item) => item.text.includes(normalize(term)))))]; let sourceFamilies = [...new Set(themeEvidence.map((item) => item.sourceFamily))]; let evidenceUrls = [...new Set(themeEvidence.map((item) => item.url))].slice(0, 8);
    let hunterSearches = 0; let hunterPagesOpened = 0; let hunterHits = 0; let hunterFamiliesAdded: string[] = [];
    if (matchedTerms.length > 0 && sourceFamilies.length === 1) {
      const hunter = await huntIndependentEvidence({ name: lead.name, claimTerms: matchedTerms, existingFamilies: sourceFamilies, existingUrls: evidenceUrls, maxSearches: 3, maxPages: 5 });
      hunterSearches = hunter.attemptedSearches; hunterPagesOpened = hunter.deepPagesOpened; hunterHits = hunter.hits.length; hunterFamiliesAdded = hunter.independentFamiliesAdded;
      const hunterEvidence = hunter.hits.map((hit) => ({ text: normalize(hit.text), url: hit.url, host: hostOf(hit.url), sourceFamily: hit.sourceFamily })); themeEvidence = [...themeEvidence, ...hunterEvidence]; matchedTerms = [...new Set(terms.filter((term) => themeEvidence.some((item) => item.text.includes(normalize(term)))))]; sourceFamilies = [...new Set(themeEvidence.map((item) => item.sourceFamily))]; evidenceUrls = [...new Set(themeEvidence.map((item) => item.url))].slice(0, 10);
    }
    const highExposureOnly = themeEvidence.length > 0 && themeEvidence.every((item) => GENERIC_HIGH_EXPOSURE.some((term) => item.text.includes(normalize(term)))); let score = Math.min(100, matchedTerms.length * 18 + Math.min(48, sourceFamilies.length * 24) + Math.min(18, deepEvidence.length * 9) + Math.min(12, hunterHits * 6)); if (highExposureOnly) score = Math.max(0, score - 25);
    const status: IntentEvidenceStatus = score >= 68 && sourceFamilies.length >= 2 ? "CONFIRMED" : score >= 32 ? "PARTIAL" : "UNCONFIRMED";
    const reasons = [status === "CONFIRMED" ? "Focused research plus entity-specific hunting found identity-matched theme evidence across at least two independent publisher families." : status === "PARTIAL" ? "Focused/direct-source research found some identity-matched theme evidence, but independent publisher-family confirmation remains incomplete." : "Focused search and direct-source deep research did not find enough identity-matched theme evidence to confirm the traveler-intent fit."];
    if (entityId) reasons.push(`Pitbull Wikidata identity ${entityId} was reused for canonical-source discovery.`); if (carriedUrls.length) reasons.push(`Pitbull carried ${carriedUrls.length} canonical/official source URL(s) directly from identity resolution, independent of a second Wikidata call.`); if (directUrls.length) reasons.push(`Direct source pool contains ${directUrls.length} candidate canonical/official URL(s) for deeper reading.`); if (deepEvidence.length) reasons.push(`Deep context verification found theme language near the place identity on ${deepEvidence.length} source page(s).`); if (hunterSearches) reasons.push(`Entity-specific hunter ran ${hunterSearches} targeted corroboration search(es) against the already-observed claim terms.`); if (hunterFamiliesAdded.length) reasons.push(`Independent evidence hunter added ${hunterFamiliesAdded.length} new publisher family/families: ${hunterFamiliesAdded.join(", ")}.`); else if (hunterSearches) reasons.push("Independent evidence hunter found no new publisher family that repeated the same claim inside an identity-matched context window."); if (highExposureOnly) reasons.push("Observed intent language appears only in generic high-exposure tourism framing, so confidence is reduced.");
    const bridgeClaim = matchedTerms.length ? `INTENT_EVIDENCE ${lead.theme}: ${matchedTerms.join(", ")} | independent_sources=${sourceFamilies.length} | deep_pages=${deepEvidence.length} | hunter_hits=${hunterHits} | direct_sources=${directUrls.length} | carried_sources=${carriedUrls.length} | status=${status}` : `INTENT_EVIDENCE ${lead.theme}: direct_sources=${directUrls.length} | carried_sources=${carriedUrls.length} | hunter_hits=${hunterHits} | status=${status}`;
    results.push({ lead: { ...lead, rawClaims: [...lead.rawClaims, bridgeClaim] }, status, score, matchedTerms, evidenceUrls, independentSources: sourceFamilies.length, queries, reasons, deepPagesOpened: deep.opened, directSourceUrls: directUrls.length, carriedSourceUrls: carriedUrls.length, hunterSearches, hunterPagesOpened, hunterHits, hunterFamiliesAdded });
  }
  return { results, leads: results.map((item) => item.lead), confirmed: results.filter((item) => item.status === "CONFIRMED"), partial: results.filter((item) => item.status === "PARTIAL"), unconfirmed: results.filter((item) => item.status === "UNCONFIRMED"), lookups, deepPagesOpened: results.reduce((sum, item) => sum + item.deepPagesOpened, 0), directSourceUrls: results.reduce((sum, item) => sum + item.directSourceUrls, 0), carriedSourceUrls: results.reduce((sum, item) => sum + item.carriedSourceUrls, 0), hunterSearches: results.reduce((sum, item) => sum + item.hunterSearches, 0), hunterPagesOpened: results.reduce((sum, item) => sum + item.hunterPagesOpened, 0), hunterHits: results.reduce((sum, item) => sum + item.hunterHits, 0), hunterFamiliesAdded: [...new Set(results.flatMap((item) => item.hunterFamiliesAdded))], rule: "Focused Intent Evidence V2.6 consumes canonical source handles carried from the initial Wikidata identity resolution before attempting rediscovery. Entity-Specific Independent Evidence Hunter activates only after a concrete entity has claim-specific evidence from one family and can promote only when the same claim appears in a new independent publisher family inside an identity-matched local context window. Source handles and search recurrence never verify claims by themselves." };
}
