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
  return leads.filter((lead) => { const key = `${lead.independentKey}|${canonicalEntityName(lead.name)}`; if (seen.has(key)) return false; seen.add(key); return true; });
}

function buildTrailSignals(leads: ResearchLead[]) {
  const groups = new Map<string, ResearchLead[]>();
  for (const lead of leads) {
    const key = canonicalEntityName(lead.name);
    if (!key) continue;
    const current = groups.get(key) ?? [];
    current.push(lead);
    groups.set(key, current);
  }
  return [...groups.entries()].map(([entityKey, items]) => ({
    entityKey,
    displayName: items[0]?.name ?? entityKey,
    appearances: items.length,
    independentSources: new Set(items.map((item) => item.independentKey)).size,
    queryVariants: new Set(items.map((item) => item.query)).size,
    strength: Math.min(100, 25 + Math.max(0, items.length - 1) * 12 + Math.max(0, new Set(items.map((item) => item.independentKey)).size - 1) * 24 + Math.max(0, new Set(items.map((item) => item.query)).size - 1) * 10),
  })).sort((a, b) => b.strength - a.strength || b.independentSources - a.independentSources);
}

async function runCollectorsForQuery(packet: ResearchPacket, query: string, maxLeads: number, maxCollectors: number) {
  const tasks = [
    () => collectOpenStreetMap(packet, query, maxLeads),
    () => collectBingRss(packet, query, "OFFICIAL_SEARCH", maxLeads),
    () => collectBingRss(packet, query, "EDITORIAL_SEARCH", maxLeads),
    () => collectWikimedia(packet, query, maxLeads),
  ].slice(0, maxCollectors);
  return Promise.all(tasks.map((task) => task()));
}

export async function collectResearchPacket(packet: ResearchPacket, budget: ResearchCollectorBudget = {}) {
  const maxLeads = Math.max(1, Math.min(budget.maxLeadsPerCollector ?? DEFAULT_MAX_LEADS_PER_COLLECTOR, 12));
  const maxCollectors = Math.max(1, Math.min(budget.maxCollectorsPerPacket ?? 4, 4));
  const maxScentQueries = Math.max(2, Math.min(budget.maxScentQueries ?? DEFAULT_SCENT_QUERIES, 8));
  const maxPlaceLookups = Math.max(4, Math.min(budget.maxPlaceLookups ?? DEFAULT_PLACE_LOOKUPS, 30));
  const maxIntentLookups = Math.max(2, Math.min(budget.maxIntentLookups ?? DEFAULT_INTENT_LOOKUPS, 16));
  const maxSourcePages = Math.max(1, Math.min(budget.maxSourcePages ?? DEFAULT_SOURCE_PAGES, 10));
  const maxHistoryLookups = Math.max(1, Math.min(budget.maxHistoryLookups ?? DEFAULT_HISTORY_LOOKUPS, 12));
  const scentTrail = buildScentTrail(packet.theme, packet.query, maxScentQueries);

  const results: CollectorResult[] = [];
  for (const query of scentTrail.queries) {
    const queryResults = await runCollectorsForQuery(packet, query, maxLeads, maxCollectors);
    results.push(...queryResults);
  }

  const rawLeads = dedupeLeads(results.flatMap((result) => result.leads));
  const placeExtraction = await extractPlaceEntitiesFromSources(rawLeads, maxSourcePages, 8);
  const combinedLeads = dedupeLeads([...placeExtraction.leads, ...rawLeads]);
  const placeResolution = await resolveParisPlaces(combinedLeads, maxPlaceLookups);
  const enrichedLeads = placeResolution.all.map((item) => item.lead);
  const entityLock = applyParisDestinationEntityLock(enrichedLeads);
  const intentEvidence = await verifyIntentEvidence(entityLock.accepted, maxIntentLookups);
  const historyEvidence = await enrichHistoryEvidence(intentEvidence.leads, maxHistoryLookups);
  const relevance = applyResearchRelevanceEngine(historyEvidence.leads);
  const leads = relevance.accepted;
  const trailSignals = buildTrailSignals(leads);

  return {
    packet,
    scentTrail: {
      queryCount: scentTrail.queries.length,
      queries: scentTrail.queries,
      strategy: scentTrail.strategy,
    },
    collectors: results.map((result) => ({ collector: result.collector, query: result.query, ok: result.ok, leads: result.leads.length, error: result.error })),
    placeEntityExtraction: {
      sourcePagesAttempted: placeExtraction.sourcePagesAttempted,
      sourcePagesOpened: placeExtraction.sourcePagesOpened,
      extractedCount: placeExtraction.extractedCount,
      examples: placeExtraction.leads.slice(0, 12).map((lead) => ({ name: lead.name, sourceUrl: lead.url, publisher: lead.publisher })),
      rule: placeExtraction.rule,
    },
    placeResolver: {
      lookups: placeResolution.lookups,
      resolved: placeResolution.resolved.length,
      partial: placeResolution.partial.length,
      unresolved: placeResolution.unresolved.length,
      examples: placeResolution.all.slice(0, 12).map((item) => ({ name: item.lead.name, status: item.status, confidence: item.confidence, method: item.method, address: item.lead.address, lat: item.lead.lat, lon: item.lead.lon, reasons: item.reasons })),
      rule: placeResolution.rule,
    },
    intentEvidence: {
      lookups: intentEvidence.lookups,
      confirmed: intentEvidence.confirmed.length,
      partial: intentEvidence.partial.length,
      unconfirmed: intentEvidence.unconfirmed.length,
      examples: intentEvidence.results.slice(0, 10).map((item) => ({ name: item.lead.name, status: item.status, score: item.score, matchedTerms: item.matchedTerms, independentSources: item.independentSources, evidenceUrls: item.evidenceUrls, reasons: item.reasons })),
      rule: intentEvidence.rule,
    },
    historyEvidence: {
      lookups: historyEvidence.lookups,
      confirmed: historyEvidence.confirmed.length,
      partial: historyEvidence.partial.length,
      unconfirmed: historyEvidence.unconfirmed.length,
      examples: historyEvidence.results.slice(0, 10).map((item) => ({ name: item.lead.name, status: item.status, score: item.score, matchedHistoryTerms: item.matchedHistoryTerms, independentSources: item.independentSources, evidenceUrls: item.evidenceUrls, reasons: item.reasons })),
      rule: historyEvidence.rule,
    },
    leadCount: leads.length,
    independentSources: new Set(leads.map((lead) => lead.independentKey)).size,
    leads,
    trailSignals: trailSignals.slice(0, 12),
    destinationEntityLock: {
      accepted: entityLock.accepted.length,
      rejected: entityLock.rejected.length,
      rejectedExamples: entityLock.rejected.slice(0, 8).map(({ lead, decision }) => ({ name: lead.name, reasons: decision.reasons })),
      rule: "PARIS TOKEN != PARIS DESTINATION. Bare Paris mentions, people, media, sport and homonymous places are rejected before focused intent research or candidate merging unless a Paris-France geographic anchor exists.",
    },
    researchRelevance: {
      accepted: leads.length,
      rejected: relevance.rejected.length,
      rejectedExamples: relevance.rejected.slice(0, 8).map(({ lead, score }) => ({ name: lead.name, score: score.total, geography: score.geography, intent: score.intent, velvetUtility: score.velvetUtility, reasons: score.reasons })),
      rule: "A valid Paris entity must match the active traveler intent and remain useful to the Velvet layer. Historical depth can strengthen research value, but never substitutes for intent evidence or factual verification.",
    },
    note: "Deep Research Collector V2 now opens editorial/official source pages to extract named place entities, resolves physical identity, confirms Paris, verifies intent, researches historical depth, and only then applies Research Relevance. No extraction, resolver, history signal or recurrence score can bypass claim verification or publication gates.",
  };
}

export async function collectResearchQueue(packets: ResearchPacket[], budgetOrMaxPackets: ResearchCollectorBudget | number = {}) {
  const budget = typeof budgetOrMaxPackets === "number" ? { maxPackets: budgetOrMaxPackets } : budgetOrMaxPackets;
  const maxPackets = Math.max(1, Math.min(budget.maxPackets ?? 3, 5));
  const concurrency = Math.max(1, Math.min(budget.concurrency ?? 2, 4));
  const selected = packets.slice(0, maxPackets);
  const collections: Awaited<ReturnType<typeof collectResearchPacket>>[] = [];
  for (let i = 0; i < selected.length; i += concurrency) {
    const batch = selected.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((packet) => collectResearchPacket(packet, budget)));
    collections.push(...batchResults);
  }
  return collections;
}