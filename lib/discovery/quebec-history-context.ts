export type QuebecHistoryEra = {
  id: string;
  label: string;
  from: number;
  to?: number;
  searchAnchors: string[];
  urbanThemes: string[];
  caution?: string[];
};

export const QUEBEC_CITY_HISTORY_ERAS: QuebecHistoryEra[] = [
  {
    id: "pre-1608",
    label: "Indigenous presence / Stadacona context before the French settlement",
    from: 0,
    to: 1607,
    searchAnchors: ["Stadacona", "Saint-Laurent", "cap Diamant", "présence autochtone"],
    urbanThemes: ["river narrows", "topography", "pre-colonial occupation", "archaeology"],
    caution: ["Do not collapse Indigenous history into a preface to French settlement; require appropriate archaeological or institutional evidence."],
  },
  {
    id: "1608-1662",
    label: "Founding settlement and trading-post Quebec",
    from: 1608,
    to: 1662,
    searchAnchors: ["Champlain", "Habitation", "Place Royale", "traite", "fort Saint-Louis"],
    urbanThemes: ["Lower Town", "river trade", "first habitation", "early fortification", "religious foundations"],
  },
  {
    id: "1663-1758",
    label: "Royal government / capital of New France",
    from: 1663,
    to: 1758,
    searchAnchors: ["Nouvelle-France", "Conseil souverain", "intendant", "Frontenac", "Chaussegros de Léry", "commerce", "incendie"],
    urbanThemes: ["Upper Town institutions", "Lower Town commerce", "fortifications", "religious communities", "artisan and merchant life", "parcel evolution"],
  },
  {
    id: "1759-1763",
    label: "Siege, Conquest and regime transition",
    from: 1759,
    to: 1763,
    searchAnchors: ["siège de Québec", "1759", "Plaines d'Abraham", "Murray", "Lévis", "1760"],
    urbanThemes: ["military damage", "occupation", "reconstruction", "defensive geography", "property continuity through regime change"],
  },
  {
    id: "1763-1790",
    label: "Early British regime",
    from: 1763,
    to: 1790,
    searchAnchors: ["régime britannique", "garnison", "marchands britanniques", "Quebec Act", "1775", "Montgomery", "Arnold"],
    urbanThemes: ["military reuse", "commercial transition", "religious continuity", "Lower Town attack routes", "administrative change"],
  },
  {
    id: "1791-1840",
    label: "Lower Canada / fortified colonial capital",
    from: 1791,
    to: 1840,
    searchAnchors: ["Bas-Canada", "Parlement", "Citadelle", "garnison", "Cap Diamant", "immigration"],
    urbanThemes: ["parliamentary city", "citadel construction", "port expansion", "timber trade", "immigrant arrival", "public health", "fires"],
  },
  {
    id: "1840-1866",
    label: "Port, shipbuilding, urban growth and great fires",
    from: 1840,
    to: 1866,
    searchAnchors: ["port de Québec", "construction navale", "bois", "immigration irlandaise", "incendie", "Saint-Roch", "Saint-Sauveur"],
    urbanThemes: ["working-class districts", "shipyards", "warehouses", "markets", "industrializing suburbs", "disaster reconstruction"],
  },
  {
    id: "1867-1913",
    label: "Provincial capital, preservation and industrial modernization",
    from: 1867,
    to: 1913,
    searchAnchors: ["Confédération", "Assemblée législative", "Dufferin", "tramway", "industrialisation", "port", "Québec 1908"],
    urbanThemes: ["heritage preservation", "demolition/reconstruction of gates", "civic institutions", "streetcar city", "factories", "hotels", "tourism emergence"],
  },
  {
    id: "1914-1959",
    label: "20th-century city before the Quiet Revolution",
    from: 1914,
    to: 1959,
    searchAnchors: ["guerre", "crise", "tramway", "syndicat", "industrie", "quartiers ouvriers", "Duplessis"],
    urbanThemes: ["labour", "transport", "commercial streets", "municipal modernization", "housing", "entertainment", "war economy"],
  },
  {
    id: "1960-present",
    label: "Quiet Revolution and contemporary Quebec City",
    from: 1960,
    searchAnchors: ["Révolution tranquille", "Parlement", "autoroute", "rénovation urbaine", "patrimoine", "Vieux-Québec", "Saint-Roch"],
    urbanThemes: ["urban renewal", "heritage policy", "government expansion", "demolition and preservation", "festival/tourism economy", "neighbourhood reinvention"],
  },
];

export const QUEBEC_CITY_AUTHORITY_SOURCES = [
  {
    id: "quebec-city-archives",
    label: "Archives de la Ville de Québec",
    authority: "Ville de Québec",
    url: "https://www.ville.quebec.qc.ca/citoyens/patrimoine/archives/",
    roles: ["PRIMARY_ARCHIVES", "MAPS", "PLANS", "PHOTOGRAPHS", "TEXTUAL_RECORDS"],
  },
  {
    id: "quebec-rpcq",
    label: "Répertoire du patrimoine culturel du Québec",
    authority: "Ministère de la Culture et des Communications",
    url: "https://www.patrimoine-culturel.gouv.qc.ca/",
    roles: ["HERITAGE", "BUILDING_HISTORY", "SITE_HISTORY", "PERSON_EVENT_LINKS"],
  },
  {
    id: "quebec-banq",
    label: "Bibliothèque et Archives nationales du Québec",
    authority: "BAnQ",
    url: "https://www.banq.qc.ca/",
    roles: ["PRIMARY_ARCHIVES", "NEWSPAPERS", "MAPS", "PLANS", "ICONOGRAPHY"],
  },
  {
    id: "quebec-parks-canada",
    label: "Parks Canada historic sites",
    authority: "Parks Canada",
    url: "https://parks.canada.ca/",
    roles: ["MILITARY_HISTORY", "FORTIFICATIONS", "ARCHAEOLOGY", "SITE_HISTORY"],
  },
  {
    id: "quebec-dbc",
    label: "Dictionary of Canadian Biography / Dictionnaire biographique du Canada",
    authority: "University of Toronto / Université Laval",
    url: "https://www.biographi.ca/",
    roles: ["BIOGRAPHY", "PERSON_EVENT_CONTEXT"],
  },
];

export function quebecHistoryEraForYear(year?: number) {
  if (!year || !Number.isFinite(year)) return undefined;
  return QUEBEC_CITY_HISTORY_ERAS.find((era) => year >= era.from && (era.to === undefined || year <= era.to));
}

export const QUEBEC_HISTORY_CONTEXT_RULE =
  "Historical context is a search accelerator, never evidence. Predator may use era knowledge to generate queries, names, institutions, urban themes and contradiction checks, but every publishable claim still requires attached sources. Context must never manufacture a story or repair missing micro-location evidence.";
