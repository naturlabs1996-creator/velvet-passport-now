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
  directReturned: number;
  typedSearchReturned: number;
  geoReturned: number;
  seeds: VenuePoolSeed[];
  error?: string;
  rule: string;
};

const USER_AGENT = "VelvetPassportVenuePool/1.3 (Wikidata API + typed Wikipedia venue search + geo fallback; discovery seeds only)";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const WIKIPEDIA_API = "https://fr.wikipedia.org/w/api.php";

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
    { query: "passage couvert Paris", category: "passage" },
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

const PARIS_SWEEP_CENTERS = [
  { lat: 48.8566, lon: 2.3522 },
  { lat: 48.885, lon: 2.35 },
  { lat: 48.835, lon: 2.35 },
  { lat: 48.86, lon: 2.41 },
  { lat: 48.86, lon: 2.29 },
];

type SearchRow = { id?: string; label?: string; description?: string };
type EntityClaim = { mainsnak?: { datavalue?: { value?: unknown } } };
type EntityRow = { id?: string; labels?: Record<string, { value?: string }>; claims?: Record<string, EntityClaim[]> };
type GeoRow = { pageid?: number; title?: string; lat?: number; lon?: number };
type WikiPage = { pageid?: number; title?: string; pageprops?: { wikibase_item?: string }; coordinates?: Array<{ lat?: number; lon?: number }>; categories?: Array<{ title?: string }> };
type WikiSearchRow = { pageid?: number; title?: string; snippet?: string };

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
  const params = new URLSearchParams({ action: "wbsearchentities", search: query, language: "fr", uselang: "fr", type: "item", limit: "10", format: "json", origin: "*" });
  return `${WIKIDATA_API}?${params.toString()}`;
}
function entitiesUrl(ids: string[]) {
  const params = new URLSearchParams({ action: "wbgetentities", ids: ids.join("|"), props: "claims|labels", languages: "fr|en", format: "json", origin: "*" });
  return `${WIKIDATA_API}?${params.toString()}`;
}
function wikiSearchUrl(query: string) {
  const params = new URLSearchParams({ action: "query", list: "search", srsearch: query, srlimit: "20", srnamespace: "0", format: "json", origin: "*" });
  return `${WIKIPEDIA_API}?${params.toString()}`;
}
function geoSearchUrl(lat: number, lon: number) {
  const params = new URLSearchParams({ action: "query", list: "geosearch", gscoord: `${lat}|${lon}`, gsradius: "6500", gslimit: "50", gsnamespace: "0", format: "json", origin: "*" });
  return `${WIKIPEDIA_API}?${params.toString()}`;
}
function wikiDetailsUrl(pageIds: number[]) {
  const params = new URLSearchParams({ action: "query", pageids: pageIds.join("|"), prop: "pageprops|coordinates|categories", colimit: "1", cllimit: "max", format: "json", origin: "*" });
  return `${WIKIPEDIA_API}?${params.toString()}`;
}

function coordinateFromClaims(claims: Record<string, EntityClaim[]> | undefined) {
  const value = claims?.P625?.[0]?.mainsnak?.datavalue?.value;
  if (!value || typeof value !== "object") return {};
  const row = value as { latitude?: unknown; longitude?: unknown };
  const lat = Number(row.latitude); const lon = Number(row.longitude);
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
function categoryText(page: WikiPage) {
  return `${page.title ?? ""} ${(page.categories ?? []).map((item) => item.title ?? "").join(" ")}`.toLowerCase();
}
function geoCategory(theme: string, page: WikiPage) {
  const text = categoryText(page);
  const tests: Record<string, Array<[RegExp, string]>> = {
    "paris-after-dark": [
      [/mus[eé]e|museum/, "museum"],
      [/th[eé][aâ]tre|salle de spectacle|salle de concert|op[eé]ra/, "performing arts venue"],
      [/galerie d['’]art|centre culturel|fondation d['’]art/, "cultural venue"],
    ],
    "unusual-museums": [[/mus[eé]e|museum|maison-mus[eé]e/, "museum"]],
    "beyond-the-classics": [
      [/mus[eé]e|museum|maison-mus[eé]e/, "museum"],
      [/passage couvert|galerie couverte/, "passage"],
      [/fondation d['’]art|maison d['’][eé]crivain|maison d['’]artiste/, "cultural venue"],
    ],
    "quiet-paris": [[/jardin|parc|square/, "garden"], [/biblioth[eè]que/, "library"], [/mus[eé]e|museum/, "museum"]],
    "secret-gardens": [[/jardin|parc|square/, "garden"]],
    "rainy-day-paris": [[/mus[eé]e|museum/, "museum"], [/biblioth[eè]que/, "library"], [/passage couvert|galerie couverte/, "covered passage"]],
  };
  for (const [pattern, category] of tests[theme] ?? []) if (pattern.test(text)) return category;
  return null;
}
function chunks<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function detailsForPageIds(pageIds: number[]) {
  const batches = await Promise.all(chunks([...new Set(pageIds)].slice(0, 240), 50).map(async (ids) => {
    try {
      const response = await fetchWithTimeout(wikiDetailsUrl(ids), 5000);
      if (!response.ok) return [] as WikiPage[];
      const json = await response.json() as { query?: { pages?: Record<string, WikiPage> } };
      return Object.values(json.query?.pages ?? {});
    } catch { return [] as WikiPage[]; }
  }));
  return batches.flat();
}

async function collectTypedVenueSearch(theme: string, maxSeeds: number): Promise<VenuePoolSeed[]> {
  const specs = THEME_SEARCHES[theme] ?? [];
  const responses = await Promise.all(specs.map(async (spec) => {
    try {
      const response = await fetchWithTimeout(wikiSearchUrl(`${spec.query} Paris`), 4500);
      if (!response.ok) return { spec, rows: [] as WikiSearchRow[] };
      const json = await response.json() as { query?: { search?: WikiSearchRow[] } };
      return { spec, rows: json.query?.search ?? [] };
    } catch { return { spec, rows: [] as WikiSearchRow[] }; }
  }));
  const specByPage = new Map<number, string>();
  const pageIds: number[] = [];
  for (const result of responses) {
    for (const row of result.rows) {
      if (typeof row.pageid !== "number") continue;
      if (!specByPage.has(row.pageid)) specByPage.set(row.pageid, result.spec.category);
      pageIds.push(row.pageid);
    }
  }
  const pages = await detailsForPageIds(pageIds);
  const seeds: VenuePoolSeed[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    const qid = page.pageprops?.wikibase_item;
    const coord = page.coordinates?.[0];
    const category = geoCategory(theme, page) ?? (typeof page.pageid === "number" ? specByPage.get(page.pageid) : undefined);
    if (!qid || !/^Q\d+$/i.test(qid) || !category || !inParis(coord?.lat, coord?.lon) || seen.has(qid)) continue;
    const name = page.title?.trim();
    if (!name) continue;
    seen.add(qid);
    seeds.push({ id: `venue-search:${qid}`, name, qid, lat: coord?.lat, lon: coord?.lon, category });
    if (seeds.length >= maxSeeds) break;
  }
  return seeds;
}

async function collectGeoSweep(theme: string, maxSeeds: number): Promise<VenuePoolSeed[]> {
  const geoResponses = await Promise.all(PARIS_SWEEP_CENTERS.map(async (center) => {
    try {
      const response = await fetchWithTimeout(geoSearchUrl(center.lat, center.lon), 4500);
      if (!response.ok) return [] as GeoRow[];
      const json = await response.json() as { query?: { geosearch?: GeoRow[] } };
      return json.query?.geosearch ?? [];
    } catch { return [] as GeoRow[]; }
  }));
  const geoByPage = new Map<number, GeoRow>();
  for (const row of geoResponses.flat()) {
    if (typeof row.pageid !== "number" || typeof row.lat !== "number" || typeof row.lon !== "number" || !inParis(row.lat, row.lon)) continue;
    if (!geoByPage.has(row.pageid)) geoByPage.set(row.pageid, row);
  }
  const pages = await detailsForPageIds([...geoByPage.keys()]);
  const seeds: VenuePoolSeed[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    const qid = page.pageprops?.wikibase_item;
    const category = geoCategory(theme, page);
    const geo = typeof page.pageid === "number" ? geoByPage.get(page.pageid) : undefined;
    if (!qid || !/^Q\d+$/i.test(qid) || !category || !geo || seen.has(qid)) continue;
    const name = page.title?.trim(); if (!name) continue;
    seen.add(qid);
    seeds.push({ id: `venue-geo:${qid}`, name, qid, lat: geo.lat, lon: geo.lon, category });
    if (seeds.length >= maxSeeds) break;
  }
  return seeds;
}

export async function collectWikidataVenuePool(theme: string, maxSeeds = 18): Promise<VenuePoolResult> {
  const searches = THEME_SEARCHES[theme] ?? [];
  const cap = Math.max(1, Math.min(maxSeeds, 24));
  const rule = "Venue Pool V1.3 uses three discovery lanes: fast Wikidata entity search, typed French-Wikipedia venue search, then bounded Paris geosearch fallback. Every Wikipedia seed must expose a QID, coordinates inside the Paris bounding box and a theme-compatible physical venue category. Pool membership grants discovery priority only, never traveler-intent, rarity, exposure, history or publication credit.";
  if (!searches.length) return { theme, ok: true, queried: false, returned: 0, directReturned: 0, typedSearchReturned: 0, geoReturned: 0, seeds: [], rule };

  try {
    const searchResponses = await Promise.all(searches.map(async (spec) => {
      try {
        const response = await fetchWithTimeout(searchUrl(spec.query));
        if (!response.ok) return { spec, rows: [] as SearchRow[] };
        const json = await response.json() as { search?: SearchRow[] };
        return { spec, rows: json.search ?? [] };
      } catch { return { spec, rows: [] as SearchRow[] }; }
    }));
    const metadata = new Map<string, { category: string; fallbackLabel?: string }>();
    for (const result of searchResponses) for (const row of result.rows) {
      if (!row.id || !/^Q\d+$/i.test(row.id)) continue;
      if (!metadata.has(row.id)) metadata.set(row.id, { category: result.spec.category, fallbackLabel: row.label });
    }
    const ids = [...metadata.keys()].slice(0, 40);
    const directSeeds: VenuePoolSeed[] = [];
    if (ids.length) {
      const entityResponse = await fetchWithTimeout(entitiesUrl(ids), 6000);
      if (entityResponse.ok) {
        const entityJson = await entityResponse.json() as { entities?: Record<string, EntityRow> };
        for (const qid of ids) {
          const entity = entityJson.entities?.[qid]; if (!entity) continue;
          const coords = coordinateFromClaims(entity.claims); if (!inParis(coords.lat, coords.lon)) continue;
          const meta = metadata.get(qid); const name = labelOf(entity, meta?.fallbackLabel); if (!name || /^Q\d+$/i.test(name)) continue;
          directSeeds.push({ id: `venue-pool:${qid}`, name, qid, lat: coords.lat, lon: coords.lon, officialUrl: officialUrlFromClaims(entity.claims), category: meta?.category ?? "physical venue" });
          if (directSeeds.length >= cap) break;
        }
      }
    }

    const typedSeeds = directSeeds.length >= cap ? [] : await collectTypedVenueSearch(theme, cap * 2);
    const geoSeeds = directSeeds.length + typedSeeds.length >= cap ? [] : await collectGeoSweep(theme, cap * 2);
    const merged: VenuePoolSeed[] = [];
    const seen = new Set<string>();
    for (const seed of [...directSeeds, ...typedSeeds, ...geoSeeds]) {
      if (seen.has(seed.qid)) continue;
      seen.add(seed.qid); merged.push(seed);
      if (merged.length >= cap) break;
    }
    return { theme, ok: true, queried: true, returned: merged.length, directReturned: directSeeds.length, typedSearchReturned: typedSeeds.length, geoReturned: geoSeeds.length, seeds: merged, rule };
  } catch (error) {
    return { theme, ok: false, queried: true, returned: 0, directReturned: 0, typedSearchReturned: 0, geoReturned: 0, seeds: [], error: error instanceof Error ? error.message : "venue_pool_failed", rule };
  }
}
