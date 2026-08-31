import type { ResearchLead } from "./research-collectors";

export type HistoryEvidenceStatus = "CONFIRMED" | "PARTIAL" | "UNCONFIRMED";

export type HistoryEvidenceResult = {
  lead: ResearchLead;
  status: HistoryEvidenceStatus;
  score: number;
  evidenceUrls: string[];
  independentSources: number;
  matchedHistoryTerms: string[];
  reasons: string[];
};

const USER_AGENT = "VelvetPassportHistoryLayer/1.0 (place history verification; cached public search)";
const HISTORY_TERMS = [
  "history", "historic", "historical", "founded", "built", "constructed", "opened", "former", "formerly",
  "architect", "architecture", "atelier", "workshop", "printing", "imprimerie", "hotel particulier", "hôtel particulier",
  "residence", "lived", "born", "died", "writer", "artist", "composer", "owner", "occupied", "restored", "renovated",
  "origin", "origins", "century", "siècle", "heritage", "patrimoine", "monument historique", "listed monument",
  "legend", "tradition", "event", "revolution", "war", "medieval", "renaissance", "haussmann"
];

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "unknown"; }
}

function xmlItems(xml: string) {
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  const read = (block: string, tag: string) => {
    const match = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i"));
    return stripHtml((match?.[1] ?? "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
  };
  return blocks.map((block) => ({ title: read(block, "title"), link: read(block, "link"), description: read(block, "description") })).filter((item) => item.title && item.link);
}

async function fetchWithTimeout(url: string, timeoutMs = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "application/rss+xml,text/xml,*/*" }, signal: controller.signal, next: { revalidate: 86400 } });
  } finally { clearTimeout(timer); }
}

function placeLike(lead: ResearchLead) {
  return Boolean(lead.address) || (typeof lead.lat === "number" && typeof lead.lon === "number");
}

export async function enrichHistoryEvidence(leads: ResearchLead[], maxLookups = 6) {
  const eligible = leads.filter(placeLike).slice(0, Math.max(1, Math.min(maxLookups, 12)));
  const results: HistoryEvidenceResult[] = [];
  let lookups = 0;

  for (const lead of leads) {
    if (!eligible.includes(lead)) {
      results.push({ lead, status: "UNCONFIRMED", score: 0, evidenceUrls: [], independentSources: 0, matchedHistoryTerms: [], reasons: ["History research was not allocated to this candidate or the place identity is not resolved."] });
      continue;
    }

    const queries = [
      `\"${lead.name}\" Paris history heritage`,
      `\"${lead.name}\" Paris histoire patrimoine architecte`,
    ];
    const evidence: Array<{ text: string; url: string; host: string }> = [];

    for (const query of queries) {
      lookups += 1;
      try {
        const response = await fetchWithTimeout(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`);
        if (!response.ok) continue;
        const xml = await response.text();
        for (const item of xmlItems(xml).slice(0, 8)) {
          const text = normalize(`${item.title} ${item.description}`);
          const nameToken = normalize(lead.name).split(" ").filter(Boolean)[0] ?? "";
          if (nameToken && !text.includes(nameToken)) continue;
          evidence.push({ text, url: item.link, host: hostOf(item.link) });
        }
      } catch {
        // Failure leaves history unconfirmed.
      }
    }

    const matchedHistoryTerms = [...new Set(HISTORY_TERMS.filter((term) => evidence.some((item) => item.text.includes(normalize(term)))))];
    const relevant = evidence.filter((item) => HISTORY_TERMS.some((term) => item.text.includes(normalize(term))));
    const sources = [...new Set(relevant.map((item) => item.host))];
    const evidenceUrls = [...new Set(relevant.map((item) => item.url))].slice(0, 8);
    const score = Math.min(100, matchedHistoryTerms.length * 8 + Math.min(48, sources.length * 24));
    const status: HistoryEvidenceStatus = score >= 64 && sources.length >= 2 ? "CONFIRMED" : score >= 28 ? "PARTIAL" : "UNCONFIRMED";
    const historyClaim = matchedHistoryTerms.length
      ? `HISTORY_EVIDENCE: terms=${matchedHistoryTerms.slice(0, 10).join(", ")} | independent_sources=${sources.length} | status=${status}`
      : `HISTORY_EVIDENCE: status=${status}`;

    results.push({
      lead: { ...lead, rawClaims: [...lead.rawClaims, historyClaim] },
      status,
      score,
      evidenceUrls,
      independentSources: sources.length,
      matchedHistoryTerms,
      reasons: [status === "CONFIRMED" ? "Historical depth is supported by at least two independent sources." : status === "PARTIAL" ? "Historical clues exist, but corroboration is incomplete." : "No reliable historical depth was established from the allocated searches."],
    });
  }

  return {
    results,
    leads: results.map((item) => item.lead),
    confirmed: results.filter((item) => item.status === "CONFIRMED"),
    partial: results.filter((item) => item.status === "PARTIAL"),
    unconfirmed: results.filter((item) => item.status === "UNCONFIRMED"),
    lookups,
    rule: "History is a value signal and research lead, not a publication fact by itself. Confirmed history requires corroboration; legends and local traditions must remain explicitly labeled as such unless independently established.",
  };
}
