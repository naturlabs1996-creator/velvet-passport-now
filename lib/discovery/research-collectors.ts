import type { ResearchPacket, ResearchEvidence } from "./research-verification";
import { applyParisDestinationEntityLock } from "./destination-entity-lock";
import { applyResearchRelevanceEngine } from "./research-relevance-engine";
import { buildScentTrail } from "./scent-expander";
import { resolveParisPlaces } from "./place-resolver";
import { verifyIntentEvidence } from "./intent-evidence-bridge";
import { extractPlaceEntitiesFromSources } from "./place-entity-extractor";
import { enrichHistoryEvidence } from "./history-evidence-layer";

export type ResearchLead = {
  id: string;
  pageId: string;
  theme: string;
  query: string;
  name: string;
  snippet?: string;
  url: string;
  sourceType: ResearchEvidence["sourceType"];
  publisher: string;
  independentKey: string;
  observedAt: string;
  address?: string;
  lat?: number;
  lon?: number;
  rawClaims: string[];
  evidenceTrace?: ResearchEvidence[];
};

export type CollectorResult = {
  collector: "WIKIMEDIA" | "OPENSTREETMAP" | "OFFICIAL_SEARCH" | "EDITORIAL_SEARCH";
  ok: boolean;
  query: string;
  leads: ResearchLead[];
  error?: string;
};

export type ResearchCollectorBudget = {
  maxPackets?: number;
  maxCollectorsPerPacket?: number;
  maxLeadsPerCollector?: number;
  maxScentQueries?: number;
  maxPlaceLookups?: number;
  maxIntentLookups?: number;
  maxSourcePages?: number;
  maxHistoryLookups?: number;
  concurrency?: number;
};

const USER_AGENT = "VelvetPassportResearch/2.3 (semantic scent + deep place extraction + geo + intent + history; public data; cached requests)";
const DEFAULT_MAX_LEADS_PER_COLLECTOR = 8;
const DEFAULT_SCENT_QUERIES = 4;
const DEFAULT_PLACE_LOOKUPS = 18;
const DEFAULT_INTENT_LOOKUPS = 8;
const DEFAULT_SOURCE_PAGES = 6;
const DEFAULT_HISTORY_LOOKUPS = 6;

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, headers: { "user-agent": USER_AGENT, accept: "application/json,text/xml,text/html;q=0.8,*/*;q=0.5", ...(init.headers ?? {}) }, signal: controller.signal, next: { revalidate: 21600 } });
  } finally { clearTimeout(timer); }
}

function stripHtml(value: string) { return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }
function xmlItems(xml: string) {
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  const read = (block: string, tag: string) => {
    const match = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i"));
    return stripHtml((match?.[1] ?? "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
  };
  return blocks.map((block) => ({ title: read(block, "title"), link: read(block, "link"), description: read(block, "description"), pubDate: read(block, "pubDate") })).filter((item) => item.title && item.link);
}
function hostOf(url: string) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "unknown"; } }
function parisRelevant(text: string) { return /\bparis\b|montmartre|marais|opera|opéra|saint-germain|latin quarter|rive gauche|rive droite|arrondissement/i.test(text); }

async function collectWikimedia(packet: ResearchPacket, query: string, maxLeads: number): Promise<CollectorResult> {
  const collector = "WIKIMEDIA" as const;
  try {
    const search = `${query} Paris France place`;
    const response = await fetchWithTimeout(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(search)}&srlimit=10&format=json&origin=*`);
    if (!response.ok) throw new Error(`http_${response.status}`);
    const json = await response.json() as { query?: { search?: Array<{ pageid: number; title: string; snippet?: string }> } };
    const observedAt = new Date().toISOString();
    const leads = (json.query?.search ?? []).filter((item) => parisRelevant(`${item.title} ${stripHtml(item.snippet ?? "")}`)).slice(0, maxLeads).map((item) => ({ id: `wikipedia:${item.pageid}:${Buffer.from(query).toString("base64url").slice(0, 10)}`, pageId: packet.pageId, theme: packet.theme, query, name: item.title, snippet: stripHtml(item.snippet ?? ""), url: `https://en.wikipedia.org/?curid=${item.pageid}`, sourceType: "WIKIDATA" as const, publisher: "Wikipedia/Wikimedia", independentKey: "wikimedia.org", observedAt, rawClaims: [stripHtml(item.snippet ?? "")].filter(Boolean) }));
    return { collector, ok: true, query, leads };
  } catch (error) { return { collector, ok: false, query, leads: [], error: error instanceof Error ? error.message : "wikimedia_failed" }; }
}

async function collectOpenStreetMap(packet: ResearchPacket, query: string, maxLeads: number): Promise<CollectorResult> {
  const collector = "OPENSTREETMAP" as const;
  try {
    const response = await fetchWithTimeout(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=10&addressdetails=1&q=${encodeURIComponent(`${query}, Paris, France`)}`, { headers: { "accept-language": "en,fr;q=0.8" } });
    if (!response.ok) throw new Error(`http_${response.status}`);
    const json = await response.json() as Array<{ place_id: number; display_name: string; lat: string; lon: string; type?: string; category?: string; name?: string }>;
    const observedAt = new Date().toISOString();
    const leads = json.filter((item) => parisRelevant(item.display_name)).slice(0, maxLeads).map((item) => ({ id: `osm:${item.place_id}:${Buffer.from(query).toString("base64url").slice(0, 10)}`, pageId: packet.pageId, theme: packet.theme, query, name: item.name || item.display_name.split(",")[0], snippet: item.display_name, url: `https://www.openstreetmap.org/search?query=${encodeURIComponent(item.display_name)}`, sourceType: "MAP" as const, publisher: "OpenStreetMap", independentKey: "openstreetmap.org", observedAt, address: item.display_name, lat: Number(item.lat), lon: Number(item.lon), rawClaims: [item.display_name, item.category, item.type].filter((value): value is string => Boolean(value)) }));
    return { collector, ok: true, query, leads };
  } catch (error) { return { collector, ok: false, query, leads: [], error: error instanceof Error ? error.message : "osm_failed" }; }
}

async function collectBingRss(packet: ResearchPacket, query: string, mode: "OFFICIAL_SEARCH" | "EDITORIAL_SEARCH", maxLeads: number): Promise<CollectorResult> {
  const officialDomains = "(site:paris.fr OR site:parisjetaime.com OR site:france.fr OR site:culture.gouv.fr)";
  const q = mode === "OFFICIAL_SEARCH" ? `${query} ${officialDomains}` : `${query} Paris France travel place`;
  try {
    const response = await fetchWithTimeout(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(q)}`);
    if (!response.ok) throw new Error(`http_${response.status}`);
    const xml = await response.text();
    const observedAt = new Date().toISOString();
    const leads = xmlItems(xml).filter((item) => parisRelevant(`${item.title} ${item.description}`)).filter((item) => mode !== "OFFICIAL_SEARCH" || /(^|\.)(paris\.fr|parisjetaime\.com|france\.fr|culture\.gouv\.fr)$/i.test(hostOf(item.link))).slice(0, maxLeads).map((item, index) => {
      const host = hostOf(item.link);
      return { id: `${mode.toLowerCase()}:${host}:${index}:${Buffer.from(query).toString("base64url").slice(0, 8)}`, pageId: packet.pageId, theme: packet.theme, query, name: item.title, snippet: item.description, url: item.link, sourceType: mode === "OFFICIAL_SEARCH" ? "OFFICIAL" as const : "EDITORIAL" as const, publisher: host, independentKey: host, observedAt, rawClaims: [item.title, item.description].filter(Boolean) };
    });
    return { collector: mode, ok: true, query, leads };
  } catch (error) { return { collector: mode, ok: false, query, leads: [], error: error instanceof Error ? error.message : `${mode.toLowerCase()}_failed` }; }
}

function canonicalEntityName(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\b(paris|france|official|visit|guide)\b/g, " ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function dedupeLeads(leads: ResearchLead[]) {
  const seen = new Set<string>();
  return leads.filter((lead) => {
    const key = `${canonicalEntityName(lead.name)}|${lead.independentKey}`;
    if (!canonicalEntityName(lead.name) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

export async function collectResearchPacket(packet: ResearchPacket, budget: ResearchCollectorBudget = {}) {
  const maxCollectors = Math.max(1, Math.min(budget.maxCollectorsPerPacket ?? 4, 4));
  const maxLeads = Math.max(2, Math.min(budget.maxLeadsPerCollector ?? DEFAULT_MAX_LEADS_PER_COLLECTOR, 12));
  const maxScentQueries = Math.max(1, Math.min(budget.maxScentQueries ?? DEFAULT_SCENT_QUERIES, 8));
  const maxPlaceLookups = Math.max(1, Math.min(budget.maxPlaceLookups ?? DEFAULT_PLACE_LOOKUPS, 24));
  const maxIntentLookups = Math.max(1, Math.min(budget.maxIntentLookups ?? DEFAULT_INTENT_LOOKUPS, 16));
  const maxSourcePages = Math.max(1, Math.min(budget.maxSourcePages ?? DEFAULT_SOURCE_PAGES, 10));
  const maxHistoryLookups = Math.max(1, Math.min(budget.maxHistoryLookups ?? DEFAULT_HISTORY_LOOKUPS, 12));
  const scentTrail = buildScentTrail(packet, maxScentQueries);
  const results: CollectorResult[] = [];

  for (const query of scentTrail.queries) {
    const collectors = [
      () => collectOpenStreetMap(packet, query, maxLeads),
      () => collectBingRss(packet, query, "OFFICIAL_SEARCH", maxLeads),
      () => collectBingRss(packet, query, "EDITORIAL_SEARCH", maxLeads),
      () => collectWikimedia(packet, query, maxLeads),
    ].slice(0, maxCollectors);
    for (const collector of collectors) {
      results.push(await collector());
      await sleep(75);
    }
  }

  const initialLeads = dedupeLeads(results.flatMap((result) => result.leads));
  const extraction = await extractPlaceEntitiesFromSources(initialLeads, maxSourcePages);
  const combined = dedupeLeads([...initialLeads, ...extraction.leads]);
  const resolution = await resolveParisPlaces(combined, maxPlaceLookups);
  const destinationLocked = applyParisDestinationEntityLock(resolution.leads);
  const intent = await verifyIntentEvidence(destinationLocked.accepted, maxIntentLookups);
  const history = await enrichHistoryEvidence(intent.leads, maxHistoryLookups);
  const relevance = applyResearchRelevanceEngine(history.leads);
  const accepted = relevance.accepted;

  const entityCounts = new Map<string, { displayName: string; appearances: number; sources: Set<string>; queries: Set<string> }>();
  for (const lead of accepted) {
    const key = canonicalEntityName(lead.name);
    if (!key) continue;
    const current = entityCounts.get(key) ?? { displayName: lead.name, appearances: 0, sources: new Set<string>(), queries: new Set<string>() };
    current.appearances += 1; current.sources.add(lead.independentKey); current.queries.add(lead.query); entityCounts.set(key, current);
  }
  const trailSignals = [...entityCounts.entries()].map(([entityKey, value]) => ({ entityKey, displayName: value.displayName, appearances: value.appearances, independentSources: value.sources.size, queryVariants: value.queries.size, strength: Math.min(100, value.appearances * 10 + value.sources.size * 15 + value.queries.size * 10) })).sort((a, b) => b.strength - a.strength);

  return {
    packet,
    scentTrail,
    collectors: results.map((result) => ({ collector: result.collector, query: result.query, ok: result.ok, leads: result.leads.length, error: result.error })),
    placeEntityExtraction: { sourcePagesAttempted: extraction.sourcePagesAttempted, sourcePagesOpened: extraction.sourcePagesOpened, extractedCount: extraction.leads.length, examples: extraction.examples, rule: extraction.rule },
    placeResolver: { lookups: resolution.lookups, resolved: resolution.resolved.length, partial: resolution.partial.length, unresolved: resolution.unresolved.length, examples: resolution.results.slice(0, 12).map((item) => ({ name: item.lead.name, status: item.resolution.status, confidence: item.resolution.confidence, method: item.resolution.method, address: item.resolution.address, lat: item.resolution.lat, lon: item.resolution.lon, reasons: item.resolution.reasons })), rule: resolution.rule },
    intentEvidence: { lookups: intent.lookups, confirmed: intent.confirmed.length, partial: intent.partial.length, unconfirmed: intent.unconfirmed.length, examples: intent.results.slice(0, 10).map((item) => ({ name: item.lead.name, status: item.status, score: item.score, matchedTerms: item.matchedTerms, independentSources: item.independentSources, evidenceUrls: item.evidenceUrls, reasons: item.reasons })), rule: intent.rule },
    historyEvidence: { lookups: history.lookups, confirmed: history.confirmed.length, partial: history.partial.length, unconfirmed: history.unconfirmed.length, examples: history.results.slice(0, 10).map((item) => ({ name: item.lead.name, status: item.status, score: item.score, matchedHistoryTerms: item.matchedHistoryTerms, independentSources: item.independentSources, evidenceUrls: item.evidenceUrls, reasons: item.reasons })), rule: history.rule },
    leadCount: accepted.length,
    independentSources: new Set(accepted.map((lead) => lead.independentKey)).size,
    leads: accepted,
    trailSignals,
    destinationEntityLock: { accepted: destinationLocked.accepted.length, rejected: destinationLocked.rejected.length, rejectedExamples: destinationLocked.rejected.slice(0, 8).map((item) => ({ name: item.lead.name, reasons: item.lock.reasons })), rule: destinationLocked.rule },
    researchRelevance: { accepted: relevance.accepted.length, rejected: relevance.rejected.length, rejectedExamples: relevance.rejected.slice(0, 8).map((item) => ({ name: item.lead.name, score: item.relevance.score, geography: item.relevance.geography, intent: item.relevance.intent, velvetUtility: item.relevance.velvetUtility, reasons: item.relevance.reasons })), rule: relevance.rule },
    note: "Deep Research Collector V2 now opens editorial/official source pages to extract named place entities, resolves physical identity, confirms Paris, verifies intent, researches historical depth, and only then applies Research Relevance. No extraction, resolver, history signal or recurrence score can bypass claim verification or publication gates.",
  };
}

export async function collectResearchPackets(packets: ResearchPacket[], budget: ResearchCollectorBudget = {}) {
  const maxPackets = Math.max(1, Math.min(budget.maxPackets ?? 2, 5));
  const selected = packets.filter((packet) => packet.theme !== "hidden-bookshops").slice(0, maxPackets);
  const collections = [];
  for (const packet of selected) collections.push(await collectResearchPacket(packet, budget));
  return collections;
}
