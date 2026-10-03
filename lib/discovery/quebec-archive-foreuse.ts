import { runForeuse, type ForeuseResult, type ForeuseTarget } from "./foreuse-core";

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
    domains: ["mrnf.gouv.qc.ca"],
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

  return runForeuse(target, {
    maxQueries: 22,
    maxSearchHits: 8,
    maxFetches: 18,
    maxMappedLinks: 10,
  });
}

export const QUEBEC_ARCHIVE_FOREUSE_RULES = [
  "Prefer BAnQ/Advitam, municipal archives, RPCQ, Données Québec and RQA over generic web sources for historical micro-location.",
  "When a source family yields stronger address/lot/plan/owner evidence, reallocate search budget toward that family.",
  "A search or crawl hit is never parcel continuity proof by itself.",
  "Old civic-number continuity must be demonstrated, not assumed.",
  "A current building may serve as a spatial anchor without being treated as a material witness to an earlier event.",
] as const;
