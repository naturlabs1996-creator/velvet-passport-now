import type { ResearchLead } from "./research-collectors";

export type PlaceExtractionResult = {
  sourceLeadId: string;
  sourceUrl: string;
  extracted: ResearchLead[];
  sourceHypotheses: string[];
  ok: boolean;
  error?: string;
};

type SelectedEntity = {
  name: string;
  confidence: "HIGH";
  method: "JSON_LD" | "PLACE_TYPE_TEXT" | "SEARCH_CONTEXT_RECOVERY";
  address?: string;
  lat?: number;
  lon?: number;
};

const USER_AGENT = "VelvetPassportPlaceExtractor/1.9 (identity-section source-page hypotheses + precision place extraction; cached public pages)";
const GENERIC = /^(paris|france|home|menu|visit|guide|travel|read more|learn more|about|contact|official website|wikipedia|contents|history|origins|etymology|geography|climate|administration|actualités|rechercher)$/i;
const EDITORIAL_NOISE = /\b(what to do|things to do|best |top |exhibitions?|events?|autumn|september|october|november|december|january|february|march|april|may|june|july|august|right now|discover the|heritage days|city pass|tourist office|official website|newsletter|privacy|cookie|facebook|instagram|youtube|tripadvisor|terms|login|sign in|subscribe|booking|all you must know|must-see|guide to|tips|news|agenda)\b/i;
const PLACE_TYPE = /\b(mus[eé]e|museum|maison|h[oô]tel particulier|passage|galerie|jardin|garden|square|cour|courtyard|librairie|bookshop|bookstore|atelier|chapelle|church|église|cemetery|cimetière|catacomb|palais|pavillon|villa|théâtre|theatre|café|cafe|bibliothèque|library|fondation|foundation|rue|street|arcade|halle|market|marché|canal|parc|park|temple|synagogue|basilique|basilica|monument|tower|tour|crypt|crypte)\b/i;
const STRUCTURED_PLACE_TYPES = new Set(["Place", "TouristAttraction", "Museum", "LocalBusiness", "LandmarksOrHistoricalBuildings", "Park", "Cemetery", "Library", "BookStore", "CafeOrCoffeeShop", "PerformingArtsTheater", "ArtGallery", "Church", "HinduTemple", "Synagogue"]);
const GENERIC_CITY_OVERVIEW = /(?:wikipedia\.org\/wiki\/Paris(?:$|[?#])|wikipedia\.org\/?curid=22989|\/paris\/?(?:$|[?#]))/i;

// Bounded tags only. They are candidate-research hypotheses extracted from an already-opened
// source page. They are never claim evidence, never Exposure evidence and never a LOCK signal.
const SOURCE_HYPOTHESIS_PATTERNS: Array<[string, RegExp]> = [
  ["atelier", /\b(atelier|studio|workshop)\b/i],
  ["working-workshop", /\b(atelier en activit[eé]|working workshop|working atelier|artisan workshop)\b/i],
  ["garden", /\b(jardin|garden)\b/i],
  ["courtyard", /\b(cour int[eé]rieure|courtyard|seconde? cour|second courtyard)\b/i],
  ["apartment-house", /\b(appartement|apartment|maison d['’]|house museum|maison[- ]mus[eé]e)\b/i],
  ["archives", /\b(archives?|documentation centre|centre de documentation)\b/i],
  ["reserve", /\b(r[eé]serves?|storage|conservation store)\b/i],
  ["consultation", /\b(salle de consultation|consultation room|consultation sur rendez[- ]vous|consult by appointment)\b/i],
  ["appointment", /\b(sur rendez[- ]vous|by appointment|appointment required)\b/i],
  ["private-room", /\b(petit salon|salon priv[eé]|private room|small salon)\b/i],
  ["underground", /\b(souterrain|underground|crypte|crypt|[eé]gout|sewer|galerie souterraine)\b/i],
  ["rare-opening", /\b(ouverture exceptionnelle|rare opening|exceptional opening)\b/i],
  ["after-hours", /\b(apr[eè]s la fermeture|after[- ]hours|after closing|nocturne)\b/i],
];

function clean(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
function decodeEntities(value: string) { return clean(value.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))); }
function normalizeName(value: string) { return decodeEntities(value).replace(/^[\d.\-–—: ]+/, "").replace(/[|•].*$/, "").trim(); }
function normalize(value: string) { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim(); }

function visiblePageText(html: string) {
  return clean(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, " ")
      .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, " ")
  );
}
function identityAnchors(name: string) {
  const normalized = normalize(name);
  const stop = new Set(["musee", "museum", "bibliotheque", "library", "maison", "paris", "ville", "palais", "centre"]);
  const words = normalized.split(" ").filter((word) => word.length >= 4 && !stop.has(word));
  return [...new Set([normalized, ...words.slice(-3)])].filter(Boolean);
}
function sourcePageHypotheses(html: string) {
  const visible = visiblePageText(html);
  return SOURCE_HYPOTHESIS_PATTERNS.filter(([, pattern]) => pattern.test(visible)).map(([tag]) => tag).slice(0, 8);
}
function localSourcePageHypotheses(html: string, lead: ResearchLead) {
  const stripped = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, " ");
  const matches = [...stripped.matchAll(/<(h[1-6]|p|li|dt|dd|figcaption)\b[^>]*>[\s\S]*?<\/\1>/gi)];
  const blocks = matches
    .map((match) => ({ type: (match[1] ?? "").toLowerCase(), text: clean(match[0] ?? "") }))
    .filter((block) => block.text.length >= 12 && block.text.length <= 1400);
  const anchors = identityAnchors(lead.name);
  const selected = new Set<number>();
  for (let i = 0; i < blocks.length; i++) {
    const normalizedBlock = normalize(blocks[i].text);
    if (!anchors.some((anchor) => normalizedBlock.includes(anchor))) continue;
    selected.add(i);
    let addedFollowing = 0;
    for (let j = i + 1; j < blocks.length && addedFollowing < 5; j++) {
      if (/^h[1-6]$/.test(blocks[j].type)) break;
      selected.add(j);
      addedFollowing += 1;
    }
    if (selected.size >= 18) break;
  }
  if (!selected.size) return [];
  const local = [...selected].sort((a, b) => a - b).map((index) => blocks[index].text).join(" | ");
  return SOURCE_HYPOTHESIS_PATTERNS.filter(([, pattern]) => pattern.test(local)).map(([tag]) => tag).slice(0, 8);
}

function attachSourceHypotheses(lead: ResearchLead, hypotheses: string[], localHypotheses: string[]) {
  if (!hypotheses.length && !localHypotheses.length) return;
  const existing = new Set(lead.rawClaims);
  for (const tag of hypotheses) {
    const claim = `SOURCE_PAGE_HYPOTHESIS ${tag}`;
    if (!existing.has(claim)) lead.rawClaims.push(claim);
  }
  for (const tag of localHypotheses) {
    const claim = `SOURCE_PAGE_LOCAL_HYPOTHESIS ${tag}`;
    if (!existing.has(claim)) lead.rawClaims.push(claim);
  }
}

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
  try { return await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" }, signal: controller.signal, redirect: "follow", next: { revalidate: 21600 } }); }
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

function searchContextCandidates(lead: ResearchLead) {
  const haystack = clean(`${lead.name}. ${lead.snippet ?? ""}`);
  const candidates: string[] = [];
  const title = plausiblePlaceName(lead.name); if (title) candidates.push(title);
  const patterns = [
    /\b((?:Mus[eé]e|Museum|Maison|Fondation|Foundation|Jardin|Garden|Passage|Galerie|Gallery|Palais|Pavillon|Villa|Chapelle|Church|Église|Theatre|Théâtre|Bibliothèque|Library|Librairie|Bookshop|Bookstore|Caf[eé]|Cemetery|Cimetière)\s+(?:de\s+|du\s+|des\s+|d['’]|of\s+|the\s+)?[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’.-]+(?:\s+[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’.-]+){0,4})/g,
    /\b((?:H[oô]tel particulier|Square|Cour|Courtyard|Arcade|Market|March[eé]|Parc|Park)\s+[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’.-]+(?:\s+[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’.-]+){0,3})/g,
  ];
  for (const pattern of patterns) { let match: RegExpExecArray | null; while ((match = pattern.exec(haystack)) !== null && candidates.length < 10) { const candidate = plausiblePlaceName(match[1] ?? ""); if (candidate) candidates.push(candidate); } }
  return [...new Set(candidates)].slice(0, 6);
}
function hostOf(url: string) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "unknown"; } }
function recoveredLeads(lead: ResearchLead, names: string[]): ResearchLead[] {
  const observedAt = new Date().toISOString();
  return names.map((name, index) => ({ id: `recovered:${Buffer.from(`${lead.id}:${name}`).toString("base64url").slice(0, 28)}:${index}`, pageId: lead.pageId, theme: lead.theme, query: lead.query, name, snippet: `Candidate place recovered from search-result context for later independent verification.`, url: lead.url, sourceType: lead.sourceType, publisher: lead.publisher, independentKey: hostOf(lead.url), observedAt, rawClaims: [`PLACE_ENTITY_RECOVERED_FROM_SEARCH_CONTEXT ${lead.url}`, `PLACE_ENTITY_CONFIDENCE HIGH`, `PLACE_ENTITY_METHOD SEARCH_CONTEXT_RECOVERY`, `SOURCE_CONTEXT ${lead.name}`] }));
}

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
    const recovery = recoveredLeads(lead, searchContextCandidates(lead));
    try {
      const response = await fetchWithTimeout(lead.url);
      if (!response.ok || !(response.headers.get("content-type") ?? "").includes("text/html")) { results.push({ sourceLeadId: lead.id, sourceUrl: lead.url, extracted: recovery, sourceHypotheses: [], ok: false, error: `http_${response.status}` }); continue; }
      const html = (await response.text()).slice(0, 900_000);
      const hypotheses = sourcePageHypotheses(html);
      const localHypotheses = localSourcePageHypotheses(html, lead);
      attachSourceHypotheses(lead, hypotheses, localHypotheses);
      const structured = structuredCandidates(html); const structuredNames = new Set(structured.map((item) => item.name.toLowerCase())); const visible = visibleCandidates(html).filter((name) => !structuredNames.has(name.toLowerCase()));
      const selected: SelectedEntity[] = [...structured.map((item): SelectedEntity => ({ ...item, method: "JSON_LD" })), ...visible.map((name): SelectedEntity => ({ name, confidence: "HIGH", method: "PLACE_TYPE_TEXT" }))]
        .filter((item) => item.name.toLowerCase() !== lead.name.toLowerCase()).slice(0, Math.max(1, Math.min(maxEntitiesPerPage, 8)));
      const observedAt = new Date().toISOString(); const host = hostOf(lead.url);
      const extracted = selected.map((item, index): ResearchLead => ({ id: `extracted:${Buffer.from(`${lead.id}:${item.name}`).toString("base64url").slice(0, 28)}:${index}`, pageId: lead.pageId, theme: lead.theme, query: lead.query, name: item.name, snippet: `High-confidence named place extracted from ${lead.name}`, url: lead.url, sourceType: lead.sourceType, publisher: lead.publisher, independentKey: host, observedAt, address: item.address, lat: item.lat, lon: item.lon, rawClaims: [`PLACE_ENTITY_EXTRACTED_FROM ${lead.url}`, `PLACE_ENTITY_CONFIDENCE HIGH`, `PLACE_ENTITY_METHOD ${item.method}`, `SOURCE_CONTEXT ${lead.name}`] }));
      const existingNames = new Set(extracted.map((item) => normalize(item.name)));
      results.push({ sourceLeadId: lead.id, sourceUrl: lead.url, extracted: [...extracted, ...recovery.filter((item) => !existingNames.has(normalize(item.name)))], sourceHypotheses: hypotheses, ok: true });
    } catch (error) { results.push({ sourceLeadId: lead.id, sourceUrl: lead.url, extracted: recovery, sourceHypotheses: [], ok: false, error: error instanceof Error ? error.message : "source_fetch_failed" }); }
  }

  const extracted = results.flatMap((item) => item.extracted); const seen = new Set<string>();
  const deduped = extracted.filter((lead) => { const key = normalize(lead.name); if (!key || seen.has(key)) return false; seen.add(key); return true; });
  return { results, leads: deduped, sourcePagesAttempted: eligible.length, sourcePagesOpened: results.filter((item) => item.ok).length, extractedCount: deduped.length,
    hypothesisPages: results.filter((item) => item.sourceHypotheses.length > 0).length,
    rule: "Collector Recovery V1.6: focused claim-relevant official/editorial pages are ranked ahead of generic overviews. Whole-page SOURCE_PAGE_HYPOTHESIS tags remain diagnostics only. SOURCE_PAGE_LOCAL_HYPOTHESIS tags are emitted only when the same bounded concept appears in a bounded identity-bearing editorial section: the identity block plus up to five following non-heading blocks, stopping at the next heading, after script/style/header/nav/footer removal. Both tag classes remain zero-truth, zero-Exposure and zero-LOCK signals and must be independently verified downstream. If a page cannot be opened, only explicit named physical-place patterns recovered from search-result context may enter the candidate pool, also with no truth credit. JSON-LD remains preferred when a page opens." };
}
