import type { ResearchLead } from "./research-collectors";

export type PlaceExtractionResult = {
  sourceLeadId: string;
  sourceUrl: string;
  extracted: ResearchLead[];
  ok: boolean;
  error?: string;
};

type SelectedEntity = {
  name: string;
  confidence: "HIGH";
  method: "JSON_LD" | "PLACE_TYPE_TEXT";
  address?: string;
  lat?: number;
  lon?: number;
};

const USER_AGENT = "VelvetPassportPlaceExtractor/1.2 (focused source ranking + precision place extraction; cached public pages)";
const GENERIC = /^(paris|france|home|menu|visit|guide|travel|read more|learn more|about|contact|official website|wikipedia|contents|history|origins|etymology|geography|climate|administration|actualités|rechercher)$/i;
const EDITORIAL_NOISE = /\b(what to do|things to do|best |top |exhibitions?|events?|autumn|september|october|november|december|january|february|march|april|may|june|july|august|right now|discover the|heritage days|city pass|tourist office|official website|newsletter|privacy|cookie|facebook|instagram|youtube|tripadvisor|terms|login|sign in|subscribe|booking|all you must know|must-see|guide to|tips|news|agenda)\b/i;
const PLACE_TYPE = /\b(mus[eé]e|museum|maison|h[oô]tel particulier|passage|galerie|jardin|garden|square|cour|courtyard|librairie|bookshop|bookstore|atelier|chapelle|church|église|cemetery|cimetière|catacomb|palais|pavillon|villa|théâtre|theatre|café|cafe|bibliothèque|library|fondation|foundation|rue|street|arcade|halle|market|marché|canal|parc|park|temple|synagogue|basilique|basilica|monument|tower|tour|crypt|crypte)\b/i;
const STRUCTURED_PLACE_TYPES = new Set(["Place", "TouristAttraction", "Museum", "LocalBusiness", "LandmarksOrHistoricalBuildings", "Park", "Cemetery", "Library", "BookStore", "CafeOrCoffeeShop", "PerformingArtsTheater", "ArtGallery", "Church", "HinduTemple", "Synagogue"]);
const GENERIC_CITY_OVERVIEW = /(?:wikipedia\.org\/wiki\/Paris(?:$|[?#])|wikipedia\.org\/?curid=22989|\/paris\/?(?:$|[?#]))/i;

function clean(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
function decodeEntities(value: string) { return clean(value.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))); }
function normalizeName(value: string) { return decodeEntities(value).replace(/^[\d.\-–—: ]+/, "").replace(/[|•].*$/, "").trim(); }
function normalize(value: string) { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim(); }

function plausiblePlaceName(value: string) {
  const text = normalizeName(value);
  if (text.length < 4 || text.length > 80 || GENERIC.test(text) || EDITORIAL_NOISE.test(text)) return null;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 8) return null;
  if (!PLACE_TYPE.test(text)) return null;
  const properCount = words.filter((word) => /^[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’.-]+$/.test(word)).length;
  if (properCount < 1) return null;
  return text;
}

function sourcePriority(lead: ResearchLead) {
  const haystack = normalize(`${lead.query} ${lead.name} ${lead.snippet ?? ""}`);
  let score = lead.sourceType === "OFFICIAL" ? 55 : 35;
  if (/late night|late opening|nocturne|evening opening|unusual|insolite|atypique|m[eé]connu|small museum|house museum|quiet|peaceful|hidden garden|courtyard|forgotten passage/.test(haystack)) score += 35;
  if (PLACE_TYPE.test(`${lead.name} ${lead.snippet ?? ""}`)) score += 18;
  if (/official|museum|musee|musée|jardin|garden|passage|fondation|foundation/.test(haystack)) score += 10;
  if (GENERIC_CITY_OVERVIEW.test(lead.url) || /^(paris|paris - wikipedia)$/i.test(lead.name.trim())) score -= 100;
  if (/wikipedia\.org/i.test(lead.url)) score -= 15;
  return score;
}

async function fetchWithTimeout(url: string, timeoutMs = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" }, signal: controller.signal, next: { revalidate: 21600 } }); }
  finally { clearTimeout(timer); }
}
function asTypeList(value: unknown): string[] { if (typeof value === "string") return [value]; if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string"); return []; }

function structuredCandidates(html: string) {
  const candidates: Array<{ name: string; address?: string; lat?: number; lon?: number; confidence: "HIGH" }> = [];
  const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? [];
  for (const script of scripts.slice(0, 30)) {
    const body = script.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    try {
      const parsed = JSON.parse(body) as unknown; const roots = Array.isArray(parsed) ? parsed : [parsed]; const queue: unknown[] = [...roots];
      while (queue.length && candidates.length < 40) {
        const node = queue.shift(); if (!node || typeof node !== "object") continue;
        const obj = node as Record<string, unknown>; if (Array.isArray(obj["@graph"])) queue.push(...obj["@graph"] as unknown[]);
        const types = asTypeList(obj["@type"]); const isPlace = types.some((type) => STRUCTURED_PLACE_TYPES.has(type)); const name = typeof obj.name === "string" ? normalizeName(obj.name) : "";
        if (!isPlace || !name || GENERIC.test(name) || EDITORIAL_NOISE.test(name)) continue;
        const addressObj = obj.address; let address: string | undefined;
        if (typeof addressObj === "string") address = addressObj;
        else if (addressObj && typeof addressObj === "object") { const a = addressObj as Record<string, unknown>; address = [a.streetAddress, a.postalCode, a.addressLocality, a.addressCountry].filter((v): v is string => typeof v === "string").join(", ") || undefined; }
        const geo = obj.geo && typeof obj.geo === "object" ? obj.geo as Record<string, unknown> : undefined;
        const lat = geo && (typeof geo.latitude === "number" || typeof geo.latitude === "string") ? Number(geo.latitude) : undefined;
        const lon = geo && (typeof geo.longitude === "number" || typeof geo.longitude === "string") ? Number(geo.longitude) : undefined;
        candidates.push({ name, address, lat: Number.isFinite(lat) ? lat : undefined, lon: Number.isFinite(lon) ? lon : undefined, confidence: "HIGH" });
      }
    } catch {}
  }
  return candidates;
}

function visibleCandidates(html: string) {
  const texts: string[] = [];
  const patterns = [/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi, /<a\b[^>]*href=["'][^"']*(?:museum|musee|musée|place|visit|monument|garden|jardin|passage|bookshop|librairie|gallery|galerie|heritage|patrimoine)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi, /<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi];
  for (const pattern of patterns) { let match: RegExpExecArray | null; while ((match = pattern.exec(html)) !== null && texts.length < 200) { const candidate = plausiblePlaceName(match[1] ?? ""); if (candidate) texts.push(candidate); } }
  return [...new Set(texts)];
}
function hostOf(url: string) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "unknown"; } }

export async function extractPlaceEntitiesFromSources(leads: ResearchLead[], maxSourcePages = 6, maxEntitiesPerPage = 8) {
  const maxPages = Math.max(1, Math.min(maxSourcePages, 12));
  const ranked = leads
    .filter((lead) => (lead.sourceType === "EDITORIAL" || lead.sourceType === "OFFICIAL") && !EDITORIAL_NOISE.test(lead.name))
    .map((lead) => ({ lead, score: sourcePriority(lead) }))
    .sort((a, b) => b.score - a.score);
  const preferred = ranked.filter((item) => item.score > 0 && !GENERIC_CITY_OVERVIEW.test(item.lead.url));
  const fallback = ranked.filter((item) => !preferred.includes(item));
  const eligible = [...preferred, ...fallback].slice(0, maxPages).map((item) => item.lead);
  const results: PlaceExtractionResult[] = [];

  for (const lead of eligible) {
    try {
      const response = await fetchWithTimeout(lead.url);
      if (!response.ok || !(response.headers.get("content-type") ?? "").includes("text/html")) { results.push({ sourceLeadId: lead.id, sourceUrl: lead.url, extracted: [], ok: false, error: `http_${response.status}` }); continue; }
      const html = (await response.text()).slice(0, 900_000);
      const structured = structuredCandidates(html); const structuredNames = new Set(structured.map((item) => item.name.toLowerCase())); const visible = visibleCandidates(html).filter((name) => !structuredNames.has(name.toLowerCase()));
      const selected: SelectedEntity[] = [...structured.map((item): SelectedEntity => ({ ...item, method: "JSON_LD" })), ...visible.map((name): SelectedEntity => ({ name, confidence: "HIGH", method: "PLACE_TYPE_TEXT" }))]
        .filter((item) => item.name.toLowerCase() !== lead.name.toLowerCase()).slice(0, Math.max(1, Math.min(maxEntitiesPerPage, 8)));
      const observedAt = new Date().toISOString(); const host = hostOf(lead.url);
      const extracted = selected.map((item, index): ResearchLead => ({ id: `extracted:${Buffer.from(`${lead.id}:${item.name}`).toString("base64url").slice(0, 28)}:${index}`, pageId: lead.pageId, theme: lead.theme, query: lead.query, name: item.name, snippet: `High-confidence named place extracted from ${lead.name}`, url: lead.url, sourceType: lead.sourceType, publisher: lead.publisher, independentKey: host, observedAt, address: item.address, lat: item.lat, lon: item.lon, rawClaims: [`PLACE_ENTITY_EXTRACTED_FROM ${lead.url}`, `PLACE_ENTITY_CONFIDENCE HIGH`, `PLACE_ENTITY_METHOD ${item.method}`, `SOURCE_CONTEXT ${lead.name}`] }));
      results.push({ sourceLeadId: lead.id, sourceUrl: lead.url, extracted, ok: true });
    } catch (error) { results.push({ sourceLeadId: lead.id, sourceUrl: lead.url, extracted: [], ok: false, error: error instanceof Error ? error.message : "source_fetch_failed" }); }
  }

  const extracted = results.flatMap((item) => item.extracted); const seen = new Set<string>();
  const deduped = extracted.filter((lead) => { const key = normalize(lead.name); if (!key || seen.has(key)) return false; seen.add(key); return true; });
  return { results, leads: deduped, sourcePagesAttempted: eligible.length, sourcePagesOpened: results.filter((item) => item.ok).length, extractedCount: deduped.length,
    rule: "Focused claim-relevant official/editorial pages are ranked ahead of generic Paris overview pages. Generic city-overview Wikipedia pages are fallback only. JSON-LD place data is preferred, navigation/editorial headings are rejected, and every entity must still pass geo, Paris lock, intent, exposure, relevance and claim verification." };
}
