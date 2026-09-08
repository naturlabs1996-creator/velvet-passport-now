export type PublicSearchResult = {
  title: string;
  link: string;
  description: string;
  provider: "DUCKDUCKGO_HTML" | "BING_RSS";
};

const USER_AGENT = "Mozilla/5.0 (compatible; VelvetPassportResearch/1.0; +https://velvetpassport.com)";

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeDuckDuckGoLink(raw: string) {
  const decoded = raw.replace(/&amp;/g, "&");
  try {
    const absolute = decoded.startsWith("//") ? `https:${decoded}` : decoded;
    const url = new URL(absolute, "https://html.duckduckgo.com");
    const target = url.searchParams.get("uddg");
    if (target && /^https?:\/\//i.test(target)) return target;
    if (/^https?:\/\//i.test(absolute) && !url.hostname.endsWith("duckduckgo.com")) return absolute;
  } catch { /* fall through */ }
  return decoded;
}

function parseDuckDuckGo(html: string): PublicSearchResult[] {
  const results: PublicSearchResult[] = [];
  const blocks = html.split(/class=["']result(?:\s|["'])/i).slice(1);
  for (const block of blocks.slice(0, 15)) {
    const anchor = block.match(/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)
      ?? block.match(/<a[^>]+href=["']([^"']+)["'][^>]+class=["'][^"']*result__a[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!anchor) continue;
    const link = decodeDuckDuckGoLink(anchor[1]);
    if (!/^https?:\/\//i.test(link)) continue;
    const title = stripHtml(anchor[2]);
    const snippet = block.match(/class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)(?:<\/a>|<\/div>|<\/td>)/i)?.[1] ?? "";
    results.push({ title, link, description: stripHtml(snippet), provider: "DUCKDUCKGO_HTML" });
  }
  return results;
}

function parseBingRss(xml: string): PublicSearchResult[] {
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  const read = (block: string, tag: string) => {
    const match = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i"));
    return stripHtml(match?.[1] ?? "");
  };
  return blocks.map((block) => ({
    title: read(block, "title"),
    link: read(block, "link"),
    description: read(block, "description"),
    provider: "BING_RSS" as const,
  })).filter((item) => item.title && /^https?:\/\//i.test(item.link));
}

async function fetchWithTimeout(url: string, accept: string, timeoutMs = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept, "accept-language": "fr-FR,fr;q=0.9,en;q=0.7" },
      signal: controller.signal,
      redirect: "follow",
      next: { revalidate: 21600 },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function searchPublicWeb(query: string, maxResults = 10): Promise<{ provider: string; results: PublicSearchResult[] }> {
  const limit = Math.max(1, Math.min(maxResults, 12));

  try {
    const response = await fetchWithTimeout(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5");
    if (response.ok) {
      const parsed = parseDuckDuckGo(await response.text()).slice(0, limit);
      if (parsed.length > 0) return { provider: "DUCKDUCKGO_HTML", results: parsed };
    }
  } catch { /* provider failure remains unknown */ }

  try {
    const response = await fetchWithTimeout(`https://www.bing.com/search?format=rss&setlang=fr-FR&cc=fr&q=${encodeURIComponent(query)}`, "application/rss+xml,text/xml,*/*");
    if (response.ok) {
      const parsed = parseBingRss(await response.text()).slice(0, limit);
      return { provider: "BING_RSS", results: parsed };
    }
  } catch { /* provider failure remains unknown */ }

  return { provider: "NONE", results: [] };
}
