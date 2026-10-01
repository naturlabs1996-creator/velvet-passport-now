import type { ResearchLead } from "./research-collectors";

export type PhysicalEntityGateDecision = {
  lead: ResearchLead;
  decision: "KEEP" | "REJECT" | "UNKNOWN_KEEP";
  qid?: string;
  instanceOf: string[];
  reasons: string[];
};

const USER_AGENT = "VelvetPassportPhysicalEntityGate/1.0 (Wikidata P31 non-place rejection; cached public data)";
const API = "https://www.wikidata.org/w/api.php";

const HARD_REJECT_P31 = new Set([
  "Q5", // human
  "Q11424", // film
  "Q7366", // song
  "Q482994", // album
  "Q134556", // single
  "Q2188189", // musical work
  "Q7725634", // literary work
  "Q17537576", // creative work
  "Q1656682", // event
  "Q1190554", // occurrence
  "Q4167410", // Wikimedia disambiguation page
  "Q13406463", // Wikimedia list article
]);

const STRONG_PHYSICAL_P31 = new Set([
  "Q33506", // museum
  "Q41176", // building
  "Q811979", // architectural structure
  "Q57660343", // performing arts venue
  "Q24354", // theatre
  "Q22698", // park
  "Q1107656", // garden
  "Q11315", // shopping mall / arcade-ish commercial building
  "Q7075", // library
  "Q16970", // church building
  "Q39614", // cemetery
  "Q174782", // square
  "Q79007", // street
  "Q355304", // watercourse/canal-like physical feature
]);

function qidOf(lead: ResearchLead) {
  return lead.rawClaims.map((claim) => claim.match(/^WIKIDATA_ENTITY\s+(Q\d+)$/i)?.[1]).find(Boolean);
}

function isVenuePoolSeed(lead: ResearchLead) {
  return lead.rawClaims.includes("VENUE_POOL_DISCOVERY_ONLY") || lead.id.startsWith("venue-");
}

function chunks<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function fetchWithTimeout(url: string, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "application/json" },
      signal: controller.signal,
      next: { revalidate: 21600 },
    });
  } finally {
    clearTimeout(timer);
  }
}

type Claim = { mainsnak?: { datavalue?: { value?: { id?: string } } } };
type Entity = { claims?: { P31?: Claim[] } };

async function loadInstanceOf(qids: string[]) {
  const result = new Map<string, string[]>();
  for (const batch of chunks([...new Set(qids)], 40)) {
    try {
      const params = new URLSearchParams({
        action: "wbgetentities",
        ids: batch.join("|"),
        props: "claims",
        format: "json",
        origin: "*",
      });
      const response = await fetchWithTimeout(`${API}?${params}`);
      if (!response.ok) continue;
      const json = await response.json() as { entities?: Record<string, Entity> };
      for (const qid of batch) {
        const ids = (json.entities?.[qid]?.claims?.P31 ?? [])
          .map((claim) => claim.mainsnak?.datavalue?.value?.id)
          .filter((value): value is string => Boolean(value));
        result.set(qid, [...new Set(ids)]);
      }
    } catch {
      // Unknown type is fail-soft for discovery, never a truth promotion.
    }
  }
  return result;
}

export async function applyPhysicalEntityTypeGate(leads: ResearchLead[]) {
  const qids = leads.map(qidOf).filter((value): value is string => Boolean(value));
  const instanceMap = await loadInstanceOf(qids);
  const decisions: PhysicalEntityGateDecision[] = leads.map((lead) => {
    const qid = qidOf(lead);
    if (isVenuePoolSeed(lead)) {
      return { lead, qid, instanceOf: qid ? instanceMap.get(qid) ?? [] : [], decision: "KEEP" as const, reasons: ["Venue-pool seed already passed physical-category plus Paris-coordinate discovery constraints; downstream truth gates remain mandatory."] };
    }
    if (!qid) {
      return { lead, instanceOf: [], decision: "UNKNOWN_KEEP" as const, reasons: ["No Wikidata QID is available, so the type gate cannot reject this candidate on P31 alone."] };
    }
    const instanceOf = instanceMap.get(qid) ?? [];
    const rejectedType = instanceOf.find((type) => HARD_REJECT_P31.has(type));
    if (rejectedType) {
      return { lead, qid, instanceOf, decision: "REJECT" as const, reasons: [`Wikidata P31 ${rejectedType} identifies a hard non-place entity class before geo/intent budget is spent.`] };
    }
    if (instanceOf.some((type) => STRONG_PHYSICAL_P31.has(type))) {
      return { lead, qid, instanceOf, decision: "KEEP" as const, reasons: ["Wikidata P31 contains a recognized physical-place/venue class."] };
    }
    return { lead, qid, instanceOf, decision: "UNKNOWN_KEEP" as const, reasons: ["Wikidata P31 is not a hard-reject class; candidate remains discoverable but receives no physical-type credit."] };
  });

  return {
    leads: decisions.filter((item) => item.decision !== "REJECT").map((item) => item.lead),
    rejected: decisions.filter((item) => item.decision === "REJECT"),
    decisions,
    rule: "Physical Entity Type Gate V1.0 rejects only explicit hard non-place Wikidata P31 classes such as humans and creative works before resolver/intent budgets are spent. Unknown classes fail soft and gain no truth or relevance credit. Venue-pool seeds keep their discovery status because they already passed category+Paris-coordinate constraints, but all downstream verification remains mandatory.",
  };
}
