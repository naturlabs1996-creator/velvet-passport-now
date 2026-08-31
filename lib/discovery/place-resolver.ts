import type { ResearchLead } from "./research-collectors";

export type PlaceResolutionStatus = "RESOLVED" | "PARTIAL" | "UNRESOLVED";

export type PlaceResolution = {
  lead: ResearchLead;
  status: PlaceResolutionStatus;
  confidence: number;
  method: "EXISTING_GEO" | "NOMINATIM_NAME" | "NOMINATIM_NAME_SNIPPET" | "NONE";
  reasons: string[];
};

const USER_AGENT = "VelvetPassportResearch/2.2 (place resolver + budget guard; public data; cached requests)";
const PARIS_BOX = { minLat: 48.815, maxLat: 48.902, minLon: 2.224, maxLon: 2.469 };

function insideParis(lat?: number, lon?: number) {
  return typeof lat === "number" && typeof lon === "number" && lat >= PARIS_BOX.minLat && lat <= PARIS_BOX.maxLat && lon >= PARIS_BOX.minLon && lon <= PARIS_BOX.maxLon;
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

function resolverPriority(lead: ResearchLead) {
  if (insideParis(lead.lat, lead.lon) && lead.address) return 1000;
  if (lead.sourceType === "MAP") return 900;
  if (lead.rawClaims.some((claim) => claim.includes("PLACE_ENTITY_CONFIDENCE HIGH") && claim.includes("JSON_LD"))) return 850;
  if (lead.sourceType === "WIKIDATA") return 800;
  if (lead.rawClaims.some((claim) => claim.includes("PLACE_ENTITY_CONFIDENCE HIGH"))) return 700;
  if (/\b(mus[eé]e|museum|maison|passage|galerie|jardin|garden|librairie|bookshop|atelier|chapelle|church|église|cemetery|cimetière|catacomb|palais|pavillon|villa|théâtre|theatre|bibliothèque|library|fondation|foundation|arcade|marché|market)\b/i.test(lead.name)) return 650;
  if (lead.sourceType === "OFFICIAL") return 400;
  return 250;
}

async function fetchWithTimeout(url: string, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "application/json", "accept-language": "en,fr;q=0.8" },
      signal: controller.signal,
      next: { revalidate: 21600 },
    });
  } finally {
    clearTimeout(timer);
  }
}

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  category?: string;
  name?: string;
  importance?: number;
};

function chooseParisMatch(items: NominatimResult[], wantedName: string) {
  const normalizedWanted = wantedName.toLowerCase();
  return items
    .map((item) => ({ item, lat: Number(item.lat), lon: Number(item.lon) }))
    .filter(({ lat, lon }) => insideParis(lat, lon))
    .sort((a, b) => {
      const aName = (a.item.name || a.item.display_name.split(",")[0]).toLowerCase();
      const bName = (b.item.name || b.item.display_name.split(",")[0]).toLowerCase();
      const aExact = aName === normalizedWanted ? 1 : aName.includes(normalizedWanted) || normalizedWanted.includes(aName) ? 0.5 : 0;
      const bExact = bName === normalizedWanted ? 1 : bName.includes(normalizedWanted) || normalizedWanted.includes(bName) ? 0.5 : 0;
      return bExact - aExact || (b.item.importance ?? 0) - (a.item.importance ?? 0);
    })[0];
}

async function resolveViaNominatim(lead: ResearchLead): Promise<PlaceResolution> {
  const name = cleanCandidateName(lead.name);
  if (!name || likelyNonPlace(name)) {
    return { lead, status: "UNRESOLVED", confidence: 0, method: "NONE", reasons: ["Candidate title looks like a broad topic, organization, media result or non-place entity."] };
  }

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
      const enriched: ResearchLead = {
        ...lead,
        name: canonicalName,
        address: match.item.display_name,
        lat: match.lat,
        lon: match.lon,
        rawClaims: [...lead.rawClaims, match.item.display_name, match.item.category, match.item.type].filter((value): value is string => Boolean(value)),
      };
      const textMatch = canonicalName.toLowerCase() === name.toLowerCase() ? 1 : canonicalName.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(canonicalName.toLowerCase()) ? 0.75 : 0.45;
      const confidence = Math.round(65 + textMatch * 25 + Math.min(10, (match.item.importance ?? 0) * 10));
      return {
        lead: enriched,
        status: confidence >= 82 ? "RESOLVED" : "PARTIAL",
        confidence: Math.min(100, confidence),
        method: query.method,
        reasons: ["Candidate resolved to coordinates inside the Paris bounding box.", `Resolved address: ${match.item.display_name}`],
      };
    } catch {
      // Try the next resolution path.
    }
  }

  return { lead, status: "UNRESOLVED", confidence: 0, method: "NONE", reasons: ["No Paris geocoding match was strong enough to enrich this candidate."] };
}

export async function resolveParisPlaces(leads: ResearchLead[], maxLookups = 18) {
  const ranked = leads.map((lead, index) => ({ lead, index, priority: resolverPriority(lead) })).sort((a, b) => b.priority - a.priority || a.index - b.index);
  const byOriginalIndex = new Map<number, PlaceResolution>();
  let lookups = 0;

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
    if (lookups >= maxLookups) {
      byOriginalIndex.set(item.index, { lead, status: "UNRESOLVED", confidence: 0, method: "NONE", reasons: ["Geo-enrichment lookup budget reserved for stronger physical-place candidates and exhausted before this candidate was checked."] });
      continue;
    }
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
    rule: "Resolver budget is ranked toward existing geo, map, structured place entities and named venue candidates. Navigation/editorial noise is rejected without spending a lookup. Geo enrichment cannot promote relevance or factual truth by itself.",
  };
}
