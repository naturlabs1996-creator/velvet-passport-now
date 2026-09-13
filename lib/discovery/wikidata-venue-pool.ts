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

const USER_AGENT = "VelvetPassportVenuePool/2.7 (geosearch coordinate carry + Wikidata P625 category fallback + strict Paris identity)";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const WIKIPEDIA_API = "https://fr.wikipedia.org/w/api.php";
const PARIS_DATA = "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/lieux-municipaux/records";

type VenueSpec = {
  direct: Array<{ query: string; category: string }>;
  categories: Array<{ title: string; category: string }>;
  registryPatterns: Array<{ pattern: RegExp; category: string }>;
};

type SearchRow = { id?: string; label?: string };
type WikiSearchRow = { pageid?: number; title?: string };
type Claim = { mainsnak?: { datavalue?: { value?: unknown } } };
type Entity = { labels?: Record<string, { value?: string }>; claims?: Record<string, Claim[]> };
type CategoryMember = { pageid?: number; title?: string; ns?: number };
type WikiPage = { pageid?: number; title?: string; pageprops?: { wikibase_item?: string }; coordinates?: Array<{ lat?: number; lon?: number }>; categories?: Array<{ title?: string }> };
type RegistryRow = { id?: string | number; name?: string; categorie?: string; latitude?: number; longitude?: number; url?: string; };

const THEME_SPECS: Record<string, VenueSpec> = {
  "paris-after-dark": {
    direct: [
      { query: "musée Paris", category: "museum" },
      { query: "théâtre Paris", category: "performing arts venue" },
      { query: "salle de spectacle Paris", category: "performing arts venue" },
      { query: "visite nocturne patrimoine Paris", category: "heritage venue" },
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
      { query: "atelier d'artiste musée Paris", category: "artist studio" },
      { query: "collection spécialisée Paris musée", category: "specialist collection" },
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
      { query: "atelier Paris", category: "artist studio" },
      { query: "atelier d'artiste", category: "artist studio" },
      { query: "artisan Paris", category: "working workshop" },
      { query: "archives Paris", category: "archive" },
      { query: "bibliothèque Paris", category: "specialist library" },
      { query: "maison d'artiste", category: "artist house" },
      { query: "collection Paris", category: "private collection" },
      { query: "patrimoine Paris", category: "heritage association" },
      { query: "souterrain Paris", category: "heritage infrastructure" },
      { query: "aqueduc Paris", category: "heritage infrastructure" },
      { query: "réservoir Paris", category: "heritage infrastructure" },
      { query: "documentation Paris", category: "documentation center" },
      { query: "passage Paris", category: "passage" },
      { query: "fondation Paris", category: "cultural venue" },
    ],
    categories: [
      { title: "Catégorie:Musée à Paris", category: "museum" },
      { title: "Catégorie:Passage couvert à Paris", category: "passage" },
      { title: "Catégorie:Maison de personnalité à Paris", category: "artist house" },
      { title: "Catégorie:Bibliothèque à Paris", category: "library" },
      { title: "Catégorie:Monument historique à Paris", category: "heritage venue" },
      { title: "Catégorie:Patrimoine industriel à Paris", category: "heritage infrastructure" },
    ],
    registryPatterns: [
      { pattern: /maison[- ]atelier|maison d['’]artiste|atelier d['’]artiste|atelier[- ]mus[eé]e/i, category: "artist studio" },
      { pattern: /archives?|centre de documentation|documentation patrimoniale/i, category: "archive" },
      { pattern: /regard|r[eé]servoir|aqueduc|[eé]gout|souterrain|fontainier|infrastructure/i, category: "heritage infrastructure" },
      { pattern: /atelier|artisan/i, category: "workshop" },
      { pattern: /collection|cabinet de curiosit[eé]s/i, category: "specialist collection" },
      { pattern: /\bmus[eé]e?s?\b|museum/i, category: "museum" },
      { pattern: /fondation.*art|centre culturel|espace culturel|galerie d['’]art|lieu culturel/i, category: "cultural venue" },
      { pattern: /passage couvert|galerie couverte/i, category: "passage" },
      { pattern: /biblioth[eè]que/i, category: "library/archive" },
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
    const response = await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "application/json" }, signal: controller.signal, next: { revalidate: 21600 } });
    if (!response.ok) throw new Error(`http_${response.status}`);
    return await response.json() as T;
  } finally { clearTimeout(timer); }
}

async function fetchJsonDiagnostic<T>(url: string, timeoutMs = 5500): Promise<T> {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "application/json" }, signal: controller.signal, next: { revalidate: 21600 } });
    const text = await response.text();
    if (!response.ok) {
      console.info("[WikiPageDetailsFetchError]", JSON.stringify({ status: response.status, statusText: response.statusText, url: url.slice(0, 280), body: text.slice(0, 500) }));
      throw new Error(`http_${response.status}`);
    }
    const parsed = JSON.parse(text) as T;
    const apiError = (parsed as unknown as { error?: unknown }).error;
    if (apiError) console.info("[WikiPageDetailsApiError]", JSON.stringify({ url: url.slice(0, 280), error: apiError }));
    return parsed;
  } finally { clearTimeout(timer); }
}

function normalize(value: string) { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim(); }
function inParis(lat?: number, lon?: number) { return typeof lat === "number" && typeof lon === "number" && lat >= 48.80 && lat <= 48.91 && lon >= 2.22 && lon <= 2.47; }
function chunks<T>(items: T[], size: number) { const out: T[][] = []; for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size)); return out; }
function wdSearchUrl(query: string, limit = 8) { const params = new URLSearchParams({ action: "wbsearchentities", search: query, language: "fr", uselang: "fr", type: "item", limit: String(limit), format: "json", origin: "*" }); return `${WIKIDATA_API}?${params}`; }
function wdTextSearchUrl(query: string, limit = 24) { const params = new URLSearchParams({ action: "query", list: "search", srsearch: query, srnamespace: "0", srlimit: String(limit), format: "json", origin: "*" }); return `${WIKIDATA_API}?${params}`; }
function wdEntitiesUrl(ids: string[]) { const params = new URLSearchParams({ action: "wbgetentities", ids: ids.join("|"), props: "claims|labels", languages: "fr|en", format: "json", origin: "*" }); return `${WIKIDATA_API}?${params}`; }
function categoryUrl(title: string, includeSubcats = false) { const params = new URLSearchParams({ action: "query", list: "categorymembers", cmtitle: title, cmnamespace: includeSubcats ? "0|14" : "0", cmlimit: "100", cmtype: includeSubcats ? "page|subcat" : "page", format: "json", origin: "*" }); return `${WIKIPEDIA_API}?${params}`; }
function wikiSearchUrl(query: string, limit = 12) { const params = new URLSearchParams({ action: "query", list: "search", srsearch: query, srnamespace: "0", srlimit: String(limit), format: "json", origin: "*" }); return `${WIKIPEDIA_API}?${params}`; }
function pageDetailsUrl(ids: number[]) { const params = new URLSearchParams({ action: "query", pageids: ids.join("|"), prop: "pageprops|coordinates|categories", colimit: "1", cllimit: "50", format: "json", origin: "*" }); return `${WIKIPEDIA_API}?${params}`; }
function geoSearchUrl(lat: number, lon: number, radius = 5000, limit = 100) { const params = new URLSearchParams({ action: "query", list: "geosearch", gscoord: `${lat}|${lon}`, gsradius: String(radius), gslimit: String(limit), gsnamespace: "0", format: "json", origin: "*" }); return `${WIKIPEDIA_API}?${params}`; }
function parisDataUrl(offset: number) { const params = new URLSearchParams({ limit: "100", offset: String(offset) }); return `${PARIS_DATA}?${params}`; }

function coordinateFromClaims(claims: Record<string, Claim[]> | undefined) {
  const value = claims?.P625?.[0]?.mainsnak?.datavalue?.value;
  if (!value || typeof value !== "object") return {};
  const row = value as { latitude?: unknown; longitude?: unknown };
  const lat = Number(row.latitude); const lon = Number(row.longitude);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : {};
}
function officialUrl(claims: Record<string, Claim[]> | undefined) { const value = claims?.P856?.[0]?.mainsnak?.datavalue?.value; return typeof value === "string" && /^https?:\/\//i.test(value) ? value : undefined; }
function label(entity: Entity | undefined, fallback = "") { return entity?.labels?.fr?.value?.trim() || entity?.labels?.en?.value?.trim() || fallback.trim(); }
const GEO_CATEGORY_PATTERNS: Array<{ category: string; pattern: RegExp }> = [
  { category: "artist studio", pattern: /atelier d.artiste|maison[- ]atelier|atelier[- ]mus[eé]e|artist studio/i },
  { category: "working workshop", pattern: /atelier|artisan|manufacture|workshop/i },
  { category: "archive", pattern: /archives?|centre de documentation|documentation/i },
  { category: "specialist library", pattern: /biblioth[eè]que|library/i },
  { category: "artist house", pattern: /maison d.(?:artiste|[eé]crivain|personnalit[eé])|house museum/i },
  { category: "private collection", pattern: /collection|cabinet de curiosit[eé]s/i },
  { category: "heritage association", pattern: /association|soci[eé]t[eé].*patrimoine|heritage society/i },
  { category: "heritage infrastructure", pattern: /aqueduc|r[eé]servoir|regard|[eé]gout|souterrain|canalisation|infrastructure|station.*pompage/i },
  { category: "passage", pattern: /passage couvert|galerie couverte|passage/i },
  { category: "cultural venue", pattern: /fondation|centre culturel|lieu culturel|galerie d.art/i },
  { category: "museum", pattern: /\bmus[eé]e\b|museum/i },
];
function classifyWikiVenue(page: WikiPage) {
  const categoryText = (page.categories ?? []).map((item) => item.title ?? "").join(" | ");
  const text = (page.title ?? "") + " | " + categoryText;
  return GEO_CATEGORY_PATTERNS.find((item) => item.pattern.test(text))?.category;
}
function institutionallyExcludedName(name: string) {
  return /école|ecole|crèche|creche|collège|college|lycée|lycee|maternelle|élémentaire|elementaire|centre de loisirs|halte-garderie/i.test(name);
}
function registryCategory(spec: VenueSpec, row: RegistryRow) {
  const officialCategory = row.categorie?.trim() ?? "";
  const name = row.name?.trim() ?? "";
  const exclusionText = `${officialCategory} ${name}`;
  if (/école|ecole|crèche|creche|collège|college|lycée|lycee|maternelle|élémentaire|elementaire|centre de loisirs|halte-garderie/i.test(exclusionText)) return undefined;
  const combined = `${officialCategory} ${name}`.trim();
  if (!combined) return undefined;
  return spec.registryPatterns.find((item) => item.pattern.test(combined))?.category;
}

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const toRad = (value: number) => value * Math.PI / 180; const earth = 6371; const dLat = toRad(bLat - aLat); const dLon = toRad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * earth * Math.asin(Math.sqrt(h));
}
function nameOverlap(a: string, b: string) {
  const stop = new Set(["de", "du", "des", "la", "le", "les", "a", "au", "aux", "paris", "ville"]);
  const left = new Set(normalize(a).split(" ").filter((token) => token.length >= 4 && !stop.has(token)));
  const right = new Set(normalize(b).split(" ").filter((token) => token.length >= 4 && !stop.has(token)));
  if (!left.size || !right.size) return 0;
  return [...left].filter((token) => right.has(token)).length / Math.max(1, Math.min(left.size, right.size));
}

async function parisDataSeeds(spec: VenueSpec, cap: number) {
  const byCategory = new Map<string, VenuePoolSeed[]>(); const seen = new Set<string>(); const offsets = Array.from({ length: 37 }, (_, index) => index * 100);
  for (const batch of chunks(offsets, 5)) {
    const pages = await Promise.all(batch.map(async (offset) => { try { const json = await fetchJson<{ results?: RegistryRow[] }>(parisDataUrl(offset), 6500); return json.results ?? []; } catch { return [] as RegistryRow[]; } }));
    for (const row of pages.flat()) {
      const name = row.name?.trim(); const category = registryCategory(spec, row); const lat = Number(row.latitude); const lon = Number(row.longitude);
      if (!name || !category || !Number.isFinite(lat) || !Number.isFinite(lon) || !inParis(lat, lon) || !row.url?.startsWith("https://www.paris.fr/lieux/")) continue;
      const key = normalize(name); if (!key || seen.has(key)) continue; seen.add(key);
      const list = byCategory.get(category) ?? [];
      list.push({ id: `venue-paris-data:${row.id ?? key}`, name, lat, lon, officialUrl: row.url, category, source: "PARIS_DATA" });
      byCategory.set(category, list);
    }
  }
  return uniqueSeeds([...byCategory.values()], cap);
}

async function enrichOfficialSeeds(seeds: VenuePoolSeed[]) {
  const searches = await Promise.all(seeds.map(async (seed) => { try { const json = await fetchJson<{ search?: SearchRow[] }>(wdSearchUrl(`${seed.name} Paris`, 5), 5000); return { seed, rows: json.search ?? [] }; } catch { return { seed, rows: [] as SearchRow[] }; } }));
  const allIds = [...new Set(searches.flatMap((item) => item.rows.map((row) => row.id).filter((id): id is string => Boolean(id && /^Q\d+$/.test(id)))))].slice(0, 80);
  if (!allIds.length) return seeds;
  const entities: Record<string, Entity> = {};
  for (const batch of chunks(allIds, 40)) { try { const json = await fetchJson<{ entities?: Record<string, Entity> }>(wdEntitiesUrl(batch), 6500); Object.assign(entities, json.entities ?? {}); } catch {} }
  return searches.map(({ seed, rows }) => {
    if (typeof seed.lat !== "number" || typeof seed.lon !== "number") return seed;
    let best: { qid: string; score: number; url?: string } | undefined;
    for (const row of rows) {
      if (!row.id || !/^Q\d+$/.test(row.id)) continue;
      const entity = entities[row.id]; const coords = coordinateFromClaims(entity?.claims);
      if (!inParis(coords.lat, coords.lon) || typeof coords.lat !== "number" || typeof coords.lon !== "number") continue;
      const km = distanceKm(seed.lat, seed.lon, coords.lat, coords.lon); if (km > 1.5) continue;
      const overlap = nameOverlap(seed.name, label(entity, row.label ?? "")); if (overlap < 0.34) continue;
      const score = overlap * 100 - km * 8; if (!best || score > best.score) best = { qid: row.id, score, url: officialUrl(entity?.claims) };
    }
    return best ? { ...seed, qid: best.qid, officialUrl: seed.officialUrl ?? best.url } : seed;
  });
}

async function directSeeds(spec: VenueSpec, cap: number) {
  void spec;
  const centers = [
    { lat: 48.8566, lon: 2.3522 },
    { lat: 48.8867, lon: 2.3431 },
    { lat: 48.8867, lon: 2.3900 },
    { lat: 48.8280, lon: 2.3180 },
    { lat: 48.8280, lon: 2.3950 },
  ];
  const geoRows: Array<{ pageid?: number; lat?: number; lon?: number }> = [];
  for (const center of centers) {
    try {
      const json = await fetchJson<{ query?: { geosearch?: Array<{ pageid?: number; lat?: number; lon?: number }> } }>(geoSearchUrl(center.lat, center.lon, 5200, 100), 5500);
      geoRows.push(...(json.query?.geosearch ?? []));
    } catch {}
  }
  const geoByPage = new Map<number, { lat?: number; lon?: number }>();
  for (const row of geoRows) if (typeof row.pageid === "number" && !geoByPage.has(row.pageid)) geoByPage.set(row.pageid, { lat: row.lat, lon: row.lon });
  const ids = [...new Set(geoRows.map((row) => row.pageid).filter((id): id is number => typeof id === "number"))].slice(0, 420);
  if (!ids.length) return [] as VenuePoolSeed[];
  const pages: WikiPage[] = [];
  for (const batch of chunks(ids, 32)) {
    try {
      const json = await fetchJsonDiagnostic<{ query?: { pages?: Record<string, WikiPage> }; error?: unknown }>(pageDetailsUrl(batch), 6500);
      pages.push(...Object.values(json.query?.pages ?? {}));
    } catch {}
  }
  const byCategory = new Map<string, VenuePoolSeed[]>();
  let qidCount = 0; let classifiedCount = 0; let parisCount = 0;
  for (const page of pages) {
    const qid = page.pageprops?.wikibase_item;
    if (qid && /^Q\d+$/.test(qid)) qidCount += 1;
    const primary = page.coordinates?.[0];
    const fallback = typeof page.pageid === "number" ? geoByPage.get(page.pageid) : undefined;
    const lat = primary?.lat ?? fallback?.lat;
    const lon = primary?.lon ?? fallback?.lon;
    const category = classifyWikiVenue(page);
    if (category) classifiedCount += 1;
    if (inParis(lat, lon)) parisCount += 1;
    if (!page.title || institutionallyExcludedName(page.title) || !qid || !/^Q\d+$/.test(qid) || !category || !inParis(lat, lon)) continue;
    const list = byCategory.get(category) ?? [];
    list.push({ id: "venue-direct:" + qid, name: page.title.trim(), qid, lat, lon, category, source: "WIKIPEDIA" });
    byCategory.set(category, list);
  }
  console.info("[WikiVenueDirectDiagnostic]", JSON.stringify({ geoRows: geoRows.length, ids: ids.length, pages: pages.length, qidCount, classifiedCount, parisCount, categories: [...byCategory.entries()].map(([category, rows]) => ({ category, count: rows.length })) }));
  return uniqueSeeds([...byCategory.values()], cap);
}

async function categorySeeds(spec: VenueSpec, cap: number) {
  const roots = await Promise.all(spec.categories.map(async (entry) => {
    try {
      const json = await fetchJson<{ query?: { categorymembers?: CategoryMember[] } }>(categoryUrl(entry.title, true), 5500);
      return { entry, rows: json.query?.categorymembers ?? [] };
    } catch { return { entry, rows: [] as CategoryMember[] }; }
  }));
  const expanded: Array<{ category: string; rows: CategoryMember[] }> = [];
  for (const result of roots) {
    expanded.push({ category: result.entry.category, rows: result.rows.filter((row) => row.ns !== 14) });
    const subcats = result.rows.filter((row) => row.ns === 14 && row.title?.startsWith("Catégorie:")).slice(0, 8);
    for (const subcat of subcats) {
      try {
        const json = await fetchJson<{ query?: { categorymembers?: CategoryMember[] } }>(categoryUrl(subcat.title!, false), 5000);
        expanded.push({ category: result.entry.category, rows: json.query?.categorymembers ?? [] });
      } catch {}
    }
  }
  const categoryByPage = new Map<number, string>();
  const ids: number[] = [];
  for (const result of expanded) for (const row of result.rows) if (typeof row.pageid === "number" && row.ns !== 14) {
    if (!categoryByPage.has(row.pageid)) categoryByPage.set(row.pageid, result.category);
    ids.push(row.pageid);
  }
  const pages: WikiPage[] = [];
  for (const batch of chunks([...new Set(ids)].slice(0, 320), 40)) {
    try {
      const json = await fetchJsonDiagnostic<{ query?: { pages?: Record<string, WikiPage> }; error?: unknown }>(pageDetailsUrl(batch), 6000);
      pages.push(...Object.values(json.query?.pages ?? {}));
    } catch {}
  }
  const qids = [...new Set(pages.map((page) => page.pageprops?.wikibase_item).filter((qid): qid is string => Boolean(qid && /^Q\d+$/.test(qid))))];
  const entities: Record<string, Entity> = {};
  for (const batch of chunks(qids, 24)) {
    try {
      const json = await fetchJson<{ entities?: Record<string, Entity> }>(wdEntitiesUrl(batch), 6500);
      Object.assign(entities, json.entities ?? {});
    } catch {}
  }
  const byCategory = new Map<string, VenuePoolSeed[]>();
  let categoryQidCount = 0; let categoryParisCount = 0;
  for (const page of pages) {
    const qid = page.pageprops?.wikibase_item;
    if (qid && /^Q\d+$/.test(qid)) categoryQidCount += 1;
    const categoryName = typeof page.pageid === "number" ? categoryByPage.get(page.pageid) : undefined;
    if (!page.title || institutionallyExcludedName(page.title) || !qid || !/^Q\d+$/.test(qid) || !categoryName) continue;
    const primary = page.coordinates?.[0];
    const wdCoord = coordinateFromClaims(entities[qid]?.claims);
    const lat = primary?.lat ?? wdCoord.lat;
    const lon = primary?.lon ?? wdCoord.lon;
    if (inParis(lat, lon)) categoryParisCount += 1;
    if (!inParis(lat, lon)) continue;
    const list = byCategory.get(categoryName) ?? [];
    list.push({ id: "venue-category:" + qid, name: page.title.trim(), qid, lat, lon, category: categoryName, source: "WIKIPEDIA" });
    byCategory.set(categoryName, list);
  }
  console.info("[WikiVenueCategoryDiagnostic]", JSON.stringify({ roots: roots.map((root) => ({ title: root.entry.title, rows: root.rows.length })), expandedGroups: expanded.length, pageIds: ids.length, pages: pages.length, qids: qids.length, categoryQidCount, categoryParisCount, categories: [...byCategory.entries()].map(([category, rows]) => ({ category, count: rows.length })) }));
  return uniqueSeeds([...byCategory.values()], cap);
}

function uniqueSeeds(groups: VenuePoolSeed[][], cap: number) {
  const merged: VenuePoolSeed[] = []; const seen = new Set<string>();
  let index = 0;
  while (merged.length < cap && groups.some((group) => index < group.length)) {
    for (const group of groups) {
      const seed = group[index]; if (!seed) continue;
      const key = `${normalize(seed.name)}|${seed.lat ?? ""}|${seed.lon ?? ""}`;
      if (seen.has(key)) continue; seen.add(key); merged.push(seed); if (merged.length >= cap) break;
    }
    index += 1;
  }
  return merged;
}

export async function collectWikidataVenuePool(theme: string, maxSeeds = 18): Promise<VenuePoolResult> {
  const spec = THEME_SPECS[theme]; const cap = Math.max(1, Math.min(maxSeeds, 24));
  const rule = "Venue Pool V2.5 uses category-balanced bounded discovery budgets. City of Paris registry remains name-aware and institutionally filtered. Direct Wikidata discovery uses wbsearchentities with short entity-oriented queries, then requires Paris coordinates before admission. French Wikipedia category discovery traverses bounded first-level subcategories and revalidates coordinates plus Wikidata identity. All wiki membership remains discovery-only and grants no Intent, Exposure, Access, Trust or LOCK credit.";
  if (!spec) return { theme, ok: true, queried: false, returned: 0, officialReturned: 0, directReturned: 0, categoryReturned: 0, seeds: [], rule };
  try {
    // Reserve enough room for alternate discovery families before any one source can fill the pool.
    const officialCap = Math.max(4, Math.ceil(cap * 0.35));
    const directCap = Math.max(5, Math.ceil(cap * 0.45));
    const categoryCap = Math.max(3, cap - Math.min(cap, officialCap) - Math.min(cap, directCap));
    const [strictOfficial, direct, categorized] = await Promise.all([
      parisDataSeeds(spec, officialCap),
      directSeeds(spec, directCap),
      categorySeeds(spec, Math.max(3, categoryCap)),
    ]);
    const official = await enrichOfficialSeeds(strictOfficial);
    const merged = uniqueSeeds([official, direct, categorized], cap);
    return { theme, ok: true, queried: true, returned: merged.length, officialReturned: official.length, directReturned: direct.length, categoryReturned: categorized.length, seeds: merged, rule };
  } catch (error) {
    return { theme, ok: false, queried: true, returned: 0, officialReturned: 0, directReturned: 0, categoryReturned: 0, seeds: [], error: error instanceof Error ? error.message : "venue_pool_failed", rule };
  }
}
