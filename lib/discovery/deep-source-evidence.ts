export type DeepEvidenceWindow = {
  url: string;
  host: string;
  sourceFamily: string;
  matchedIdentity: boolean;
  text: string;
  terms: string[];
};

const USER_AGENT = "VelvetPassportDeepEvidence/1.3 (wikidata-linked official + bounded source context verification; cached requests)";
const MAX_HTML_BYTES = 900_000;

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function hostOf(url: string) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "unknown"; } }
export function sourceFamilyOf(urlOrHost: string) {
  const host = /^https?:\/\//i.test(urlOrHost) ? hostOf(urlOrHost) : urlOrHost.replace(/^www\./, "").toLowerCase();
  if (host === "wikipedia.org" || host.endsWith(".wikipedia.org")) return "wikipedia.org";
  if (host === "wikimedia.org" || host.endsWith(".wikimedia.org")) return "wikimedia.org";
  const parts = host.split(".").filter(Boolean);
  return parts.length >= 2 ? parts.slice(-2).join(".") : host;
}
function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ").trim();
}
async function fetchPage(url: string, timeoutMs = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5" }, signal: controller.signal, redirect: "follow", next: { revalidate: 21600 } });
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("text/html") && !type.includes("application/xhtml+xml")) return null;
    const raw = await response.text();
    return stripHtml(raw.slice(0, MAX_HTML_BYTES));
  } catch { return null; }
  finally { clearTimeout(timer); }
}
function identityTokens(name: string) {
  const generic = new Set(["paris","musee","museum","hotel","the","of","de","du","des","la","le","les","france"]);
  return normalize(name).split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !generic.has(t));
}
function identityMatch(name: string, text: string) {
  const n = normalize(name); const t = normalize(text);
  if (n.length >= 7 && t.includes(n)) return true;
  const tokens = identityTokens(name);
  if (!tokens.length) return false;
  const matched = tokens.filter((token) => t.includes(token)).length;
  return tokens.length === 1 ? matched === 1 : matched >= Math.min(2, tokens.length);
}
function contextWindow(name: string, text: string, radius = 900) {
  const nText = normalize(text);
  const nName = normalize(name);
  let index = nText.indexOf(nName);
  if (index < 0) {
    const token = identityTokens(name)[0];
    index = token ? nText.indexOf(token) : -1;
  }
  if (index < 0) return "";
  return text.slice(Math.max(0, index - radius), Math.min(text.length, index + radius));
}

async function wikidataLinkedUrls(wikidataId: string) {
  if (!/^Q\d+$/i.test(wikidataId)) return [];
  try {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 5500);
    try {
      const response = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(wikidataId)}&props=sitelinks|claims&sitefilter=enwiki|frwiki&format=json&origin=*`, { headers: { "user-agent": USER_AGENT, accept: "application/json" }, signal: controller.signal, next: { revalidate: 21600 } });
      if (!response.ok) return [];
      const json = await response.json() as { entities?: Record<string, { sitelinks?: Record<string, { title?: string }>; claims?: { P856?: Array<{ mainsnak?: { datavalue?: { value?: string } } }> } }> };
      const entity = json.entities?.[wikidataId];
      const urls: string[] = [];
      for (const claim of entity?.claims?.P856 ?? []) {
        const value = claim.mainsnak?.datavalue?.value;
        if (typeof value === "string" && /^https?:\/\//i.test(value)) urls.push(value);
      }
      const en = entity?.sitelinks?.enwiki?.title;
      const fr = entity?.sitelinks?.frwiki?.title;
      if (en) urls.push(`https://en.wikipedia.org/wiki/${encodeURIComponent(en.replace(/ /g, "_"))}`);
      if (fr) urls.push(`https://fr.wikipedia.org/wiki/${encodeURIComponent(fr.replace(/ /g, "_"))}`);
      return urls;
    } finally { clearTimeout(timer); }
  } catch { return []; }
}

export async function discoverDirectSourceUrls(name: string, maxUrls = 5, wikidataId?: string) {
  const urls: string[] = [];
  if (wikidataId) urls.push(...await wikidataLinkedUrls(wikidataId));

  const encoded = encodeURIComponent(`${name} Paris`);
  try {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 5500);
    try {
      const response = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&srlimit=4&format=json&origin=*`, { headers: { "user-agent": USER_AGENT, accept: "application/json" }, signal: controller.signal, next: { revalidate: 21600 } });
      if (response.ok) {
        const json = await response.json() as { query?: { search?: Array<{ pageid: number; title: string }> } };
        for (const item of json.query?.search ?? []) {
          if (!identityMatch(name, item.title)) continue;
          urls.push(`https://en.wikipedia.org/?curid=${item.pageid}`);
        }
      }
    } finally { clearTimeout(timer); }
  } catch { /* Direct discovery failure stays unknown. */ }

  try {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 5500);
    try {
      const response = await fetch(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(`\"${name}\" Paris`)}`, { headers: { "user-agent": USER_AGENT, accept: "application/rss+xml,text/xml,*/*" }, signal: controller.signal, next: { revalidate: 21600 } });
      if (response.ok) {
        const xml = await response.text();
        const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
        for (const block of blocks.slice(0, 8)) {
          const title = stripHtml(block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1] ?? "");
          const link = stripHtml(block.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i)?.[1] ?? "");
          if (!title || !link || !identityMatch(name, title)) continue;
          urls.push(link);
        }
      }
    } finally { clearTimeout(timer); }
  } catch { /* Direct discovery failure stays unknown. */ }

  const unique = [...new Set(urls)].filter((url) => /^https?:\/\//i.test(url));
  unique.sort((a, b) => {
    const aWiki = sourceFamilyOf(a) === "wikipedia.org" ? 1 : 0;
    const bWiki = sourceFamilyOf(b) === "wikipedia.org" ? 1 : 0;
    return aWiki - bWiki;
  });
  return unique.slice(0, Math.max(1, Math.min(maxUrls, 8)));
}

export async function fetchDeepEvidenceWindows(name: string, urls: string[], terms: string[], maxPages = 3) {
  const uniqueUrls = [...new Set(urls)].filter((url) => /^https?:\/\//i.test(url)).slice(0, Math.max(1, Math.min(maxPages, 5)));
  const windows: DeepEvidenceWindow[] = [];
  let attempted = 0;
  let opened = 0;
  for (const url of uniqueUrls) {
    attempted += 1;
    const page = await fetchPage(url);
    if (!page) continue;
    opened += 1;
    const matchedIdentity = identityMatch(name, page);
    if (!matchedIdentity) continue;
    const window = contextWindow(name, page);
    if (!window) continue;
    const normalizedWindow = normalize(window);
    const matchedTerms = [...new Set(terms.filter((term) => normalizedWindow.includes(normalize(term))))];
    windows.push({ url, host: hostOf(url), sourceFamily: sourceFamilyOf(url), matchedIdentity, text: window, terms: matchedTerms });
  }
  return {
    attempted,
    opened,
    windows,
    rule: "Deep evidence is accepted only from bounded public HTML pages where the candidate identity appears and evaluated terms occur inside a local context window. Wikidata official website P856 is preferred alongside canonical sitelinks. Language editions of the same publisher share one source family and never count as independent corroboration.",
  };
}
