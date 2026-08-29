import type { ResearchPacket, ResearchEvidence } from "./research-verification";

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
  concurrency?: number;
};

const USER_AGENT = "VelvetPassportResearch/1.0 (research collector; public data; cached requests)";
const DEFAULT_MAX_LEADS_PER_COLLECTOR = 8;

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
function queryTokens(query: string) { return query.toLowerCase().split(/[^a-z0-9à-ÿ]+/i).filter((token) => token.length >= 4 && !["paris", "places", "things"].includes(token)); }
function intentRelevant(text: string, query: string) { const tokens = queryTokens(query); if (!tokens.length) return true; const haystack = text.toLowerCase(); return tokens.some((token) => haystack.includes(token)); }

async function collectWikimedia(packet: ResearchPacket, maxLeads: number): Promise<CollectorResult> {
  const collector = "WIKIMEDIA" as const;
  try {
    const search = `${packet.query} Paris`;
    const response = await fetchWithTimeout(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(search)}&srlimit=10&format=json&origin=*`);
    if (!response.ok) throw new Error(`http_${response.status}`);
    const json = await response.json() as { query?: { search?: Array<{ pageid: number; title: string; snippet?: string }> } };
    const observedAt = new Date().toISOString();
    const leads = (json.query?.search ?? []).filter((item) => parisRelevant(`${item.title} ${stripHtml(item.snippet ?? "")}`)).filter((item) => intentRelevant(`${item.title} ${stripHtml(item.snippet ?? "")}`, packet.query)).slice(0, maxLeads).map((item) => ({ id: `wikipedia:${item.pageid}`, pageId: packet.pageId, theme: packet.theme, query: packet.query, name: item.title, snippet: stripHtml(item.snippet ?? ""), url: `https://en.wikipedia.org/?curid=${item.pageid}`, sourceType: "WIKIDATA" as const, publisher: "Wikipedia/Wikimedia", independentKey: "wikimedia.org", observedAt, rawClaims: [stripHtml(item.snippet ?? "")].filter(Boolean) }));
    return { collector, ok: true, query: packet.query, leads };
  } catch (error) { return { collector, ok: false, query: packet.query, leads: [], error: error instanceof Error ? error.message : "wikimedia_failed" }; }
}

async function collectOpenStreetMap(packet: ResearchPacket, maxLeads: number): Promise<CollectorResult> {
  const collector = "OPENSTREETMAP" as const;
  try {
    const response = await fetchWithTimeout(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=10&addressdetails=1&q=${encodeURIComponent(`${packet.query}, Paris, France`)}`, { headers: { "accept-language": "en,fr;q=0.8" } });
    if (!response.ok) throw new Error(`http_${response.status}`);
    const json = await response.json() as Array<{ place_id: number; display_name: string; lat: string; lon: string; type?: string; category?: string; name?: string }>;
    const observedAt = new Date().toISOString();
    const leads = json.filter((item) => parisRelevant(item.display_name)).slice(0, maxLeads).map((item) => ({ id: `osm:${item.place_id}`, pageId: packet.pageId, theme: packet.theme, query: packet.query, name: item.name || item.display_name.split(",")[0], snippet: item.display_name, url: `https://www.openstreetmap.org/search?query=${encodeURIComponent(item.display_name)}`, sourceType: "MAP" as const, publisher: "OpenStreetMap", independentKey: "openstreetmap.org", observedAt, address: item.display_name, lat: Number(item.lat), lon: Number(item.lon), rawClaims: [item.display_name, item.category, item.type].filter((value): value is string => Boolean(value)) }));
    return { collector, ok: true, query: packet.query, leads };
  } catch (error) { return { collector, ok: false, query: packet.query, leads: [], error: error instanceof Error ? error.message : "osm_failed" }; }
}

async function collectBingRss(packet: ResearchPacket, mode: "OFFICIAL_SEARCH" | "EDITORIAL_SEARCH", maxLeads: number): Promise<CollectorResult> {
  const officialDomains = "(site:paris.fr OR site:parisjetaime.com OR site:france.fr OR site:culture.gouv.fr)";
  const editorialTerms = "Paris travel hidden unusual quiet garden passage museum bookshop";
  const q = mode === "OFFICIAL_SEARCH" ? `${packet.query} ${officialDomains}` : `${packet.query} ${editorialTerms}`;
  try {
    const response = await fetchWithTimeout(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(q)}`);
    if (!response.ok) throw new Error(`http_${response.status}`);
    const xml = await response.text();
    const observedAt = new Date().toISOString();
    const leads = xmlItems(xml).filter((item) => parisRelevant(`${item.title} ${item.description}`)).filter((item) => intentRelevant(`${item.title} ${item.description}`, packet.query)).filter((item) => mode !== "OFFICIAL_SEARCH" || /(^|\.)(paris\.fr|parisjetaime\.com|france\.fr|culture\.gouv\.fr)$/i.test(hostOf(item.link))).slice(0, maxLeads).map((item, index) => {
      const host = hostOf(item.link);
      return { id: `${mode.toLowerCase()}:${host}:${index}`, pageId: packet.pageId, theme: packet.theme, query: packet.query, name: item.title, snippet: item.description, url: item.link, sourceType: mode === "OFFICIAL_SEARCH" ? "OFFICIAL" as const : "EDITORIAL" as const, publisher: host, independentKey: host, observedAt, rawClaims: [item.title, item.description].filter(Boolean) };
    });
    return { collector: mode, ok: true, query: packet.query, leads };
  } catch (error) { return { collector: mode, ok: false, query: packet.query, leads: [], error: error instanceof Error ? error.message : `${mode.toLowerCase()}_failed` }; }
}

function dedupeLeads(leads: ResearchLead[]) {
  const seen = new Set<string>();
  return leads.filter((lead) => { const key = `${lead.independentKey}|${lead.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`; if (seen.has(key)) return false; seen.add(key); return true; });
}

export async function collectResearchPacket(packet: ResearchPacket, budget: ResearchCollectorBudget = {}) {
  const maxLeads = Math.max(1, Math.min(budget.maxLeadsPerCollector ?? DEFAULT_MAX_LEADS_PER_COLLECTOR, 12));
  const maxCollectors = Math.max(1, Math.min(budget.maxCollectorsPerPacket ?? 4, 4));
  const tasks = [
    () => collectWikimedia(packet, maxLeads),
    () => collectOpenStreetMap(packet, maxLeads),
    () => collectBingRss(packet, "OFFICIAL_SEARCH", maxLeads),
    () => collectBingRss(packet, "EDITORIAL_SEARCH", maxLeads),
  ].slice(0, maxCollectors);
  const results = await Promise.all(tasks.map((task) => task()));
  const leads = dedupeLeads(results.flatMap((result) => result.leads));
  return { packet, collectors: results.map((result) => ({ collector: result.collector, ok: result.ok, leads: result.leads.length, error: result.error })), leadCount: leads.length, independentSources: new Set(leads.map((lead) => lead.independentKey)).size, leads, note: "Research leads are evidence candidates only. Collector count and leads are budget-capped; no budget can open the publication gate by itself." };
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
