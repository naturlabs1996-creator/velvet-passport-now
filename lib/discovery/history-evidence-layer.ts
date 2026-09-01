import type { ResearchLead } from "./research-collectors";
import { discoverDirectSourceUrls, fetchDeepEvidenceWindows, sourceFamilyOf } from "./deep-source-evidence";

export type HistoryEvidenceStatus = "CONFIRMED" | "PARTIAL" | "UNCONFIRMED";

export type HistoryEvidenceResult = {
  lead: ResearchLead;
  status: HistoryEvidenceStatus;
  score: number;
  evidenceUrls: string[];
  independentSources: number;
  matchedHistoryTerms: string[];
  reasons: string[];
  deepPagesOpened: number;
  directSourceUrls: number;
};

const USER_AGENT = "VelvetPassportHistoryLayer/1.5 (source-family aware wikidata-linked history verification; cached public search)";
const HISTORY_TERMS = [
  "history", "historic", "historical", "founded", "built", "constructed", "opened", "former", "formerly",
  "architect", "architecture", "atelier", "workshop", "printing", "imprimerie", "hotel particulier", "hôtel particulier",
  "residence", "lived", "born", "died", "writer", "artist", "composer", "owner", "occupied", "restored", "renovated",
  "origin", "origins", "century", "siècle", "heritage", "patrimoine", "monument historique", "listed monument",
  "legend", "tradition", "event", "revolution", "war", "medieval", "renaissance", "haussmann"
];
const GENERIC_ENTITY_TOKENS = new Set(["paris", "musee", "museum", "hotel", "the", "of", "de", "du", "des", "la", "le", "les", "place", "france"]);
const OUT_OF_PARIS_TERMS = ["las vegas", "seattle", "london", "new york", "tokyo", "orlando", "texas"];
const TRUSTED_HISTORY_HOST_HINTS = ["paris.fr", "parisjetaime.com", "culture.gouv.fr", "monuments-nationaux.fr", "musee", "museum", "history.com", "britannica.com", "wikipedia.org", "paris-musees.fr"];

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
  try { return await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "application/rss+xml,text/xml,*/*" }, signal: controller.signal, next: { revalidate: 86400 } }); }
  finally { clearTimeout(timer); }
}
function placeLike(lead: ResearchLead) { return Boolean(lead.address) || (typeof lead.lat === "number" && typeof lead.lon === "number"); }
function entityTokens(name: string) { return normalize(name).split(/[^a-z0-9]+/).filter((token) => token.length >= 3 && !GENERIC_ENTITY_TOKENS.has(token)); }
function identityMatches(lead: ResearchLead, text: string) {
  const normalizedName = normalize(lead.name); const normalizedText = normalize(text);
  if (normalizedName.length >= 7 && normalizedText.includes(normalizedName)) return true;
  const tokens = entityTokens(lead.name); if (!tokens.length) return false;
  const matched = tokens.filter((token) => normalizedText.includes(token)).length;
  return tokens.length === 1 ? matched === 1 : matched >= Math.min(2, tokens.length);
}
function geographicallyCompatible(lead: ResearchLead, text: string) {
  const normalizedText = normalize(text);
  if (!OUT_OF_PARIS_TERMS.some((term) => normalizedText.includes(term))) return true;
  const address = normalize(lead.address ?? "");
  return OUT_OF_PARIS_TERMS.some((term) => address.includes(term) && normalizedText.includes(term));
}
function sourceQuality(host: string) { const normalized = host.toLowerCase(); return TRUSTED_HISTORY_HOST_HINTS.some((hint) => normalized.includes(hint)) ? 1 : 0; }

export async function enrichHistoryEvidence(leads: ResearchLead[], maxLookups = 6) {
  const eligible = leads.filter(placeLike).slice(0, Math.max(1, Math.min(maxLookups, 12)));
  const results: HistoryEvidenceResult[] = [];
  let lookups = 0;

  for (const lead of leads) {
    if (!eligible.includes(lead)) {
      results.push({ lead, status: "UNCONFIRMED", score: 0, evidenceUrls: [], independentSources: 0, matchedHistoryTerms: [], reasons: ["History research was not allocated to this candidate or the place identity is not resolved."], deepPagesOpened: 0, directSourceUrls: 0 });
      continue;
    }

    const queries = [`\"${lead.name}\" Paris history heritage`, `\"${lead.name}\" Paris histoire patrimoine architecte`];
    const searchEvidence: Array<{ text: string; url: string; host: string; sourceFamily: string; trusted: number }> = [];

    for (const query of queries) {
      lookups += 1;
      try {
        const response = await fetchWithTimeout(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`);
        if (!response.ok) continue;
        const xml = await response.text();
        for (const item of xmlItems(xml).slice(0, 8)) {
          const rawText = `${item.title} ${item.description}`;
          if (!identityMatches(lead, rawText)) continue;
          if (!geographicallyCompatible(lead, rawText)) continue;
          const host = hostOf(item.link);
          searchEvidence.push({ text: normalize(rawText), url: item.link, host, sourceFamily: sourceFamilyOf(item.link), trusted: sourceQuality(host) });
        }
      } catch { /* Failure remains unknown. */ }
    }

    const entityId = wikidataEntityId(lead);
    const directUrls = await discoverDirectSourceUrls(lead.name, 5, entityId);
    const deep = await fetchDeepEvidenceWindows(lead.name, [...directUrls, ...searchEvidence.map((item) => item.url)], HISTORY_TERMS, 5);
    const deepEvidence = deep.windows.filter((item) => item.terms.length > 0 && geographicallyCompatible(lead, item.text)).map((item) => ({ text: normalize(item.text), url: item.url, host: item.host, sourceFamily: item.sourceFamily, trusted: sourceQuality(item.host) }));
    const evidence = [...searchEvidence, ...deepEvidence];
    const relevant = evidence.filter((item) => HISTORY_TERMS.some((term) => item.text.includes(normalize(term))));
    const matchedHistoryTerms = [...new Set(HISTORY_TERMS.filter((term) => relevant.some((item) => item.text.includes(normalize(term)))))];
    const sourceFamilies = [...new Set(relevant.map((item) => item.sourceFamily))];
    const trustedFamilies = [...new Set(relevant.filter((item) => item.trusted > 0).map((item) => item.sourceFamily))];
    const evidenceUrls = [...new Set(relevant.map((item) => item.url))].slice(0, 8);
    const score = Math.min(100, matchedHistoryTerms.length * 7 + Math.min(42, sourceFamilies.length * 18) + Math.min(18, trustedFamilies.length * 9) + Math.min(18, deepEvidence.length * 9));
    const status: HistoryEvidenceStatus = score >= 64 && sourceFamilies.length >= 2 && trustedFamilies.length >= 1 ? "CONFIRMED" : score >= 28 ? "PARTIAL" : "UNCONFIRMED";
    const historyClaim = matchedHistoryTerms.length ? `HISTORY_EVIDENCE: terms=${matchedHistoryTerms.slice(0, 10).join(", ")} | independent_sources=${sourceFamilies.length} | trusted_sources=${trustedFamilies.length} | deep_pages=${deepEvidence.length} | direct_sources=${directUrls.length} | status=${status}` : `HISTORY_EVIDENCE: direct_sources=${directUrls.length} | status=${status}`;

    const reasons = [status === "CONFIRMED" ? "Historical depth is supported by at least two independent publisher families including a trusted history/official family." : status === "PARTIAL" ? "Historical clues exist, but independent publisher-family corroboration remains incomplete." : "No reliable identity-matched historical depth was established from the allocated searches and direct-source deep context windows."];
    if (entityId) reasons.push(`Pitbull Wikidata identity ${entityId} was reused for canonical/official historical-source discovery.`);
    if (directUrls.length) reasons.push(`Direct source discovery found ${directUrls.length} candidate canonical/official URL(s) for historical reading.`);
    if (deepEvidence.length) reasons.push(`Deep source context found history language near the place identity on ${deepEvidence.length} page(s).`);
    results.push({ lead: { ...lead, rawClaims: [...lead.rawClaims, historyClaim] }, status, score, evidenceUrls, independentSources: sourceFamilies.length, matchedHistoryTerms, reasons, deepPagesOpened: deep.opened, directSourceUrls: directUrls.length });
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
    rule: "History counts independent publisher families, not language editions or subdomains. Wikidata P856 official pages are preferred alongside canonical sitelinks. Confirmed history still requires at least two independent families including a trusted history/official family; legends remain labeled unless independently established.",
  };
}
