import { runForeuse, type ForeuseResult, type ForeuseTarget } from "./foreuse-core";
import { collectQuebecDirectArchives, directFamilyStats } from "./quebec-direct-archive-collector";

const QUEBEC_SOURCE_FAMILIES = [
  {
    id: "ADVITAM",
    label: "BAnQ Advitam",
    domains: ["advitam.banq.qc.ca", "banq.qc.ca", "www2.banq.qc.ca"],
    weight: 10,
    queryHints: ["archives fonds dossier", "plan carte atlas", "nom personne lieu événement", "recherche avancée"],
  },
  {
    id: "VILLE_QUEBEC",
    label: "Ville de Québec archives and heritage",
    domains: ["ville.quebec.qc.ca"],
    weight: 9,
    queryHints: ["archives patrimoine plan rue", "ancien numéro civique", "histoire propriété bâtiment"],
  },
  {
    id: "RPCQ",
    label: "Répertoire du patrimoine culturel du Québec",
    domains: ["patrimoine-culturel.gouv.qc.ca"],
    weight: 9,
    queryHints: ["propriétaire adresse bâtiment", "historique lot rue", "personnage événement"],
  },
  {
    id: "DONNEES_QUEBEC",
    label: "Données Québec",
    domains: ["donneesquebec.ca", "www.donneesquebec.ca"],
    weight: 8,
    queryHints: ["adresses Ville de Québec", "matrice graphique", "empreintes bâtiments", "lieux publics"],
  },
  {
    id: "RQA",
    label: "Référentiel québécois des adresses",
    domains: ["mrnf.gouv.qc.ca", "donneesquebec.ca", "www.donneesquebec.ca"],
    weight: 8,
    queryHints: ["Référentiel québécois adresses", "odonyme renvoi", "adresse numéro civique"],
  },
] as const;

export type QuebecForeuseInput = {
  subject: string;
  objective: string;
  location?: string;
  knownFacts?: string[];
  fromYear?: number;
  toYear?: number;
};

export async function runQuebecArchiveForeuse(input: QuebecForeuseInput): Promise<ForeuseResult> {
  const target: ForeuseTarget = {
    subject: input.subject,
    objective: input.objective,
    location: input.location ?? "Québec, QC, Canada",
    knownFacts: input.knownFacts ?? [],
    dateRange: { from: input.fromYear, to: input.toYear },
    sourceFamilies: QUEBEC_SOURCE_FAMILIES.map((family) => ({ ...family, domains: [...family.domains], queryHints: [...family.queryHints] })),
    seedQueries: [
      `"${input.subject}" Québec archives`,
      `"${input.subject}" Québec plan ancien`,
      `"${input.subject}" Québec lot cadastre propriétaire`,
      `"${input.subject}" Québec annuaire adresse`,
    ],
  };

  const [indexed, directDocuments] = await Promise.all([
    runForeuse(target, {
      maxQueries: 16,
      maxSearchHits: 8,
      maxFetches: 14,
      maxMappedLinks: 8,
    }),
    collectQuebecDirectArchives(target),
  ]);

  const mergedByUrl = new Map(indexed.documents.map((d) => [d.url, d]));
  for (const d of directDocuments) {
    const old = mergedByUrl.get(d.url);
    if (!old || d.relevance > old.relevance) mergedByUrl.set(d.url, d);
  }
  const documents = [...mergedByUrl.values()].sort((a, b) => b.relevance - a.relevance).slice(0, 30);

  const directStats = directFamilyStats(directDocuments, target);
  const familyStats = target.sourceFamilies.map((family) => {
    const a = indexed.familyStats.find((s) => s.familyId === family.id);
    const b = directStats.find((s) => s.familyId === family.id);
    return {
      familyId: family.id,
      searches: (a?.searches ?? 0) + (b?.searches ?? 0),
      hits: (a?.hits ?? 0) + (b?.hits ?? 0),
      fetched: (a?.fetched ?? 0) + (b?.fetched ?? 0),
      useful: (a?.useful ?? 0) + (b?.useful ?? 0),
      cumulativeRelevance: (a?.cumulativeRelevance ?? 0) + (b?.cumulativeRelevance ?? 0),
      yieldScore: Math.max(a?.yieldScore ?? 0, b?.yieldScore ?? 0),
    };
  }).sort((x, y) => y.yieldScore - x.yieldScore);

  return {
    documents,
    familyStats,
    attemptedQueries: [...indexed.attemptedQueries, "DIRECT:CKAN", "DIRECT:ADVITAM", "DIRECT:VILLE_QUEBEC", "DIRECT:RPCQ"],
    generatedQueries: indexed.generatedQueries,
    droppedEarly: indexed.droppedEarly,
    rule: "Foreuse Québec v0.3 uses both indexed discovery and direct archive/catalogue collection. Direct catalogue hits remain leads until Predator verifies the underlying historical relation. Exact numbering/parcel continuity remains fail-closed.",
  };
}

export const QUEBEC_ARCHIVE_FOREUSE_RULES = [
  "Prefer direct BAnQ/Advitam, municipal archives, RPCQ, Données Québec CKAN and RQA catalogue access over generic web discovery for historical micro-location.",
  "When a source family yields stronger address/lot/plan/owner evidence, reallocate search budget toward that family.",
  "A search, catalogue, API or crawl hit is never parcel continuity proof by itself.",
  "Old civic-number continuity must be demonstrated, not assumed.",
  "A current building may serve as a spatial anchor without being treated as a material witness to an earlier event.",
] as const;
