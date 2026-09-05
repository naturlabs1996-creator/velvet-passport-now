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

const USER_AGENT = "VelvetPassportVenuePool/1.0 (Wikidata physical entities; discovery seeds only; cached public data)";

const THEME_CLASSES: Record<string, Array<{ qid: string; category: string }>> = {
  "paris-after-dark": [
    { qid: "Q33506", category: "museum" },
    { qid: "Q207694", category: "art museum" },
    { qid: "Q57660343", category: "performing arts venue" },
  ],
  "unusual-museums": [
    { qid: "Q33506", category: "museum" },
    { qid: "Q207694", category: "art museum" },
  ],
  "beyond-the-classics": [
    { qid: "Q33506", category: "museum" },
    { qid: "Q207694", category: "art museum" },
  ],
  "quiet-paris": [
    { qid: "Q33506", category: "museum" },
    { qid: "Q1107656", category: "garden" },
    { qid: "Q22698", category: "park" },
  ],
  "secret-gardens": [
    { qid: "Q1107656", category: "garden" },
    { qid: "Q22698", category: "park" },
  ],
  "rainy-day-paris": [
    { qid: "Q33506", category: "museum" },
    { qid: "Q207694", category: "art museum" },
  ],
};

function point(value: string | undefined) {
  const match = value?.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/i);
  if (!match) return {};
  const lon = Number(match[1]);
  const lat = Number(match[2]);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : {};
}

function qidFromUrl(value: string) {
  return value.match(/\/(Q\d+)$/i)?.[1] ?? "";
}

async function fetchWithTimeout(url: string, timeoutMs = 7500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "application/sparql-results+json,application/json" },
      signal: controller.signal,
      next: { revalidate: 21600 },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function collectWikidataVenuePool(theme: string, maxSeeds = 18): Promise<VenuePoolResult> {
  const classes = THEME_CLASSES[theme] ?? [];
  const rule = "Wikidata Venue Pool supplies concrete physical-place discovery seeds only. A seed receives no traveler-intent, rarity, exposure, history or publication credit merely for existing in Wikidata; every seed must still pass Paris geo lock, focused intent evidence, exposure, relevance, claim verification and Safe Copy.";
  if (!classes.length) return { theme, ok: true, queried: false, returned: 0, seeds: [], rule };

  const classValues = classes.map((item) => `wd:${item.qid}`).join(" ");
  const query = `
SELECT DISTINCT ?item ?itemLabel ?coord ?website ?class WHERE {
  VALUES ?class { ${classValues} }
  ?item wdt:P31/wdt:P279* ?class ; wdt:P625 ?coord .
  SERVICE wikibase:around {
    ?item wdt:P625 ?location .
    bd:serviceParam wikibase:center "Point(2.3522 48.8566)"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "10" .
  }
  OPTIONAL { ?item wdt:P856 ?website . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
}
LIMIT ${Math.max(8, Math.min(maxSeeds * 2, 40))}`;

  try {
    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;
    const response = await fetchWithTimeout(url);
    if (!response.ok) throw new Error(`http_${response.status}`);
    const json = await response.json() as { results?: { bindings?: Array<Record<string, { value?: string }>> } };
    const seeds: VenuePoolSeed[] = [];
    const seen = new Set<string>();
    for (const row of json.results?.bindings ?? []) {
      const itemUrl = row.item?.value ?? "";
      const qid = qidFromUrl(itemUrl);
      const name = row.itemLabel?.value?.trim() ?? "";
      if (!qid || !name || /^Q\d+$/i.test(name) || seen.has(qid)) continue;
      const coords = point(row.coord?.value);
      // Exact Paris bounding box is deliberately tighter than the 10 km discovery radius.
      if (typeof coords.lat !== "number" || typeof coords.lon !== "number" || coords.lat < 48.80 || coords.lat > 48.91 || coords.lon < 2.22 || coords.lon > 2.47) continue;
      const classQid = qidFromUrl(row.class?.value ?? "");
      const category = classes.find((item) => item.qid === classQid)?.category ?? "physical venue";
      seen.add(qid);
      seeds.push({ id: `venue-pool:${qid}`, name, qid, lat: coords.lat, lon: coords.lon, officialUrl: row.website?.value, category });
      if (seeds.length >= maxSeeds) break;
    }
    return { theme, ok: true, queried: true, returned: seeds.length, seeds, rule };
  } catch (error) {
    return { theme, ok: false, queried: true, returned: 0, seeds: [], error: error instanceof Error ? error.message : "wikidata_venue_pool_failed", rule };
  }
}
