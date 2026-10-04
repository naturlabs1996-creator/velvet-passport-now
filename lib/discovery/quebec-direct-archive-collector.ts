import type { ForeuseDocument, ForeuseFamilyStats, ForeuseTarget } from "./foreuse-core";

const USER_AGENT = "VelvetPassportForeuse/0.3 (direct archive catalogue; evidence leads only)";

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLinks(html: string, base: string) {
  const out: string[] = [];
  const re = /href=["']([^"'#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 250) {
    try {
      const u = new URL(m[1], base);
      if (!/^https?:$/.test(u.protocol)) continue;
      u.hash = "";
      out.push(u.toString());
    } catch {}
  }
  return [...new Set(out)];
}

async function getText(url: string, timeoutMs = 9000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/json,text/plain,*/*", "accept-language": "fr-CA,fr;q=0.9,en;q=0.6" },
      redirect: "follow",
      signal: c.signal,
      next: { revalidate: 21600 },
    });
    if (!r.ok) return null;
    return { text: await r.text(), contentType: r.headers.get("content-type") ?? "" };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function tokens(target: ForeuseTarget) {
  const generic = new Set(["quebec","canada","saint","roch","rue","historical","historique","location","localisation","determine","present","current"]);
  return [...new Set(normalize([target.subject, target.location, ...(target.knownFacts ?? [])].filter(Boolean).join(" "))
    .split(/[^a-z0-9]+/)
    .filter((x) => x.length >= 4 && !generic.has(x) && !/^\d+$/.test(x)))];
}

function signals(text: string) {
  const n = normalize(text);
  const out: string[] = [];
  const rules: Array<[string, RegExp]> = [
    ["ADDRESS", /\b\d{1,5}\s+(?:rue|avenue|boulevard|chemin|cote|place|quai)\b/],
    ["LOT", /\b(?:lot|cadastre|parcelle|matrice|matricule)\b/],
    ["PLAN", /\b(?:plan|atlas|carte|arpentage|terrier|alignement)\b/],
    ["DIRECTORY", /\b(?:annuaire|lovell|adresse civique|numero civique)\b/],
    ["OWNER", /\b(?:proprietaire|notaire|greffe|vente|cession|acquis)\b/],
    ["ARCHIVE", /\b(?:archives|fonds|cote|serie|dossier|piece|versement|contenant)\b/],
  ];
  for (const [name, re] of rules) if (re.test(n)) out.push(name);
  return out;
}

function score(target: ForeuseTarget, text: string, familyWeight: number) {
  const n = normalize(text);
  const matched = tokens(target).filter((x) => n.includes(x)).length;
  const s = signals(text).length;
  return Math.min(100, familyWeight * 4 + matched * 12 + s * 8);
}

function doc(target: ForeuseTarget, familyId: string, familyWeight: number, url: string, title: string, raw: string, links: string[] = []): ForeuseDocument | null {
  const text = stripHtml(raw).slice(0, 30000);
  const relevance = score(target, text, familyWeight);
  if (relevance < 30) return null;
  return {
    url,
    host: (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "unknown"; } })(),
    title,
    text,
    links,
    familyId,
    query: "DIRECT_CATALOGUE",
    relevance,
    evidenceSignals: signals(text),
    fetched: true,
  };
}

async function collectCkan(target: ForeuseTarget) {
  const documents: ForeuseDocument[] = [];
  const base = "https://www.donneesquebec.ca/recherche/api/3/action";
  const qs = [
    target.subject,
    target.location ?? "Québec",
    "Ville de Québec adresses",
    "Référentiel québécois des adresses",
    "cadastre Québec",
    "matrice graphique Québec",
    "bâtiments Ville de Québec",
  ];
  for (const q of [...new Set(qs)]) {
    const url = `${base}/package_search?q=${encodeURIComponent(q)}&rows=12`;
    const got = await getText(url);
    if (!got) continue;
    try {
      const json = JSON.parse(got.text);
      const results = json?.result?.results ?? [];
      for (const item of results) {
        const raw = JSON.stringify(item);
        const itemUrl = `https://www.donneesquebec.ca/recherche/dataset/${item.name}`;
        const d = doc(target, "DONNEES_QUEBEC", 8, itemUrl, item.title ?? item.name ?? "Données Québec", raw);
        if (d) documents.push(d);
      }
    } catch {}
  }

  for (const id of ["adresses-de-la-ville-de-quebec", "referentiel-quebecois-des-adresses"]) {
    const url = `${base}/package_show?id=${encodeURIComponent(id)}`;
    const got = await getText(url);
    if (!got) continue;
    try {
      const json = JSON.parse(got.text);
      const item = json?.result;
      if (!item) continue;
      const d = doc(target, id.includes("referentiel") ? "RQA" : "DONNEES_QUEBEC", 9, `https://www.donneesquebec.ca/recherche/dataset/${id}`, item.title ?? id, JSON.stringify(item));
      if (d) documents.push(d);
    } catch {}
  }
  return documents;
}

async function crawlAuthority(target: ForeuseTarget, familyId: string, familyWeight: number, roots: string[]) {
  const documents: ForeuseDocument[] = [];
  const seen = new Set<string>();
  const queue = roots.map((url) => ({ url, depth: 0 }));
  const wanted = tokens(target);
  while (queue.length && seen.size < 20) {
    const next = queue.shift()!;
    if (seen.has(next.url)) continue;
    seen.add(next.url);
    const got = await getText(next.url);
    if (!got) continue;
    const links = /html/i.test(got.contentType) ? extractLinks(got.text, next.url) : [];
    const d = doc(target, familyId, familyWeight, next.url, next.url, got.text, links.slice(0, 40));
    if (d) documents.push(d);
    if (next.depth >= 1) continue;
    const host = (() => { try { return new URL(next.url).hostname; } catch { return ""; } })();
    for (const link of links) {
      let same = false;
      try { same = new URL(link).hostname === host; } catch {}
      if (!same) continue;
      const path = normalize(link);
      if (wanted.some((t) => path.includes(t)) || /recher|archive|patrimoine|notice|result|fonds|collection|document/.test(path)) {
        queue.push({ url: link, depth: next.depth + 1 });
      }
      if (queue.length > 35) break;
    }
  }
  return documents;
}

export async function collectQuebecDirectArchives(target: ForeuseTarget) {
  const parts = await Promise.all([
    collectCkan(target),
    crawlAuthority(target, "ADVITAM", 10, [
      "https://advitam.banq.qc.ca/",
      "https://advitam.banq.qc.ca/aide/recherche-avancee",
    ]),
    crawlAuthority(target, "VILLE_QUEBEC", 9, [
      "https://www.ville.quebec.qc.ca/citoyens/patrimoine/archives/recherche/index.aspx",
    ]),
    crawlAuthority(target, "RPCQ", 9, [
      "https://www.patrimoine-culturel.gouv.qc.ca/",
    ]),
  ]);
  const all = parts.flat();
  const byUrl = new Map<string, ForeuseDocument>();
  for (const d of all) {
    const old = byUrl.get(d.url);
    if (!old || d.relevance > old.relevance) byUrl.set(d.url, d);
  }
  return [...byUrl.values()].sort((a, b) => b.relevance - a.relevance).slice(0, 30);
}

export function directFamilyStats(documents: ForeuseDocument[], target: ForeuseTarget): ForeuseFamilyStats[] {
  return target.sourceFamilies.map((family) => {
    const docs = documents.filter((d) => d.familyId === family.id);
    return {
      familyId: family.id,
      searches: docs.length ? 1 : 0,
      hits: docs.length,
      fetched: docs.filter((d) => d.fetched).length,
      useful: docs.filter((d) => d.relevance >= 45 || d.evidenceSignals.length >= 2).length,
      cumulativeRelevance: docs.reduce((sum, d) => sum + d.relevance, 0),
      yieldScore: docs.length ? Math.round(docs.reduce((sum, d) => sum + d.relevance, 0) / docs.length) : 0,
    };
  });
}
