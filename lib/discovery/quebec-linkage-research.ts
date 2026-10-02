import type { ResearchLead } from "./research-collectors";

export type QuebecLinkagePieceType =
  | "NUMBERING_CONCORDANCE"
  | "DIRECTORY"
  | "CADASTRAL_PLAN"
  | "ARCHIVAL_PLAN"
  | "PROPERTY_OWNER"
  | "NEIGHBOR_ANCHOR"
  | "STREET_ALIGNMENT"
  | "LOT_REFERENCE"
  | "OTHER";

export type QuebecLinkagePiece = {
  type: QuebecLinkagePieceType;
  url: string;
  title: string;
  host: string;
  snippet: string;
  matchedTerms: string[];
  authorityWeight: number;
};

export type QuebecLinkageResearchResult = {
  lead: ResearchLead;
  pieces: QuebecLinkagePiece[];
  strongestTypes: QuebecLinkagePieceType[];
  score: number;
  status: "LINKAGE_FOUND" | "PARTIAL_LINKAGE" | "NO_LINKAGE";
  reasons: string[];
};

const USER_AGENT = "VelvetPassportPredatorQuebecLinkage/2.0 (historical address linkage; fail closed)";
const AUTHORITY_HINTS = [
  "ville.quebec.qc.ca",
  "banq.qc.ca",
  "advitam.banq.qc.ca",
  "patrimoine-culturel.gouv.qc.ca",
  "donneesquebec.ca",
  "mrnf.gouv.qc.ca",
  "bibliotheque",
  "archives",
];

const PIECE_TERMS: Record<QuebecLinkagePieceType, string[]> = {
  NUMBERING_CONCORDANCE: ["concordance", "ancien numéro", "ancien numero", "nouveau numéro", "nouveau numero", "renumérotation", "renumerotation", "numérotation", "numerotation"],
  DIRECTORY: ["annuaire", "directory", "Lovell", "adresse", "occupant", "résident", "resident"],
  CADASTRAL_PLAN: ["cadastre", "plan cadastral", "lot", "parcelle", "matrice graphique"],
  ARCHIVAL_PLAN: ["plan", "carte", "atlas", "terrier", "arpentage"],
  PROPERTY_OWNER: ["propriétaire", "proprietaire", "owner", "vendu", "vente", "shérif", "sherif"],
  NEIGHBOR_ANCHOR: ["en face", "face à", "face a", "coin de", "angle de", "voisin", "adjacent", "près de", "pres de"],
  STREET_ALIGNMENT: ["alignement", "élargissement", "elargissement", "tracé", "trace", "emprise"],
  LOT_REFERENCE: ["lot", "cadastre", "numéro de lot", "numero de lot", "matricule"],
  OTHER: [],
};

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return "unknown"; }
}
function authorityWeight(host: string) {
  return AUTHORITY_HINTS.some((hint) => host.includes(hint)) ? 2 : 1;
}
function xmlItems(xml: string) {
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  const read = (block: string, tag: string) => {
    const match = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i"));
    return stripHtml((match?.[1] ?? "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
  };
  return blocks.map((block) => ({
    title: read(block, "title"),
    link: read(block, "link"),
    description: read(block, "description"),
  })).filter((item) => item.title && item.link);
}
async function fetchWithTimeout(url: string, timeoutMs = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "application/rss+xml,text/xml,*/*" },
      signal: controller.signal,
      next: { revalidate: 86400 },
    });
  } finally {
    clearTimeout(timer);
  }
}
function pieceTypes(text: string): Array<{ type: QuebecLinkagePieceType; terms: string[] }> {
  const n = normalize(text);
  const hits: Array<{ type: QuebecLinkagePieceType; terms: string[] }> = [];
  for (const [type, terms] of Object.entries(PIECE_TERMS) as Array<[QuebecLinkagePieceType, string[]]>) {
    if (type === "OTHER") continue;
    const matched = terms.filter((term) => n.includes(normalize(term)));
    if (matched.length) hits.push({ type, terms: matched });
  }
  return hits;
}
function querySet(lead: ResearchLead) {
  const name = lead.name;
  const address = lead.address ?? "";
  return [
    `"${name}" Québec ancien numéro adresse`,
    `"${name}" Québec annuaire adresse`,
    `"${name}" Québec cadastre plan lot`,
    `"${name}" Québec propriétaire plan`,
    address ? `"${address}" Québec concordance ancien nouveau numéro` : "",
    address ? `"${address}" Québec plan cadastral lot` : "",
    `"${name}" site:ville.quebec.qc.ca archives plan`,
    `"${name}" site:advitam.banq.qc.ca plan`,
    `"${name}" site:patrimoine-culturel.gouv.qc.ca`,
  ].filter(Boolean);
}

export async function researchQuebecLinkagePieces(
  leads: ResearchLead[],
  maxLeads = 4,
): Promise<{ results: QuebecLinkageResearchResult[]; rule: string }> {
  const results: QuebecLinkageResearchResult[] = [];

  for (const lead of leads.slice(0, maxLeads)) {
    const found: QuebecLinkagePiece[] = [];

    for (const query of querySet(lead)) {
      try {
        const response = await fetchWithTimeout(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`);
        if (!response.ok) continue;
        const xml = await response.text();
        for (const item of xmlItems(xml).slice(0, 8)) {
          const combined = `${item.title} ${item.description}`;
          const types = pieceTypes(combined);
          if (!types.length) continue;
          const host = hostOf(item.link);
          for (const hit of types) {
            found.push({
              type: hit.type,
              url: item.link,
              title: item.title,
              host,
              snippet: item.description.slice(0, 500),
              matchedTerms: hit.terms,
              authorityWeight: authorityWeight(host),
            });
          }
        }
      } catch {
        // Network/search failures remain unknown.
      }
    }

    const deduped = found.filter((piece, index, all) =>
      all.findIndex((other) => other.url === piece.url && other.type === piece.type) === index
    );
    const strongestTypes = [...new Set(
      deduped
        .sort((a, b) => b.authorityWeight - a.authorityWeight)
        .map((piece) => piece.type)
    )];
    const authorityPieces = deduped.filter((piece) => piece.authorityWeight >= 2);
    const score = Math.min(100, strongestTypes.length * 12 + authorityPieces.length * 8 + Math.min(20, deduped.length * 2));
    const status: QuebecLinkageResearchResult["status"] =
      strongestTypes.length >= 2 && authorityPieces.length >= 1
        ? "LINKAGE_FOUND"
        : deduped.length
          ? "PARTIAL_LINKAGE"
          : "NO_LINKAGE";

    results.push({
      lead,
      pieces: deduped.slice(0, 20),
      strongestTypes,
      score,
      status,
      reasons: [
        status === "LINKAGE_FOUND"
          ? "Predator found multiple linkage-piece families, including at least one authoritative/local source."
          : status === "PARTIAL_LINKAGE"
            ? "Potential linkage pieces were found, but the chain is not yet strong enough for exact continuity."
            : "No usable linkage piece was recovered from the allocated searches.",
        "Search hits are leads, not continuity proof. Exact numbering/parcel continuity still requires the underlying document to support the claimed relation.",
      ],
    });
  }

  return {
    results,
    rule:
      "When Quebec micro-location is blocked, Predator must actively hunt linkage pieces (numbering concordances, directories, cadastral/archival plans, owner records, neighbor anchors and street alignment evidence) rather than merely reporting that they are missing. Search hits remain leads until the underlying source proves continuity.",
  };
}
