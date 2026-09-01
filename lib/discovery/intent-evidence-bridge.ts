import type { ResearchLead } from "./research-collectors";
import { discoverDirectSourceUrls, fetchDeepEvidenceWindows, sourceFamilyOf } from "./deep-source-evidence";

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
};

const USER_AGENT = "VelvetPassportIntentBridge/2.4 (source-family aware focused intent + deep context verification; cached public search)";

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
function xmlItems(xml: string) {
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  const read = (block: string, tag: string) => {
    const match = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i"));
    return stripHtml((match?.[1] ?? "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
  };
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
  return families.map((group) => `\"${lead.name}\" Paris (${group.join(" OR ")})`).concat([`\"${lead.name}\" Paris review ${lead.query}`, `\"${lead.name}\" Paris official ${lead.query}`]).slice(0, 5);
}
function identityTokens(name: string) {
  return normalize(name).split(/[^a-z0-9]+/).filter((token) => token.length >= 4 && !["musee", "museum", "paris"].includes(token));
}

export async function verifyIntentEvidence(leads: ResearchLead[], maxLookups = 8) {
  const eligible = leads.filter(placeLike).slice(0, Math.max(1, Math.min(maxLookups, 16)));
  const results: IntentEvidenceResult[] = [];
  let lookups = 0;

  for (const lead of leads) {
    if (!eligible.includes(lead)) {
      results.push({ lead, status: "UNCONFIRMED", score: 0, matchedTerms: [], evidenceUrls: [], independentSources: 0, queries: [], reasons: ["Focused intent verification was not allocated to this candidate or it lacks a resolved physical place identity."], deepPagesOpened: 0, directSourceUrls: 0 });
      continue;
    }

    const terms = THEME_TERMS[lead.theme] ?? [];
    const queries = buildQueries(lead);
    const tokens = identityTokens(lead.name);
    const searchEvidence: Array<{ text: string; url: string; host: string; sourceFamily: string }> = [];

    for (const query of queries) {
      lookups += 1;
      try {
        const response = await fetchWithTimeout(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`);
        if (!response.ok) continue;
        const xml = await response.text();
        for (const item of xmlItems(xml).slice(0, 8)) {
          const text = normalize(`${item.title} ${item.description}`);
          const identityMatch = tokens.length ? tokens.some((token) => text.includes(token)) : text.includes(normalize(lead.name));
          if (!identityMatch) continue;
          searchEvidence.push({ text, url: item.link, host: hostOf(item.link), sourceFamily: sourceFamilyOf(item.link) });
        }
      } catch { /* Search failure remains unknown. */ }
    }

    const entityId = wikidataEntityId(lead);
    const directUrls = await discoverDirectSourceUrls(lead.name, 5, entityId);
    const deep = await fetchDeepEvidenceWindows(lead.name, [...directUrls, ...searchEvidence.map((item) => item.url)], terms, 5);
    const deepEvidence = deep.windows.filter((item) => item.terms.length > 0).map((item) => ({ text: normalize(item.text), url: item.url, host: item.host, sourceFamily: item.sourceFamily }));
    const combined = [...searchEvidence, ...deepEvidence];
    const themeEvidence = combined.filter((item) => terms.some((term) => item.text.includes(normalize(term))));
    const matchedTerms = [...new Set(terms.filter((term) => themeEvidence.some((item) => item.text.includes(normalize(term)))))];
    const sourceFamilies = [...new Set(themeEvidence.map((item) => item.sourceFamily))];
    const evidenceUrls = [...new Set(themeEvidence.map((item) => item.url))].slice(0, 8);
    const highExposureOnly = themeEvidence.length > 0 && themeEvidence.every((item) => GENERIC_HIGH_EXPOSURE.some((term) => item.text.includes(normalize(term))));
    let score = Math.min(100, matchedTerms.length * 18 + Math.min(48, sourceFamilies.length * 24) + Math.min(18, deepEvidence.length * 9));
    if (highExposureOnly) score = Math.max(0, score - 25);
    const status: IntentEvidenceStatus = score >= 68 && sourceFamilies.length >= 2 ? "CONFIRMED" : score >= 32 ? "PARTIAL" : "UNCONFIRMED";
    const reasons = [status === "CONFIRMED" ? "Focused search plus direct-source context found identity-matched theme evidence across at least two independent publisher families." : status === "PARTIAL" ? "Focused/direct-source research found some identity-matched theme evidence, but independent publisher-family confirmation remains incomplete." : "Focused search and direct-source deep research did not find enough identity-matched theme evidence to confirm the traveler-intent fit."];
    if (entityId) reasons.push(`Pitbull Wikidata identity ${entityId} was reused for canonical-source discovery.`);
    if (directUrls.length) reasons.push(`Direct source discovery found ${directUrls.length} candidate canonical/official URL(s) for deeper reading.`);
    if (deepEvidence.length) reasons.push(`Deep context verification found theme language near the place identity on ${deepEvidence.length} source page(s).`);
    if (highExposureOnly) reasons.push("Observed intent language appears only in generic high-exposure tourism framing, so confidence is reduced.");

    const bridgeClaim = matchedTerms.length ? `INTENT_EVIDENCE ${lead.theme}: ${matchedTerms.join(", ")} | independent_sources=${sourceFamilies.length} | deep_pages=${deepEvidence.length} | direct_sources=${directUrls.length} | status=${status}` : `INTENT_EVIDENCE ${lead.theme}: direct_sources=${directUrls.length} | status=${status}`;
    results.push({ lead: { ...lead, rawClaims: [...lead.rawClaims, bridgeClaim] }, status, score, matchedTerms, evidenceUrls, independentSources: sourceFamilies.length, queries, reasons, deepPagesOpened: deep.opened, directSourceUrls: directUrls.length });
  }

  return {
    results,
    leads: results.map((item) => item.lead),
    confirmed: results.filter((item) => item.status === "CONFIRMED"),
    partial: results.filter((item) => item.status === "PARTIAL"),
    unconfirmed: results.filter((item) => item.status === "UNCONFIRMED"),
    lookups,
    deepPagesOpened: results.reduce((sum, item) => sum + item.deepPagesOpened, 0),
    directSourceUrls: results.reduce((sum, item) => sum + item.directSourceUrls, 0),
    rule: "Focused Intent Evidence V2.4 counts independent publisher families rather than host/language variants. Wikidata P856 official pages may supplement canonical pages, but source discovery alone never proves intent and no signal bypasses claim verification.",
  };
}
