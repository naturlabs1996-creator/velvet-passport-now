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
  categoryReturned: number;
  seeds: VenuePoolSeed[];
  error?: string;
  rule: string;
};

const USER_AGENT = "VelvetPassportVenuePool/1.4 (Wikidata identity + structured Paris venue categories; discovery seeds only)";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const WIKIPEDIA_API = "https://fr.wikipedia.org/w/api.php";

const THEME_SPECS: Record<string, {
  direct: Array<{ query: string; category: string }>;
  categories: Array<{ title: string; category: string }>;
}> = {
  "paris-after-dark": {
    direct: [
      { query: "musée Paris", category: "museum" },
      { query: "théâtre Paris", category: "performing arts venue" },
      { query: "salle de spectacle Paris", category: "performing arts venue" },
    ],
    categories: [
      { title: "Catégorie:Musée à Paris", category: "museum" },
      { title: "Catégorie:Théâtre à Paris", category: "performing arts venue" },
      { title: "Catégorie:Salle de spectacle à Paris", category: "performing arts venue" },
    ],
  },
  "unusual-museums": {
    direct: [
      { query: "musée Paris", category: "museum" },
      { query: "maison musée Paris", category: "house museum" },
    ],
    categories: [
      { title: "Catégorie:Musée à Paris", category: "museum" },
      { title: "Catégorie:Maison de personnalité à Paris", category: "house museum" },
    ],
  },
  "beyond-the-classics": {
    direct: [
      { query: "musée Paris", category: "museum" },
      { query: "passage couvert Paris", category: "passage" },
      { query: "maison artiste Paris", category: "cultural venue" },
    ],
    categories: [
      { title: "Catégorie:Musée à Paris", category: "museum" },
      { title: "Catégorie:Passage couvert à Paris", category: "passage" },
    ],
  },
  "quiet-paris": {
    direct: [
      { query: "jardin Paris", category: "garden" },
      { query: "bibliothèque Paris", category: "library" },
      { query: "musée Paris", category: "museum" },
    ],
    categories: [
      { title: "Catégorie:Jardin à Paris", category: "garden" },
      { title: "Catégorie:Bibliothèque à Paris", category: "library" },
      { title: "Catégorie:Musée à Paris", category: "museum" },
    ],
  },
  "secret-gardens": {
    direct: [{ query: "jardin Paris", category: "garden" }],
    categories: [
      { title: "Catégorie:Jardin à Paris", category: "garden" },
      { title: "Catégorie:Square à Paris", category: "garden" },
    ],
  },
  "rainy-day-paris": {
    direct: [
      { query: "musée Paris", category: "museum" },
      { query: "passage couvert Paris", category: "covered passage" },
      { query: "bibliothèque Paris", category: "library" },
    ],
    categories: [
      { title: "Catégorie:Musée à Paris", category: "museum" },
      { title: "Catégorie:Passage couvert à Paris", category: "covered passage" },
      { title: "Catégorie:Bibliothèque à Paris", category: "library" },
    ],
  },
};

type SearchRow = { id?: string; label?: string };
type Claim = { mainsnak?: { datavalue?: { value?: unknown } } };
type Entity = { labels?: Record<string, { value?: string }>; claims?: Record<string, Claim[]> };
type CategoryMember = { pageid?: number; title?: string };
type WikiPage = {
  pageid?: number;
  title?: string;
  pageprops?: { wikibase_item?: string };
  coordinates?: Array<{ lat?: number; lon?: number }>;
};

async function fetchJson<T>(url: string, timeoutMs = 5500): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "application/json" },
      signal: controller.signal,
      next: { revalidate: 21600 },
    });
    if (!response.ok) throw new Error(`http_${response.status}`);
    return await response.json() as T;
  } finally {
    clearTimeout(timer);
  }
}

function wdSearchUrl(query: string) {
  const params = new URLSearchParams({
    action: "wbsearchentities", search: query, language: "fr", uselang: "fr",
    type: "item", limit: "12", format: "json", origin: "*",
  });
  return `${WIKIDATA_API}?${params}`;
}

function wdEntitiesUrl(ids: string[]) {
  const params = new URLSearchParams({
    action: "wbgetentities", ids: ids.join("|"), props: "claims|labels",
    languages: "fr|en", format: "json", origin: "*",
  });
  return `${WIKIDATA_API}?${params}`;
}

function categoryUrl(title: string) {
  const params = new URLSearchParams({
    action: "query", list: "categorymembers", cmtitle: title, cmnamespace: "0",
    cmlimit: "50", cmtype: "page", format: "json", origin: "*",
  });
  return `${WIKIPEDIA_API}?${params}`;
}

function pageDetailsUrl(ids: number[]) {
  const params = new URLSearchParams({
    action: "query", pageids: ids.join("|"), prop: "pageprops|coordinates",
    colimit: "1", format: "json", origin: "*",
  });
  return `${WIKIPEDIA_API}?${params}`;
}

function coordinateFromClaims(claims: Record<string, Claim[]> | undefined) {
  const value = claims?.P625?.[0]?.mainsnak?.datavalue?.value;
  if (!value || typeof value !== "object") return {};
  const row = value as { latitude?: unknown; longitude?: unknown };
  const lat = Number(row.latitude); const lon = Number(row.longitude);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : {};
}

function officialUrl(claims: Record<string, Claim[]> | undefined) {
  const value = claims?.P856?.[0]?.mainsnak?.datavalue?.value;
  return typeof value === "string" && /^https?:\/\//i.test(value) ? value : undefined;
}

function label(entity: Entity | undefined, fallback = "") {
  return entity?.labels?.fr?.value?.trim() || entity?.labels?.en?.value?.trim() || fallback.trim();
}

function inParis(lat: number | undefined, lon: number | undefined) {
  return typeof lat === "number" && typeof lon === "number" && lat >= 48.80 && lat <= 48.91 && lon >= 2.22 && lon <= 2.47;
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

async function directSeeds(spec: NonNullable<(typeof THEME_SPECS)[string]>, cap: number) {
  const searches = await Promise.all(spec.direct.map(async (entry) => {
    try {
      const json = await fetchJson<{ search?: SearchRow[] }>(wdSearchUrl(entry.query));
      return { entry, rows: json.search ?? [] };
    } catch { return { entry, rows: [] as SearchRow[] }; }
  }));
  const meta = new Map<string, { category: string; fallback: string }>();
  for (const search of searches) for (const row of search.rows) {
    if (row.id && /^Q\d+$/.test(row.id) && !meta.has(row.id)) meta.set(row.id, { category: search.entry.category, fallback: row.label ?? "" });
  }
  const ids = [...meta.keys()].slice(0, 40);
  if (!ids.length) return [] as VenuePoolSeed[];
  try {
    const json = await fetchJson<{ entities?: Record<string, Entity> }>(wdEntitiesUrl(ids), 6500);
    const seeds: VenuePoolSeed[] = [];
    for (const qid of ids) {
      const entity = json.entities?.[qid]; const coords = coordinateFromClaims(entity?.claims);
      if (!inParis(coords.lat, coords.lon)) continue;
      const info = meta.get(qid); const name = label(entity, info?.fallback);
      if (!name) continue;
      seeds.push({ id: `venue-direct:${qid}`, name, qid, lat: coords.lat, lon: coords.lon, officialUrl: officialUrl(entity?.claims), category: info?.category ?? "physical venue" });
      if (seeds.length >= cap) break;
    }
    return seeds;
  } catch { return [] as VenuePoolSeed[]; }
}

async function categorySeeds(spec: NonNullable<(typeof THEME_SPECS)[string]>, cap: number) {
  const categoryResults = await Promise.all(spec.categories.map(async (entry) => {
    try {
      const json = await fetchJson<{ query?: { categorymembers?: CategoryMember[] } }>(categoryUrl(entry.title));
      return { entry, rows: json.query?.categorymembers ?? [] };
    } catch { return { entry, rows: [] as CategoryMember[] }; }
  }));
  const categoryByPage = new Map<number, string>();
  const pageIds: number[] = [];
  for (const result of categoryResults) for (const row of result.rows) {
    if (typeof row.pageid !== "number") continue;
    if (!categoryByPage.has(row.pageid)) categoryByPage.set(row.pageid, result.entry.category);
    pageIds.push(row.pageid);
  }
  const pages: WikiPage[] = [];
  for (const batch of chunks([...new Set(pageIds)].slice(0, 150), 50)) {
    try {
      const json = await fetchJson<{ query?: { pages?: Record<string, WikiPage> } }>(pageDetailsUrl(batch));
      pages.push(...Object.values(json.query?.pages ?? {}));
    } catch {}
  }
  const seeds: VenuePoolSeed[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    const qid = page.pageprops?.wikibase_item; const coord = page.coordinates?.[0];
    if (!qid || !/^Q\d+$/.test(qid) || !inParis(coord?.lat, coord?.lon) || seen.has(qid)) continue;
    const name = page.title?.trim(); if (!name) continue;
    seen.add(qid);
    seeds.push({ id: `venue-category:${qid}`, name, qid, lat: coord?.lat, lon: coord?.lon, category: typeof page.pageid === "number" ? categoryByPage.get(page.pageid) ?? "physical venue" : "physical venue" });
    if (seeds.length >= cap) break;
  }

  // One batch against Wikidata adds official URLs without making those URLs claim evidence.
  const qids = seeds.map((seed) => seed.qid);
  if (qids.length) {
    try {
      const json = await fetchJson<{ entities?: Record<string, Entity> }>(wdEntitiesUrl(qids), 6500);
      for (const seed of seeds) seed.officialUrl = officialUrl(json.entities?.[seed.qid]?.claims);
    } catch {}
  }
  return seeds;
}

export async function collectWikidataVenuePool(theme: string, maxSeeds = 18): Promise<VenuePoolResult> {
  const spec = THEME_SPECS[theme];
  const cap = Math.max(1, Math.min(maxSeeds, 24));
  const rule = "Venue Pool V1.4 combines Wikidata identity search with structured French-Wikipedia Paris venue categories. Category membership is used only to discover concrete physical entities; QID plus coordinates inside the Paris bounding box are mandatory. No venue-pool seed receives intent, rarity, exposure, history or publication credit until downstream independent evidence verifies it.";
  if (!spec) return { theme, ok: true, queried: false, returned: 0, directReturned: 0, categoryReturned: 0, seeds: [], rule };
  try {
    const direct = await directSeeds(spec, cap);
    const categorized = await categorySeeds(spec, cap * 2);
    const merged: VenuePoolSeed[] = [];
    const seen = new Set<string>();
    for (const seed of [...categorized, ...direct]) {
      if (seen.has(seed.qid)) continue;
      seen.add(seed.qid); merged.push(seed);
      if (merged.length >= cap) break;
    }
    return { theme, ok: true, queried: true, returned: merged.length, directReturned: direct.length, categoryReturned: categorized.length, seeds: merged, rule };
  } catch (error) {
    return { theme, ok: false, queried: true, returned: 0, directReturned: 0, categoryReturned: 0, seeds: [], error: error instanceof Error ? error.message : "venue_pool_failed", rule };
  }
}
