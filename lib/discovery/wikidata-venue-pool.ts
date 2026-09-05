export type VenuePoolSeed = {
  id: string;
  name: string;
  qid?: string;
  lat?: number;
  lon?: number;
  officialUrl?: string;
  category: string;
  source: "PARIS_DATA" | "WIKIDATA" | "WIKIPEDIA";
};

export type VenuePoolResult = {
  theme: string;
  ok: boolean;
  queried: boolean;
  returned: number;
  officialReturned: number;
  directReturned: number;
  categoryReturned: number;
  seeds: VenuePoolSeed[];
  error?: string;
  rule: string;
};

const USER_AGENT = "VelvetPassportVenuePool/1.8 (strict Paris Data category gate + optional Wikidata identity enrichment)";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const WIKIPEDIA_API = "https://fr.wikipedia.org/w/api.php";
const PARIS_DATA = "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/lieux-municipaux/records";

type VenueSpec = {
  direct: Array<{ query: string; category: string }>;
  categories: Array<{ title: string; category: string }>;
  registryPatterns: Array<{ pattern: RegExp; category: string }>;
};

type SearchRow = { id?: string; label?: string };
type Claim = { mainsnak?: { datavalue?: { value?: unknown } } };
type Entity = { labels?: Record<string, { value?: string }>; claims?: Record<string, Claim[]> };
type CategoryMember = { pageid?: number; title?: string };
type WikiPage = { pageid?: number; title?: string; pageprops?: { wikibase_item?: string }; coordinates?: Array<{ lat?: number; lon?: number }> };
type RegistryRow = {
  id?: string | number;
  name?: string;
  categorie?: string;
  latitude?: number;
  longitude?: number;
  url?: string;
};

const THEME_SPECS: Record<string, VenueSpec> = {
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
    registryPatterns: [
      { pattern: /\bmus[eé]e?s?\b|museum/i, category: "museum" },
      { pattern: /th[eé][aâ]tre|spectacle|concert|auditorium|op[eé]ra/i, category: "performing arts venue" },
      { pattern: /centre culturel|espace culturel|galerie d['’]art|lieu culturel/i, category: "cultural venue" },
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
    registryPatterns: [
      { pattern: /\bmus[eé]e?s?\b|museum/i, category: "museum" },
      { pattern: /maison[- ]mus[eé]e|atelier[- ]mus[eé]e/i, category: "house museum" },
    ],
  },
  "beyond-the-classics": {
    direct: [
      { query: "musée Paris", category: "museum" },
      { query: "passage couvert Paris", category: "passage" },
      { query: "fondation art Paris", category: "cultural venue" },
    ],
    categories: [
      { title: "Catégorie:Musée à Paris", category: "museum" },
      { title: "Catégorie:Passage couvert à Paris", category: "passage" },
    ],
    registryPatterns: [
      { pattern: /\bmus[eé]e?s?\b|museum/i, category: "museum" },
      { pattern: /fondation.*art|centre culturel|espace culturel|galerie d['’]art|lieu culturel/i, category: "cultural venue" },
      { pattern: /passage couvert|galerie couverte/i, category: "passage" },
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
    registryPatterns: [
      { pattern: /jardin|parc|square/i, category: "garden" },
      { pattern: /biblioth[eè]que|m[eé]diath[eè]que/i, category: "library" },
      { pattern: /\bmus[eé]e?s?\b|museum/i, category: "museum" },
    ],
  },
  "secret-gardens": {
    direct: [{ query: "jardin Paris", category: "garden" }],
    categories: [
      { title: "Catégorie:Jardin à Paris", category: "garden" },
      { title: "Catégorie:Square à Paris", category: "garden" },
    ],
    registryPatterns: [{ pattern: /jardin|parc|square/i, category: "garden" }],
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
    registryPatterns: [
      { pattern: /\bmus[eé]e?s?\b|museum/i, category: "museum" },
      { pattern: /biblioth[eè]que|m[eé]diath[eè]que/i, category: "library" },
      { pattern: /passage couvert|galerie couverte/i, category: "covered passage" },
    ],
  },
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

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function inParis(lat?: number, lon?: number) {
  return typeof lat === "number" && typeof lon === "number" && lat >= 48.80 && lat <= 48.91 && lon >= 2.22 && lon <= 2.47;
}

function chunks<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function wdSearchUrl(query: string, limit = 8) {
  const params = new URLSearchParams({ action: "wbsearchentities", search: query, language: "fr", uselang: "fr", type: "item", limit: String(limit), format: "json", origin: "*" });
  return `${WIKIDATA_API}?${params}`;
}

function wdEntitiesUrl(ids: string[]) {
  const params = new URLSearchParams({ action: "wbgetentities", ids: ids.join("|"), props: "claims|labels", languages: "fr|en", format: "json", origin: "*" });
  return `${WIKIDATA_API}?${params}`;
}

function categoryUrl(title: string) {
  const params = new URLSearchParams({ action: "query", list: "categorymembers", cmtitle: title, cmnamespace: "0", cmlimit: "100", cmtype: "page", format: "json", origin: "*" });
  return `${WIKIPEDIA_API}?${params}`;
}

function pageDetailsUrl(ids: number[]) {
  const params = new URLSearchParams({ action: "query", pageids: ids.join("|"), prop: "pageprops|coordinates", colimit: "1", format: "json", origin: "*" });
  return `${WIKIPEDIA_API}?${params}`;
}

function parisDataUrl(offset: number) {
  const params = new URLSearchParams({ limit: "100", offset: String(offset) });
  return `${PARIS_DATA}?${params}`;
}

function coordinateFromClaims(claims: Record<string, Claim[]> | undefined) {
  const value = claims?.P625?.[0]?.mainsnak?.datavalue?.value;
  if (!value || typeof value !== "object") return {};
  const row = value as { latitude?: unknown; longitude?: unknown };
  const lat = Number(row.latitude);
  const lon = Number(row.longitude);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : {};
}

function officialUrl(claims: Record<string, Claim[]> | undefined) {
  const value = claims?.P856?.[0]?.mainsnak?.datavalue?.value;
  return typeof value === "string" && /^https?:\/\//i.test(value) ? value : undefined;
}

function label(entity: Entity | undefined, fallback = "") {
  return entity?.labels?.fr?.value?.trim() || entity?.labels?.en?.value?.trim() || fallback.trim();
}

function registryCategory(spec: VenueSpec, row: RegistryRow) {
  const officialCategory = row.categorie?.trim() ?? "";
  if (!officialCategory) return undefined;
  return spec.registryPatterns.find((item) => item.pattern.test(officialCategory))?.category;
}

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const toRad = (value: number) => value * Math.PI / 180;
  const earth = 6371;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * earth * Math.asin(Math.sqrt(h));
}

function nameOverlap(a: string, b: string) {
  const stop = new Set(["de", "du", "des", "la", "le", "les", "a", "au", "aux", "paris", "ville"]);
  const left = new Set(normalize(a).split(" ").filter((token) => token.length >= 4 && !stop.has(token)));
  const right = new Set(normalize(b).split(" ").filter((token) => token.length >= 4 && !stop.has(token)));
  if (!left.size || !right.size) return 0;
  const shared = [...left].filter((token) => right.has(token)).length;
  return shared / Math.max(1, Math.min(left.size, right.size));
}

async function parisDataSeeds(spec: VenueSpec, cap: number) {
  const seeds: VenuePoolSeed[] = [];
  const seen = new Set<string>();
  const offsets = Array.from({ length: 37 }, (_, index) => index * 100);

  for (const batch of chunks(offsets, 5)) {
    const pages = await Promise.all(batch.map(async (offset) => {
      try {
        const json = await fetchJson<{ results?: RegistryRow[] }>(parisDataUrl(offset), 6500);
        return json.results ?? [];
      } catch {
        return [] as RegistryRow[];
      }
    }));

    for (const row of pages.flat()) {
      const name = row.name?.trim();
      const category = registryCategory(spec, row);
      const lat = Number(row.latitude);
      const lon = Number(row.longitude);
      if (!name || !category || !Number.isFinite(lat) || !Number.isFinite(lon) || !inParis(lat, lon) || !row.url?.startsWith("https://www.paris.fr/lieux/")) continue;
      const key = normalize(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      seeds.push({ id: `venue-paris-data:${row.id ?? key}`, name, lat, lon, officialUrl: row.url, category, source: "PARIS_DATA" });
      if (seeds.length >= cap) return seeds;
    }
  }
  return seeds;
}

async function enrichOfficialSeeds(seeds: VenuePoolSeed[]) {
  const searches = await Promise.all(seeds.map(async (seed) => {
    try {
      const json = await fetchJson<{ search?: SearchRow[] }>(wdSearchUrl(`${seed.name} Paris`, 5), 5000);
      return { seed, rows: json.search ?? [] };
    } catch {
      return { seed, rows: [] as SearchRow[] };
    }
  }));

  const allIds = [...new Set(searches.flatMap((item) => item.rows.map((row) => row.id).filter((id): id is string => Boolean(id && /^Q\d+$/.test(id)))))]
    .slice(0, 80);
  if (!allIds.length) return seeds;

  const entities: Record<string, Entity> = {};
  for (const batch of chunks(allIds, 40)) {
    try {
      const json = await fetchJson<{ entities?: Record<string, Entity> }>(wdEntitiesUrl(batch), 6500);
      Object.assign(entities, json.entities ?? {});
    } catch {}
  }

  return searches.map(({ seed, rows }) => {
    if (typeof seed.lat !== "number" || typeof seed.lon !== "number") return seed;
    let best: { qid: string; score: number; url?: string } | undefined;
    for (const row of rows) {
      if (!row.id || !/^Q\d+$/.test(row.id)) continue;
      const entity = entities[row.id];
      const coords = coordinateFromClaims(entity?.claims);
      if (!inParis(coords.lat, coords.lon) || typeof coords.lat !== "number" || typeof coords.lon !== "number") continue;
      const km = distanceKm(seed.lat, seed.lon, coords.lat, coords.lon);
      if (km > 1.5) continue;
      const overlap = nameOverlap(seed.name, label(entity, row.label ?? ""));
      if (overlap < 0.34) continue;
      const score = overlap * 100 - km * 8;
      if (!best || score > best.score) best = { qid: row.id, score, url: officialUrl(entity?.claims) };
    }
    return best ? { ...seed, qid: best.qid, officialUrl: seed.officialUrl ?? best.url } : seed;
  });
}

async function directSeeds(spec: VenueSpec, cap: number) {
  const searches = await Promise.all(spec.direct.map(async (entry) => {
    try {
      const json = await fetchJson<{ search?: SearchRow[] }>(wdSearchUrl(entry.query, 12));
      return { entry, rows: json.search ?? [] };
    } catch {
      return { entry, rows: [] as SearchRow[] };
    }
  }));

  const meta = new Map<string, { category: string; fallback: string }>();
  for (const search of searches) {
    for (const row of search.rows) {
      if (row.id && /^Q\d+$/.test(row.id) && !meta.has(row.id)) meta.set(row.id, { category: search.entry.category, fallback: row.label ?? "" });
    }
  }

  const ids = [...meta.keys()].slice(0, 40);
  if (!ids.length) return [] as VenuePoolSeed[];
  try {
    const json = await fetchJson<{ entities?: Record<string, Entity> }>(wdEntitiesUrl(ids), 6500);
    const seeds: VenuePoolSeed[] = [];
    for (const qid of ids) {
      const entity = json.entities?.[qid];
      const coords = coordinateFromClaims(entity?.claims);
      if (!inParis(coords.lat, coords.lon)) continue;
      const info = meta.get(qid);
      const name = label(entity, info?.fallback);
      if (!name) continue;
      seeds.push({ id: `venue-direct:${qid}`, name, qid, lat: coords.lat, lon: coords.lon, officialUrl: officialUrl(entity?.claims), category: info?.category ?? "physical venue", source: "WIKIDATA" });
      if (seeds.length >= cap) break;
    }
    return seeds;
  } catch {
    return [] as VenuePoolSeed[];
  }
}

async function categorySeeds(spec: VenueSpec, cap: number) {
  const roots = await Promise.all(spec.categories.map(async (entry) => {
    try {
      const json = await fetchJson<{ query?: { categorymembers?: CategoryMember[] } }>(categoryUrl(entry.title));
      return { entry, rows: json.query?.categorymembers ?? [] };
    } catch {
      return { entry, rows: [] as CategoryMember[] };
    }
  }));

  const categoryByPage = new Map<number, string>();
  const ids: number[] = [];
  for (const result of roots) {
    for (const row of result.rows) {
      if (typeof row.pageid === "number") {
        categoryByPage.set(row.pageid, result.entry.category);
        ids.push(row.pageid);
      }
    }
  }

  const pages: WikiPage[] = [];
  for (const batch of chunks([...new Set(ids)].slice(0, 200), 50)) {
    try {
      const json = await fetchJson<{ query?: { pages?: Record<string, WikiPage> } }>(pageDetailsUrl(batch));
      pages.push(...Object.values(json.query?.pages ?? {}));
    } catch {}
  }

  const seeds: VenuePoolSeed[] = [];
  for (const page of pages) {
    const qid = page.pageprops?.wikibase_item;
    const coord = page.coordinates?.[0];
    if (!qid || !/^Q\d+$/.test(qid) || !inParis(coord?.lat, coord?.lon) || !page.title) continue;
    seeds.push({ id: `venue-category:${qid}`, name: page.title.trim(), qid, lat: coord?.lat, lon: coord?.lon, category: typeof page.pageid === "number" ? categoryByPage.get(page.pageid) ?? "physical venue" : "physical venue", source: "WIKIPEDIA" });
    if (seeds.length >= cap) break;
  }
  return seeds;
}

export async function collectWikidataVenuePool(theme: string, maxSeeds = 18): Promise<VenuePoolResult> {
  const spec = THEME_SPECS[theme];
  const cap = Math.max(1, Math.min(maxSeeds, 24));
  const rule = "Venue Pool V1.8 accepts City of Paris registry rows only when the official categorie field itself matches a permitted physical venue type; the venue name never influences category classification. Qualified Paris Data rows may be identity-enriched with a nearby name-matched Wikidata QID, but enrichment is optional and never changes traveler-intent, rarity, exposure, history or publication status.";
  if (!spec) return { theme, ok: true, queried: false, returned: 0, officialReturned: 0, directReturned: 0, categoryReturned: 0, seeds: [], rule };

  try {
    const strictOfficial = await parisDataSeeds(spec, cap);
    const official = await enrichOfficialSeeds(strictOfficial);
    const direct = official.length >= cap ? [] : await directSeeds(spec, cap - official.length);
    const categorized = official.length + direct.length >= cap ? [] : await categorySeeds(spec, cap - official.length - direct.length);
    const merged: VenuePoolSeed[] = [];
    const seen = new Set<string>();
    for (const seed of [...official, ...direct, ...categorized]) {
      const key = `${normalize(seed.name)}|${seed.lat ?? ""}|${seed.lon ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(seed);
      if (merged.length >= cap) break;
    }
    return { theme, ok: true, queried: true, returned: merged.length, officialReturned: official.length, directReturned: direct.length, categoryReturned: categorized.length, seeds: merged, rule };
  } catch (error) {
    return { theme, ok: false, queried: true, returned: 0, officialReturned: 0, directReturned: 0, categoryReturned: 0, seeds: [], error: error instanceof Error ? error.message : "venue_pool_failed", rule };
  }
}
