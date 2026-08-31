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

const USER_AGENT = "VelvetPassportResearch/2.4 (pitbull resolver; wikidata + osm; cached public data)";
const PARIS_BOX = { minLat: 48.815, maxLat: 48.902, minLon: 2.224, maxLon: 2.469 };

function insideParis(lat?: number, lon?: number) {
  return typeof lat === "number" && typeof lon === "number" && lat >= PARIS_BOX.minLat && lat <= PARIS_BOX.maxLat && lon >= PARIS_BOX.minLon && lon <= PARIS_BOX.maxLon;
}

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function cleanCandidateName(value: string) {
  return value
    .replace(/\s*[|–—-]\s*(Wikipedia|Wikipédia|Britannica|Tripadvisor|Official.*)$/i, "")
    .replace(/^\d+\s+(best|top)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function likelyNonPlace(name: string) {
  return /\b(history|architecture|arrondissement|tourist office|things to do|guide|definition|population|football|fc|attacks?|liberation|renovation|film|movie|album|song|personality|official site|official website|city pass|exhibitions?|events?|heritage days|right now|actualités|rechercher|contents|origins|geography|climate|administration)\b/i.test(name);
}

function highConfidencePlace(lead: ResearchLead) {
  return lead.sourceType === "MAP" || lead.sourceType === "WIKIDATA" || lead.rawClaims.some((claim) => claim.includes("PLACE_ENTITY_CONFIDENCE HIGH")) || /\b(mus[eé]e|museum|maison|passage|galerie|jardin|garden|librairie|bookshop|atelier|chapelle|church|église|cemetery|cimetière|catacomb|palais|pavillon|villa|théâtre|theatre|bibliothèque|library|fondation|foundation|arcade|marché|market)\b/i.test(lead.name);
}

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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "application/json", "accept-language": "fr,en;q=0.8" },
      signal: controller.signal,
      next: { revalidate: 21600 },
    });
  } finally { clearTimeout(timer); }
}

type NominatimResult = { place_id: number; display_name: string; lat: string; lon: string; type?: string; category?: string; name?: string; importance?: number };
type WikidataSearch = { id: string; label?: string; description?: string };
type WikidataEntity = { labels?: Record<string, { value: string }>; claims?: { P625?: Array<{ mainsnak?: { datavalue?: { value?: { latitude?: number; longitude?: number } } } }> } };

function chooseParisMatch(items: NominatimResult[], wantedName: string) {
  const normalizedWanted = normalize(wantedName);
  return items.map((item) => ({ item, lat: Number(item.lat), lon: Number(item.lon) })).filter(({ lat, lon }) => insideParis(lat, lon)).sort((a, b) => {
    const aName = normalize(a.item.name || a.item.display_name.split(",")[0]);
    const bName = normalize(b.item.name || b.item.display_name.split(",")[0]);
    const aExact = aName === normalizedWanted ? 1 : aName.includes(normalizedWanted) || normalizedWanted.includes(aName) ? 0.5 : 0;
    const bExact = bName === normalizedWanted ? 1 : bName.includes(normalizedWanted) || normalizedWanted.includes(bName) ? 0.5 : 0;
    return bExact - aExact || (b.item.importance ?? 0) - (a.item.importance ?? 0);
  })[0];
}

async function resolveViaWikidata(lead: ResearchLead): Promise<PlaceResolution | null> {
  const name = cleanCandidateName(lead.name);
  if (!name || likelyNonPlace(name) || !highConfidencePlace(lead)) return null;
  try {
    const searchResponse = await fetchWithTimeout(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=fr&uselang=fr&type=item&limit=6&format=json&origin=*`);
    if (!searchResponse.ok) return null;
    const searchJson = await searchResponse.json() as { search?: WikidataSearch[] };
    const candidates = searchJson.search ?? [];
    if (!candidates.length) return null;
    const ids = candidates.map((item) => item.id).join("|");
    const entityResponse = await fetchWithTimeout(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(ids)}&props=labels|claims&languages=fr|en&format=json&origin=*`);
    if (!entityResponse.ok) return null;
    const entityJson = await entityResponse.json() as { entities?: Record<string, WikidataEntity> };
    const wanted = normalize(name);
    const matches = candidates.map((candidate) => {
      const entity = entityJson.entities?.[candidate.id];
      const coord = entity?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
      const lat = coord?.latitude;
      const lon = coord?.longitude;
      const label = entity?.labels?.fr?.value || entity?.labels?.en?.value || candidate.label || name;
      const labelNorm = normalize(label);
      const nameScore = labelNorm === wanted ? 1 : labelNorm.includes(wanted) || wanted.includes(labelNorm) ? 0.8 : 0;
      return { candidate, label, lat, lon, nameScore };
    }).filter((item) => insideParis(item.lat, item.lon) && item.nameScore > 0).sort((a, b) => b.nameScore - a.nameScore);
    const match = matches[0];
    if (!match || typeof match.lat !== "number" || typeof match.lon !== "number") return null;
    const confidence = match.nameScore === 1 ? 98 : 90;
    const enriched: ResearchLead = {
      ...lead,
      name: match.label,
      address: lead.address || "Paris, France",
      lat: match.lat,
      lon: match.lon,
      rawClaims: [...lead.rawClaims, `WIKIDATA_ENTITY ${match.candidate.id}`, `WIKIDATA_COORDINATES ${match.lat},${match.lon}`],
    };
    return { lead: enriched, status: "RESOLVED", confidence, method: "WIKIDATA_DIRECT", reasons: ["High-confidence place resolved directly through Wikidata coordinates inside Paris.", `Wikidata entity: ${match.candidate.id}`] };
  } catch { return null; }
}

async function resolveViaNominatim(lead: ResearchLead): Promise<PlaceResolution> {
  const name = cleanCandidateName(lead.name);
  if (!name || likelyNonPlace(name)) return { lead, status: "UNRESOLVED", confidence: 0, method: "NONE", reasons: ["Candidate title looks like a broad topic, organization, media result or non-place entity."] };
  const queries = [
    { q: `${name}, Paris, France`, method: "NOMINATIM_NAME" as const },
    ...(lead.snippet && lead.snippet.length < 180 && !lead.snippet.startsWith("High-confidence named place") ? [{ q: `${name}, ${lead.snippet}, Paris, France`, method: "NOMINATIM_NAME_SNIPPET" as const }] : []),
  ];
  for (const query of queries) {
    try {
      const response = await fetchWithTimeout(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&q=${encodeURIComponent(query.q)}`);
      if (!response.ok) continue;
      const json = await response.json() as NominatimResult[];
      const match = chooseParisMatch(json, name);
      if (!match) continue;
      const canonicalName = match.item.name || match.item.display_name.split(",")[0] || name;
      const enriched: ResearchLead = { ...lead, name: canonicalName, address: match.item.display_name, lat: match.lat, lon: match.lon, rawClaims: [...lead.rawClaims, match.item.display_name, match.item.category, match.item.type].filter((value): value is string => Boolean(value)) };
      const textMatch = normalize(canonicalName) === normalize(name) ? 1 : normalize(canonicalName).includes(normalize(name)) || normalize(name).includes(normalize(canonicalName)) ? 0.75 : 0.45;
      const confidence = Math.round(65 + textMatch * 25 + Math.min(10, (match.item.importance ?? 0) * 10));
      return { lead: enriched, status: confidence >= 82 ? "RESOLVED" : "PARTIAL", confidence: Math.min(100, confidence), method: query.method, reasons: ["Candidate resolved to coordinates inside the Paris bounding box.", `Resolved address: ${match.item.display_name}`] };
    } catch { /* continue */ }
  }
  return { lead, status: "UNRESOLVED", confidence: 0, method: "NONE", reasons: ["No Paris geocoding match was strong enough to enrich this candidate."] };
}

export async function resolveParisPlaces(leads: ResearchLead[], maxLookups = 18) {
  const ranked = leads.map((lead, index) => ({ lead, index, priority: resolverPriority(lead), highConfidence: highConfidencePlace(lead) })).sort((a, b) => b.priority - a.priority || a.index - b.index);
  const byOriginalIndex = new Map<number, PlaceResolution>();
  let lookups = 0;
  let wikidataLookups = 0;
  let nominatimLookups = 0;
  const reservedHighConfidence = Math.max(4, Math.min(maxLookups, Math.ceil(maxLookups * 0.65)));
  let highConfidenceSpent = 0;

  for (const item of ranked) {
    const lead = item.lead;
    if (insideParis(lead.lat, lead.lon) && lead.address) {
      byOriginalIndex.set(item.index, { lead, status: "RESOLVED", confidence: 100, method: "EXISTING_GEO", reasons: ["Lead already has an address and coordinates inside Paris."] });
      continue;
    }
    if (likelyNonPlace(cleanCandidateName(lead.name))) {
      byOriginalIndex.set(item.index, { lead, status: "UNRESOLVED", confidence: 0, method: "NONE", reasons: ["Candidate rejected before lookup as editorial/navigation/non-place noise."] });
      continue;
    }
    const generalBudgetRemaining = lookups < maxLookups;
    const reservedBudgetRemaining = item.highConfidence && highConfidenceSpent < reservedHighConfidence;
    if (!generalBudgetRemaining && !reservedBudgetRemaining) {
      byOriginalIndex.set(item.index, { lead, status: "UNRESOLVED", confidence: 0, method: "NONE", reasons: ["Geo-enrichment budget exhausted after reserving capacity for strongest physical-place candidates."] });
      continue;
    }
    if (item.highConfidence) {
      const wikidata = await resolveViaWikidata(lead);
      wikidataLookups += 1;
      lookups += 1;
      highConfidenceSpent += 1;
      if (wikidata) { byOriginalIndex.set(item.index, wikidata); continue; }
      if (lookups >= maxLookups) {
        byOriginalIndex.set(item.index, { lead, status: "UNRESOLVED", confidence: 0, method: "NONE", reasons: ["Direct Wikidata resolution failed and the remaining general resolver budget is exhausted."] });
        continue;
      }
    }
    nominatimLookups += 1;
    lookups += 1;
    byOriginalIndex.set(item.index, await resolveViaNominatim(lead));
  }

  const results = leads.map((_, index) => byOriginalIndex.get(index)).filter((item): item is PlaceResolution => Boolean(item));
  return {
    resolved: results.filter((item) => item.status === "RESOLVED"),
    partial: results.filter((item) => item.status === "PARTIAL"),
    unresolved: results.filter((item) => item.status === "UNRESOLVED"),
    all: results,
    lookups,
    wikidataLookups,
    nominatimLookups,
    reservedHighConfidence,
    highConfidenceSpent,
    rule: "Pitbull resolver: reserve most lookup capacity for extracted high-confidence physical places, try direct Wikidata coordinates first, then fall back to Nominatim. Navigation noise spends no lookup. Resolution never bypasses Paris Entity Lock, intent verification, relevance or claim verification.",
  };
}
