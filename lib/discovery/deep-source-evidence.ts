export type DeepEvidenceWindow = {
  url: string;
  host: string;
  matchedIdentity: boolean;
  text: string;
  terms: string[];
};

const USER_AGENT = "VelvetPassportDeepEvidence/1.0 (bounded public source context verification; cached requests)";
const MAX_HTML_BYTES = 900_000;

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function hostOf(url: string) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "unknown"; } }
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
function contextWindow(name: string, text: string, radius = 700) {
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
    windows.push({ url, host: hostOf(url), matchedIdentity, text: window, terms: matchedTerms });
  }
  return {
    attempted,
    opened,
    windows,
    rule: "Deep evidence is accepted only from bounded public HTML pages where the candidate identity appears in the page and the evaluated terms occur inside a local context window around that identity. Fetch failure remains unknown and never creates evidence.",
  };
}
