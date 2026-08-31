import type { ResearchLead } from "./research-collectors";

export type PlaceResolutionStatus = "RESOLVED" | "PARTIAL" | "UNRESOLVED";

export type PlaceResolution = {
  lead: ResearchLead;
  status: PlaceResolutionStatus;
  confidence: number;
  method: "EXISTING_GEO" | "NOMINATIM_NAME" | "NOMINATIM_NAME_SNIPPET" | "NONE";
  reasons: string[];
};

const USER_AGENT = "VelvetPassportResearch/2.1 (place resolver; public data; cached requests)";
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
  return /\b(history|architecture|arrondissement|tourist office|things to do|guide|definition|population|football|fc|attacks?|liberation|renovation|film|movie|album|song|personality|official site)\b/i.test(name);
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
    ...(lead.snippet && lead.snippet.length < 180 ? [{ q: `${name}, ${lead.snippet}, Paris, France`, method: "NOMINATIM_NAME_SNIPPET" as const }] : []),
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
  const results: PlaceResolution[] = [];
  let lookups = 0;
  for (const lead of leads) {
    if (insideParis(lead.lat, lead.lon) && lead.address) {
      results.push({ lead, status: "RESOLVED", confidence: 100, method: "EXISTING_GEO", reasons: ["Lead already has an address and coordinates inside Paris."] });
      continue;
    }
    if (lookups >= maxLookups) {
      results.push({ lead, status: "UNRESOLVED", confidence: 0, method: "NONE", reasons: ["Geo-enrichment lookup budget exhausted before this candidate was checked."] });
      continue;
    }
    lookups += 1;
    results.push(await resolveViaNominatim(lead));
  }

  return {
    resolved: results.filter((item) => item.status === "RESOLVED"),
    partial: results.filter((item) => item.status === "PARTIAL"),
    unresolved: results.filter((item) => item.status === "UNRESOLVED"),
    all: results,
    lookups,
    rule: "A research trail is enriched into a physical Paris place before Destination Entity Lock whenever enough evidence is available. Geo enrichment cannot promote relevance or factual truth by itself.",
  };
}
