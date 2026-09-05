export type VenuePoolSeed = {
  id: string;
  name: string;
  qid: string;
  lat?: number;
  lon?: number;
  officialUrl?: string;
  category: string;
};

export type VenuePoolResult = {
  theme: string;
  ok: boolean;
  queried: boolean;
  returned: number;
  seeds: VenuePoolSeed[];
  error?: string;
  rule: string;
};

const USER_AGENT = "VelvetPassportVenuePool/1.1 (Wikidata API physical entities; discovery seeds only; cached public data)";
const API = "https://www.wikidata.org/w/api.php";

const THEME_SEARCHES: Record<string, Array<{ query: string; category: string }>> = {
  "paris-after-dark": [
    { query: "musée Paris", category: "museum" },
    { query: "museum Paris", category: "museum" },
    { query: "théâtre Paris", category: "performing arts venue" },
    { query: "centre culturel Paris", category: "cultural venue" },
    { query: "galerie Paris", category: "gallery" },
  ],
  "unusual-museums": [
    { query: "musée Paris", category: "museum" },
    { query: "museum Paris", category: "museum" },
    { query: "maison musée Paris", category: "house museum" },
    { query: "musée privé Paris", category: "museum" },
  ],
  "beyond-the-classics": [
    { query: "musée Paris", category: "museum" },
    { query: "maison musée Paris", category: "house museum" },
    { query: "fondation Paris musée", category: "foundation" },
    { query: "passage Paris", category: "passage" },
  ],
  "quiet-paris": [
    { query: "jardin Paris", category: "garden" },
    { query: "parc Paris", category: "park" },
    { query: "musée Paris", category: "museum" },
    { query: "bibliothèque Paris", category: "library" },
  ],
  "secret-gardens": [
    { query: "jardin Paris", category: "garden" },
    { query: "parc Paris", category: "park" },
    { query: "square Paris", category: "garden" },
  ],
  "rainy-day-paris": [
    { query: "musée Paris", category: "museum" },
    { query: "museum Paris", category: "museum" },
    { query: "passage couvert Paris", category: "covered passage" },
    { query: "bibliothèque Paris", category: "library" },
  ],
};

type SearchRow = { id?: string; label?: string; description?: string };
type EntityClaim = { mainsnak?: { datavalue?: { value?: unknown } } };
type EntityRow = {
  id?: string;
  labels?: Record<string, { value?: string }>;
  claims?: Record<string, EntityClaim[]>;
};

async function fetchWithTimeout(url: string, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "application/json" },
      signal: controller.signal,
      next: { revalidate: 21600 },
    });
  } finally {
    clearTimeout(timer);
  }
}

function searchUrl(query: string) {
  const params = new URLSearchParams({
    action: "wbsearchentities",
    search: query,
    language: "fr",
    uselang: "fr",
    type: "item",
    limit: "10",
    format: "json",
    origin: "*",
  });
  return `${API}?${params.toString()}`;
}

function entitiesUrl(ids: string[]) {
  const params = new URLSearchParams({
    action: "wbgetentities",
    ids: ids.join("|"),
    props: "claims|labels",
    languages: "fr|en",
    format: "json",
    origin: "*",
  });
  return `${API}?${params.toString()}`;
}

function coordinateFromClaims(claims: Record<string, EntityClaim[]> | undefined) {
  const value = claims?.P625?.[0]?.mainsnak?.datavalue?.value;
  if (!value || typeof value !== "object") return {};
  const row = value as { latitude?: unknown; longitude?: unknown };
  const lat = Number(row.latitude);
  const lon = Number(row.longitude);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : {};
}

function officialUrlFromClaims(claims: Record<string, EntityClaim[]> | undefined) {
  const value = claims?.P856?.[0]?.mainsnak?.datavalue?.value;
  return typeof value === "string" && /^https?:\/\//i.test(value) ? value : undefined;
}

function inParis(lat: number | undefined, lon: number | undefined) {
  return typeof lat === "number" && typeof lon === "number" && lat >= 48.80 && lat <= 48.91 && lon >= 2.22 && lon <= 2.47;
}

function labelOf(entity: EntityRow, fallback?: string) {
  return entity.labels?.fr?.value?.trim() || entity.labels?.en?.value?.trim() || fallback?.trim() || "";
}

export async function collectWikidataVenuePool(theme: string, maxSeeds = 18): Promise<VenuePoolResult> {
  const searches = THEME_SEARCHES[theme] ?? [];
  const rule = "Wikidata Venue Pool supplies concrete physical-place discovery seeds only. Search results are batch-resolved to Wikidata coordinates and must fall inside the Paris bounding box. A seed receives no traveler-intent, rarity, exposure, history or publication credit merely for existing in Wikidata; every seed must still pass Paris geo lock, focused intent evidence, exposure, relevance, claim verification and Safe Copy.";
  if (!searches.length) return { theme, ok: true, queried: false, returned: 0, seeds: [], rule };

  try {
    const searchResponses = await Promise.all(searches.map(async (spec) => {
      try {
        const response = await fetchWithTimeout(searchUrl(spec.query));
        if (!response.ok) return { spec, rows: [] as SearchRow[] };
        const json = await response.json() as { search?: SearchRow[] };
        return { spec, rows: json.search ?? [] };
      } catch {
        return { spec, rows: [] as SearchRow[] };
      }
    }));

    const metadata = new Map<string, { category: string; fallbackLabel?: string }>();
    for (const result of searchResponses) {
      for (const row of result.rows) {
        if (!row.id || !/^Q\d+$/i.test(row.id)) continue;
        if (!metadata.has(row.id)) metadata.set(row.id, { category: result.spec.category, fallbackLabel: row.label });
      }
    }

    const ids = [...metadata.keys()].slice(0, 40);
    if (!ids.length) return { theme, ok: true, queried: true, returned: 0, seeds: [], rule };

    const entityResponse = await fetchWithTimeout(entitiesUrl(ids), 6000);
    if (!entityResponse.ok) throw new Error(`entity_http_${entityResponse.status}`);
    const entityJson = await entityResponse.json() as { entities?: Record<string, EntityRow> };

    const seeds: VenuePoolSeed[] = [];
    for (const qid of ids) {
      const entity = entityJson.entities?.[qid];
      if (!entity) continue;
      const coords = coordinateFromClaims(entity.claims);
      if (!inParis(coords.lat, coords.lon)) continue;
      const meta = metadata.get(qid);
      const name = labelOf(entity, meta?.fallbackLabel);
      if (!name || /^Q\d+$/i.test(name)) continue;
      seeds.push({
        id: `venue-pool:${qid}`,
        name,
        qid,
        lat: coords.lat,
        lon: coords.lon,
        officialUrl: officialUrlFromClaims(entity.claims),
        category: meta?.category ?? "physical venue",
      });
      if (seeds.length >= Math.max(1, Math.min(maxSeeds, 24))) break;
    }

    return { theme, ok: true, queried: true, returned: seeds.length, seeds, rule };
  } catch (error) {
    return { theme, ok: false, queried: true, returned: 0, seeds: [], error: error instanceof Error ? error.message : "wikidata_venue_pool_failed", rule };
  }
}
