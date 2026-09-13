import type { ResearchLead } from "./research-collectors";

export type PlaceResolutionStatus = "RESOLVED" | "PARTIAL" | "UNRESOLVED";
export type PlaceResolutionMethod = "EXISTING_GEO" | "WIKIDATA_DIRECT" | "NOMINATIM_NAME" | "NOMINATIM_NAME_SNIPPET" | "NONE";

export type PlaceResolution = {
  lead: ResearchLead;
  status: PlaceResolutionStatus;
  confidence: number;
  method: PlaceResolutionMethod;
  reasons: string[];
};

const USER_AGENT = "VelvetPassportResearch/2.6 (pitbull resolver; persistent wikidata identity + canonical source handles + osm geo fallback; cached public data)";
const PARIS_BOX = { minLat: 48.815, maxLat: 48.902, minLon: 2.224, maxLon: 2.469 };

function insideParis(lat?: number, lon?: number) {
  return typeof lat === "number" && typeof lon === "number" && lat >= PARIS_BOX.minLat && lat <= PARIS_BOX.maxLat && lon >= PARIS_BOX.minLon && lon <= PARIS_BOX.maxLon;
}
function normalize(value: string) { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
function cleanCandidateName(value: string) { return value.replace(/\s*[|–—-]\s*(Wikipedia|Wikipédia|Britannica|Tripadvisor|Official.*)$/i, "").replace(/^\d+\s+(best|top)\s+/i, "").replace(/\s+/g, " ").trim(); }
function likelyNonPlace(name: string) { return /\b(history|architecture|arrondissement|tourist office|things to do|guide|definition|population|football|fc|attacks?|liberation|renovation|film|movie|album|song|personality|official site|official website|city pass|exhibitions?|events?|heritage days|right now|actualités|rechercher|contents|origins|geography|climate|administration)\b/i.test(name); }
function highConfidencePlace(lead: ResearchLead) { return lead.sourceType === "MAP" || lead.sourceType === "WIKIDATA" || lead.rawClaims.some((claim) => claim.includes("PLACE_ENTITY_CONFIDENCE HIGH")) || /\b(mus[eé]e|museum|maison|passage|galerie|jardin|garden|librairie|bookshop|atelier|chapelle|church|église|cemetery|cimetière|catacomb|palais|pavillon|villa|théâtre|theatre|bibliothèque|library|fondation|foundation|arcade|marché|market)\b/i.test(lead.name); }
function resolverPriority(lead: ResearchLead) {
  if (insideParis(lead.lat, lead.lon) && lead.address) return 1000;
  if (lead.sourceType === "MAP") return 950;
  if (lead.rawClaims.some((claim) => claim.includes("PLACE_ENTITY_CONFIDENCE HIGH") && claim.includes("JSON_LD"))) return 925;
  if (lead.rawClaims.some((claim) => claim.includes("PLACE_ENTITY_CONFIDENCE HIGH"))) return 900;
  if (lead.sourceType === "WIKIDATA") return 875;
  if (highConfidencePlace(lead)) return 825;
  if (lead.sourceType === "OFFICIAL") return 400;
  return 250;
}
async function fetchWithTimeout(url: string, timeoutMs = 4500) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "application/json", "accept-language": "fr,en;q=0.8" }, signal: controller.signal, next: { revalidate: 21600 } }); }
  finally { clearTimeout(timer); }
}

type NominatimResult = { place_id: number; display_name: string; lat: string; lon: string; type?: string; category?: string; name?: string; importance?: number };
type WikidataSearch = { id: string; label?: string; description?: string };
type WikidataEntity = {
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  sitelinks?: Record<string, { title?: string }>;
  claims?: {
    P625?: Array<{ mainsnak?: { datavalue?: { value?: { latitude?: number; longitude?: number } } } }>;
    P856?: Array<{ mainsnak?: { datavalue?: { value?: string } } }>;
  };
};
type WikidataIdentity = { id: string; label: string; lat?: number; lon?: number; nameScore: number; sourceUrls: string[] };

function existingWikidataId(lead: ResearchLead) { return lead.rawClaims.map((claim) => claim.match(/^WIKIDATA_ENTITY\s+(Q\d+)$/i)?.[1]).find(Boolean); }
function existingSourceUrls(lead: ResearchLead) { return lead.rawClaims.map((claim) => claim.match(/^WIKIDATA_SOURCE_URL\s+(https?:\/\/\S+)$/i)?.[1]).filter((value): value is string => Boolean(value)); }
function sourceUrlsFromEntity(entity?: WikidataEntity) {
  const urls: string[] = [];
  for (const claim of entity?.claims?.P856 ?? []) {
    const value = claim.mainsnak?.datavalue?.value;
    if (typeof value === "string" && /^https?:\/\//i.test(value)) urls.push(value);
  }
  const en = entity?.sitelinks?.enwiki?.title;
  const fr = entity?.sitelinks?.frwiki?.title;
  if (en) urls.push(`https://en.wikipedia.org/wiki/${encodeURIComponent(en.replace(/ /g, "_"))}`);
  if (fr) urls.push(`https://fr.wikipedia.org/wiki/${encodeURIComponent(fr.replace(/ /g, "_"))}`);
  return [...new Set(urls)].slice(0, 6);
}
function attachWikidataIdentity(lead: ResearchLead, identity?: WikidataIdentity | null) {
  if (!identity) return lead;
  const claims = [...lead.rawClaims];
  if (!existingWikidataId(lead)) claims.push(`WIKIDATA_ENTITY ${identity.id}`);
  const knownUrls = new Set(existingSourceUrls(lead));
  for (const url of identity.sourceUrls) if (!knownUrls.has(url)) claims.push(`WIKIDATA_SOURCE_URL ${url}`);
  return { ...lead, rawClaims: claims };
}
function chooseParisMatch(items: NominatimResult[], wantedName: string) {
  const normalizedWanted = normalize(wantedName);
  return items.map((item) => ({ item, lat: Number(item.lat), lon: Number(item.lon) })).filter(({ lat, lon }) => insideParis(lat, lon)).sort((a, b) => {
    const aName = normalize(a.item.name || a.item.display_name.split(",")[0]); const bName = normalize(b.item.name || b.item.display_name.split(",")[0]);
    const aExact = aName === normalizedWanted ? 1 : aName.includes(normalizedWanted) || normalizedWanted.includes(aName) ? 0.5 : 0;
    const bExact = bName === normalizedWanted ? 1 : bName.includes(normalizedWanted) || normalizedWanted.includes(bName) ? 0.5 : 0;
    return bExact - aExact || (b.item.importance ?? 0) - (a.item.importance ?? 0);
  })[0];
}

async function lookupWikidataIdentity(lead: ResearchLead): Promise<WikidataIdentity | null> {
  const name = cleanCandidateName(lead.name);
  if (!name || likelyNonPlace(name) || !highConfidencePlace(lead)) return null;
  try {
    const searchResponse = await fetchWithTimeout(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=fr&uselang=fr&type=item&limit=6&format=json&origin=*`);
    if (!searchResponse.ok) return null;
    const searchJson = await searchResponse.json() as { search?: WikidataSearch[] };
    const candidates = searchJson.search ?? [];
    if (!candidates.length) return null;
    const ids = candidates.map((item) => item.id).join("|");
    const entityResponse = await fetchWithTimeout(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(ids)}&props=labels|descriptions|claims|sitelinks&sitefilter=enwiki|frwiki&languages=fr|en&format=json&origin=*`);
    if (!entityResponse.ok) return null;
    const entityJson = await entityResponse.json() as { entities?: Record<string, WikidataEntity> };
    const wanted = normalize(name);
    const matches = candidates.map((candidate) => {
      const entity = entityJson.entities?.[candidate.id]; const coord = entity?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
      const label = entity?.labels?.fr?.value || entity?.labels?.en?.value || candidate.label || name; const labelNorm = normalize(label);
      const nameScore = labelNorm === wanted ? 1 : labelNorm.includes(wanted) || wanted.includes(labelNorm) ? 0.8 : 0;
      const description = `${entity?.descriptions?.fr?.value ?? ""} ${entity?.descriptions?.en?.value ?? ""} ${candidate.description ?? ""}`;
      const placeSignal = /museum|musée|garden|jardin|passage|gallery|galerie|library|bibliothèque|bookshop|librairie|building|bâtiment|monument|palace|palais|church|église|cemetery|cimetière|theatre|théâtre|Paris/i.test(description);
      return { id: candidate.id, label, lat: coord?.latitude, lon: coord?.longitude, nameScore, placeSignal, sourceUrls: sourceUrlsFromEntity(entity) };
    }).filter((item) => item.nameScore > 0 && (item.placeSignal || insideParis(item.lat, item.lon))).sort((a, b) => {
      const aParis = insideParis(a.lat, a.lon) ? 1 : 0; const bParis = insideParis(b.lat, b.lon) ? 1 : 0; return bParis - aParis || b.nameScore - a.nameScore;
    });
    const match = matches[0]; if (!match) return null;
    return { id: match.id, label: match.label, lat: match.lat, lon: match.lon, nameScore: match.nameScore, sourceUrls: match.sourceUrls };
  } catch { return null; }
}

function resolutionFromWikidata(lead: ResearchLead, identity: WikidataIdentity): PlaceResolution | null {
  if (!insideParis(identity.lat, identity.lon) || typeof identity.lat !== "number" || typeof identity.lon !== "number") return null;
  const confidence = identity.nameScore === 1 ? 98 : 90; const attached = attachWikidataIdentity(lead, identity);
  const enriched: ResearchLead = { ...attached, name: identity.label, address: lead.address || "Paris, France", lat: identity.lat, lon: identity.lon, rawClaims: [...attached.rawClaims, `WIKIDATA_COORDINATES ${identity.lat},${identity.lon}`] };
  const reasons = ["High-confidence place resolved directly through Wikidata coordinates inside Paris.", `Wikidata entity: ${identity.id}`];
  if (identity.sourceUrls.length) reasons.push(`Wikidata identity carried ${identity.sourceUrls.length} canonical/official source handle(s) downstream.`);
  return { lead: enriched, status: "RESOLVED", confidence, method: "WIKIDATA_DIRECT", reasons };
}

async function resolveViaNominatim(lead: ResearchLead, identity?: WikidataIdentity | null): Promise<PlaceResolution> {
  const leadWithIdentity = attachWikidataIdentity(lead, identity); const name = cleanCandidateName(leadWithIdentity.name);
  if (!name || likelyNonPlace(name)) return { lead: leadWithIdentity, status: "UNRESOLVED", confidence: 0, method: "NONE", reasons: ["Candidate title looks like a broad topic, organization, media result or non-place entity."] };
  const queries = [{ q: `${name}, Paris, France`, method: "NOMINATIM_NAME" as const }, ...(leadWithIdentity.snippet && leadWithIdentity.snippet.length < 180 && !leadWithIdentity.snippet.startsWith("High-confidence named place") ? [{ q: `${name}, ${leadWithIdentity.snippet}, Paris, France`, method: "NOMINATIM_NAME_SNIPPET" as const }] : [])];
  for (const query of queries) {
    try {
      const response = await fetchWithTimeout(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&q=${encodeURIComponent(query.q)}`); if (!response.ok) continue;
      const json = await response.json() as NominatimResult[]; const match = chooseParisMatch(json, name); if (!match) continue;
      const canonicalName = match.item.name || match.item.display_name.split(",")[0] || name;
      const enriched: ResearchLead = { ...leadWithIdentity, name: canonicalName, address: match.item.display_name, lat: match.lat, lon: match.lon, rawClaims: [...leadWithIdentity.rawClaims, match.item.display_name, match.item.category, match.item.type].filter((value): value is string => Boolean(value)) };
      const textMatch = normalize(canonicalName) === normalize(name) ? 1 : normalize(canonicalName).includes(normalize(name)) || normalize(name).includes(normalize(canonicalName)) ? 0.75 : 0.45;
      const confidence = Math.round(65 + textMatch * 25 + Math.min(10, (match.item.importance ?? 0) * 10)); const reasons = ["Candidate resolved to coordinates inside the Paris bounding box.", `Resolved address: ${match.item.display_name}`];
      if (identity) reasons.push(`Wikidata identity preserved across Nominatim fallback: ${identity.id}`); if (identity?.sourceUrls.length) reasons.push(`Wikidata identity carried ${identity.sourceUrls.length} canonical/official source handle(s) through Nominatim fallback.`);
      return { lead: enriched, status: confidence >= 82 ? "RESOLVED" : "PARTIAL", confidence: Math.min(100, confidence), method: query.method, reasons };
    } catch { /* continue */ }
  }
  const reasons = ["No Paris geocoding match was strong enough to enrich this candidate."]; if (identity) reasons.push(`Wikidata identity preserved despite geo fallback failure: ${identity.id}`); if (identity?.sourceUrls.length) reasons.push(`Wikidata identity still carries ${identity.sourceUrls.length} canonical/official source handle(s) for downstream research.`);
  return { lead: leadWithIdentity, status: "UNRESOLVED", confidence: 0, method: "NONE", reasons };
}

export async function resolveParisPlaces(leads: ResearchLead[], maxLookups = 18) {
  const ranked = leads.map((lead, index) => ({ lead, index, priority: resolverPriority(lead), highConfidence: highConfidencePlace(lead) })).sort((a, b) => b.priority - a.priority || a.index - b.index);
  const byOriginalIndex = new Map<number, PlaceResolution>(); let lookups = 0; let wikidataLookups = 0; let nominatimLookups = 0; let wikidataIdentitiesPreserved = 0; let wikidataSourceHandlesPreserved = 0;
  const reservedHighConfidence = Math.max(4, Math.min(maxLookups, Math.ceil(maxLookups * 0.65))); let highConfidenceSpent = 0;
  for (const item of ranked) {
    const lead = item.lead;
    if (insideParis(lead.lat, lead.lon) && lead.address) { byOriginalIndex.set(item.index, { lead, status: "RESOLVED", confidence: 100, method: "EXISTING_GEO", reasons: ["Lead already has an address and coordinates inside Paris."] }); continue; }
    if (likelyNonPlace(cleanCandidateName(lead.name))) { byOriginalIndex.set(item.index, { lead, status: "UNRESOLVED", confidence: 0, method: "NONE", reasons: ["Candidate rejected before lookup as editorial/navigation/non-place noise."] }); continue; }
    const generalBudgetRemaining = lookups < maxLookups; const reservedBudgetRemaining = item.highConfidence && highConfidenceSpent < reservedHighConfidence;
    if (!generalBudgetRemaining && !reservedBudgetRemaining) { byOriginalIndex.set(item.index, { lead, status: "UNRESOLVED", confidence: 0, method: "NONE", reasons: ["Geo-enrichment budget exhausted after reserving capacity for strongest physical-place candidates."] }); continue; }
    let identity: WikidataIdentity | null = null;
    if (item.highConfidence) {
      identity = await lookupWikidataIdentity(lead); wikidataLookups += 1; lookups += 1; highConfidenceSpent += 1;
      if (identity) { wikidataIdentitiesPreserved += 1; wikidataSourceHandlesPreserved += identity.sourceUrls.length; const direct = resolutionFromWikidata(lead, identity); if (direct) { byOriginalIndex.set(item.index, direct); continue; } }
      if (lookups >= maxLookups) {
        const preserved = attachWikidataIdentity(lead, identity); const reasons = ["Direct Wikidata coordinate resolution did not finish the geo step and the remaining general resolver budget is exhausted."];
        if (identity) reasons.push(`Wikidata identity preserved for downstream canonical-source discovery: ${identity.id}`); if (identity?.sourceUrls.length) reasons.push(`Wikidata identity carried ${identity.sourceUrls.length} canonical/official source handle(s) despite exhausted geo budget.`);
        byOriginalIndex.set(item.index, { lead: preserved, status: "UNRESOLVED", confidence: 0, method: "NONE", reasons }); continue;
      }
    }
    nominatimLookups += 1; lookups += 1; byOriginalIndex.set(item.index, await resolveViaNominatim(lead, identity));
  }
  const results = leads.map((_, index) => byOriginalIndex.get(index)).filter((item): item is PlaceResolution => Boolean(item));
  return { resolved: results.filter((item) => item.status === "RESOLVED"), partial: results.filter((item) => item.status === "PARTIAL"), unresolved: results.filter((item) => item.status === "UNRESOLVED"), all: results, lookups, wikidataLookups, nominatimLookups, wikidataIdentitiesPreserved, wikidataSourceHandlesPreserved, reservedHighConfidence, highConfidenceSpent, rule: "Pitbull resolver V2.6 separates entity identity, canonical source handles and geo method. When Wikidata identity resolution succeeds, P856 official URLs and canonical en/fr sitelinks are carried on the lead immediately, so downstream evidence research does not depend on a second Wikidata network call. Source handles are navigation evidence only and never verify a claim by themselves." };
}
