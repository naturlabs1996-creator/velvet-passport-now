export type ForeuseSourceFamily = {
  id: string;
  label: string;
  domains: string[];
  weight: number;
  queryHints?: string[];
};

export type ForeuseTarget = {
  subject: string;
  objective: string;
  location?: string;
  knownFacts?: string[];
  dateRange?: { from?: number; to?: number };
  sourceFamilies: ForeuseSourceFamily[];
  seedQueries?: string[];
};

export type ForeuseDocument = {
  url: string;
  host: string;
  title: string;
  text: string;
  links: string[];
  familyId?: string;
  query: string;
  relevance: number;
  evidenceSignals: string[];
  fetched: boolean;
};

export type ForeuseFamilyStats = {
  familyId: string;
  searches: number;
  hits: number;
  fetched: number;
  useful: number;
  cumulativeRelevance: number;
  yieldScore: number;
};

export type ForeuseResult = {
  documents: ForeuseDocument[];
  familyStats: ForeuseFamilyStats[];
  attemptedQueries: string[];
  generatedQueries: string[];
  droppedEarly: number;
  rule: string;
};

const USER_AGENT = "VelvetPassportForeuse/0.1 (adaptive research; evidence leads only; fail closed)";

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
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return "unknown"; }
}

async function fetchWithTimeout(url: string, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml,application/xml,text/plain,*/*" },
      signal: controller.signal,
      next: { revalidate: 21600 },
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
}

function rssItems(xml: string) {
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  const read = (block: string, tag: string) => {
    const match = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i"));
    return stripHtml(match?.[1] ?? "");
  };
  return blocks.map((block) => ({
    title: read(block, "title"),
    link: read(block, "link"),
    description: read(block, "description"),
  })).filter((item) => item.title && item.link);
}

function extractLinks(html: string, baseUrl: string) {
  const links: string[] = [];
  const re = /href=["']([^"'#]+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) && links.length < 120) {
    try {
      const url = new URL(match[1], baseUrl);
      if (!/^https?:$/.test(url.protocol)) continue;
      url.hash = "";
      links.push(url.toString());
    } catch {}
  }
  return [...new Set(links)];
}

function targetTokens(target: ForeuseTarget) {
  const generic = new Set(["quebec","québec","canada","historique","historical","research","recherche","site","location","localisation"]);
  return normalize([target.subject, target.objective, target.location, ...(target.knownFacts ?? [])].filter(Boolean).join(" "))
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !generic.has(token) && !/^\d+$/.test(token));
}

function evidenceSignals(text: string) {
  const n = normalize(text);
  const rules: Array<[string, RegExp]> = [
    ["ADDRESS", /\b\d{1,5}\s+(?:rue|avenue|boulevard|chemin|cote|côte|place|quai)\b/i],
    ["LOT", /\b(?:lot|cadastre|parcelle|matrice|matricule)\b/i],
    ["PLAN", /\b(?:plan|atlas|carte|arpentage|terrier|alignement)\b/i],
    ["DIRECTORY", /\b(?:annuaire|directory|lovell|adresse civique|numero civique|numéro civique)\b/i],
    ["OWNER", /\b(?:proprietaire|propriétaire|vente|vendu|acquis|cession|notaire|greffe)\b/i],
    ["ARCHIVE", /\b(?:archives|fonds|cote|côté|serie|série|dossier|piece|pièce)\b/i],
    ["NEIGHBOR", /\b(?:en face|face a|face à|coin de|angle de|voisin|adjacent)\b/i],
  ];
  return rules.filter(([, re]) => re.test(n)).map(([label]) => label);
}

function relevanceScore(target: ForeuseTarget, text: string, familyWeight: number) {
  const n = normalize(text);
  const tokens = targetTokens(target);
  const matched = [...new Set(tokens.filter((token) => n.includes(token)))];
  const signals = evidenceSignals(text);
  const geo = target.location ? normalize(target.location).split(/[,\s]+/).filter((v) => v.length >= 4).some((v) => n.includes(v)) : true;
  const raw = matched.length * 10 + signals.length * 8 + (geo ? 10 : 0) + familyWeight * 4;
  return Math.min(100, raw);
}

function familyForUrl(url: string, families: ForeuseSourceFamily[]) {
  const host = hostOf(url);
  return families.find((family) => family.domains.some((domain) => host === domain || host.endsWith(`.${domain}`)));
}

function baseQueries(target: ForeuseTarget) {
  const dates = target.dateRange?.from || target.dateRange?.to
    ? `${target.dateRange?.from ?? ""} ${target.dateRange?.to ?? ""}`.trim()
    : "";
  return [...new Set([
    ...(target.seedQueries ?? []),
    `"${target.subject}" ${target.location ?? ""} ${dates}`.trim(),
    `"${target.subject}" plan cadastre lot ${target.location ?? ""}`.trim(),
    `"${target.subject}" annuaire adresse propriétaire ${target.location ?? ""}`.trim(),
    `"${target.subject}" archives notaire greffe ${target.location ?? ""}`.trim(),
  ].filter(Boolean))];
}

function adaptiveQueries(target: ForeuseTarget, family: ForeuseSourceFamily, bestDocs: ForeuseDocument[]) {
  const extraSignals = [...new Set(bestDocs.flatMap((doc) => doc.evidenceSignals))];
  const signalHints: Record<string, string> = {
    ADDRESS: "adresse numéro civique",
    LOT: "lot cadastre matrice",
    PLAN: "plan atlas alignement",
    DIRECTORY: "annuaire Lovell adresse",
    OWNER: "propriétaire notaire greffe vente",
    ARCHIVE: "archives fonds cote dossier",
    NEIGHBOR: "coin voisin en face",
  };
  const hints = extraSignals.map((signal) => signalHints[signal]).filter(Boolean).slice(0, 3);
  return [...new Set([
    ...(family.queryHints ?? []).map((hint) => `"${target.subject}" ${hint} ${target.location ?? ""}`.trim()),
    ...hints.map((hint) => `"${target.subject}" ${hint} ${target.location ?? ""}`.trim()),
  ])].slice(0, 5);
}

export async function runForeuse(
  target: ForeuseTarget,
  budget: { maxQueries?: number; maxSearchHits?: number; maxFetches?: number; maxMappedLinks?: number } = {},
): Promise<ForeuseResult> {
  const maxQueries = Math.max(4, Math.min(budget.maxQueries ?? 18, 40));
  const maxSearchHits = Math.max(3, Math.min(budget.maxSearchHits ?? 8, 15));
  const maxFetches = Math.max(2, Math.min(budget.maxFetches ?? 16, 30));
  const maxMappedLinks = Math.max(0, Math.min(budget.maxMappedLinks ?? 8, 20));
  const documents: ForeuseDocument[] = [];
  const attemptedQueries: string[] = [];
  const generatedQueries: string[] = [];
  const queue: Array<{ query: string; familyId?: string; priority: number }> = [];
  const seenQueries = new Set<string>();
  const seenUrls = new Set<string>();
  let fetches = 0;
  let droppedEarly = 0;

  const stats = new Map<string, ForeuseFamilyStats>();
  for (const family of target.sourceFamilies) {
    stats.set(family.id, { familyId: family.id, searches: 0, hits: 0, fetched: 0, useful: 0, cumulativeRelevance: 0, yieldScore: family.weight });
  }

  for (const query of baseQueries(target)) queue.push({ query, priority: 50 });
  for (const family of target.sourceFamilies) {
    for (const hint of family.queryHints ?? []) {
      for (const domain of family.domains.slice(0, 2)) {
        queue.push({ query: `site:${domain} "${target.subject}" ${hint} ${target.location ?? ""}`.trim(), familyId: family.id, priority: 60 + family.weight });
      }
    }
  }

  while (queue.length && attemptedQueries.length < maxQueries) {
    queue.sort((a, b) => b.priority - a.priority);
    const next = queue.shift()!;
    if (seenQueries.has(next.query)) continue;
    seenQueries.add(next.query);
    attemptedQueries.push(next.query);
    if (next.familyId) stats.get(next.familyId)!.searches++;

    try {
      const search = await fetchWithTimeout(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(next.query)}`);
      if (!search.ok) continue;
      const items = rssItems(await search.text()).slice(0, maxSearchHits);
      for (const item of items) {
        if (seenUrls.has(item.link)) continue;
        const family = familyForUrl(item.link, target.sourceFamilies);
        if (!family) { droppedEarly++; continue; }
        const snippetScore = relevanceScore(target, `${item.title} ${item.description}`, family.weight);
        if (snippetScore < 18) { droppedEarly++; continue; }
        seenUrls.add(item.link);
        const stat = stats.get(family.id)!;
        stat.hits++;

        let text = `${item.title} ${item.description}`;
        let links: string[] = [];
        let fetched = false;
        if (fetches < maxFetches) {
          try {
            const response = await fetchWithTimeout(item.link);
            if (response.ok) {
              const contentType = response.headers.get("content-type") ?? "";
              if (/html|text|xml|json/i.test(contentType)) {
                const raw = await response.text();
                text = `${item.title} ${stripHtml(raw).slice(0, 28000)}`;
                links = extractLinks(raw, item.link).slice(0, maxMappedLinks);
                fetched = true;
                fetches++;
                stat.fetched++;
              }
            }
          } catch {}
        }

        const relevance = relevanceScore(target, text, family.weight);
        const signals = evidenceSignals(text);
        if (relevance < 24) { droppedEarly++; continue; }
        if (relevance >= 42 || signals.length >= 2) stat.useful++;
        stat.cumulativeRelevance += relevance;
        stat.yieldScore = Math.round(((stat.useful * 24) + stat.cumulativeRelevance / Math.max(1, stat.hits)) + family.weight * 4);

        documents.push({
          url: item.link,
          host: hostOf(item.link),
          title: item.title,
          text: text.slice(0, 30000),
          links,
          familyId: family.id,
          query: next.query,
          relevance,
          evidenceSignals: signals,
          fetched,
        });

        // Firecrawl-style map/crawl behavior, but bounded: map only same-authority links
        // and convert promising child links into new targeted search queries instead of blindly crawling.
        if (relevance >= 55) {
          const mapped = links
            .filter((url) => familyForUrl(url, target.sourceFamilies)?.id === family.id)
            .slice(0, 4);
          for (const url of mapped) {
            const pathWords = decodeURIComponent(new URL(url).pathname).replace(/[-_/]+/g, " ").trim();
            if (pathWords.length < 5) continue;
            const q = `site:${hostOf(url)} "${target.subject}" "${pathWords.slice(0, 80)}"`;
            if (!seenQueries.has(q)) queue.push({ query: q, familyId: family.id, priority: 72 + Math.min(20, relevance / 5) });
          }
        }
      }
    } catch {}

    // Adaptive reallocation: after each search, push more budget toward families producing useful evidence.
    const ranked = [...stats.values()].sort((a, b) => b.yieldScore - a.yieldScore).slice(0, 2);
    for (const stat of ranked) {
      if (stat.hits === 0) continue;
      const family = target.sourceFamilies.find((item) => item.id === stat.familyId);
      if (!family) continue;
      const bestDocs = documents.filter((doc) => doc.familyId === family.id).sort((a, b) => b.relevance - a.relevance).slice(0, 3);
      for (const query of adaptiveQueries(target, family, bestDocs)) {
        if (seenQueries.has(query)) continue;
        generatedQueries.push(query);
        queue.push({ query, familyId: family.id, priority: 65 + Math.min(25, stat.yieldScore / 5) });
      }
    }
  }

  const familyStats = [...stats.values()].map((stat) => ({
    ...stat,
    yieldScore: Math.max(0, Math.round(stat.yieldScore)),
  })).sort((a, b) => b.yieldScore - a.yieldScore);

  return {
    documents: documents.sort((a, b) => b.relevance - a.relevance).slice(0, 30),
    familyStats,
    attemptedQueries,
    generatedQueries: [...new Set(generatedQueries)].slice(0, 30),
    droppedEarly,
    rule: "Foreuse Core may search, map, fetch, triage and adapt query allocation, but every discovered page remains a lead until Predator verifies the underlying evidence. Adaptive yield may change search budget; it may never weaken evidence gates, Access/Exposure gates or fail-closed behavior.",
  };
}
