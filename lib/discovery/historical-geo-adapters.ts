import type { HistoricalGeoAdapter } from "./historical-geo-adapter";

export const PARIS_HISTORICAL_GEO_ADAPTER: HistoricalGeoAdapter = {
  cityId: "paris-fr",
  cityLabel: "Paris",
  countryCode: "FR",
  languageHints: ["fr"],
  streetTypes: ["rue", "quai", "boulevard", "avenue", "place", "passage", "impasse", "cour", "allée", "square", "chemin", "route"],
  capabilities: [
    "STREET_LINEAGE",
    "CURRENT_ADDRESS",
    "CURRENT_PARCEL",
    "CURRENT_ENTRANCE",
    "HISTORICAL_PARCEL",
    "HISTORICAL_MAP",
    "NUMBERING_HISTORY",
    "ALIGNMENT_HISTORY",
  ],
  sources: [
    {
      id: "paris-street-current",
      label: "Dénominations et emprises des voies actuelles",
      authority: "Ville de Paris",
      sourceType: "OFFICIAL_OPEN_DATA",
      capabilities: ["STREET_LINEAGE", "NUMBERING_HISTORY", "ALIGNMENT_HISTORY", "HISTORICAL_MAP"],
      url: "https://opendata.paris.fr/",
      automated: true,
    },
    {
      id: "paris-street-former",
      label: "Dénominations des voies caduques",
      authority: "Ville de Paris",
      sourceType: "OFFICIAL_OPEN_DATA",
      capabilities: ["STREET_LINEAGE"],
      url: "https://opendata.paris.fr/",
      automated: true,
    },
    {
      id: "paris-ban",
      label: "Base Adresse Nationale - Paris",
      authority: "Ville de Paris / BAN",
      sourceType: "OFFICIAL_OPEN_DATA",
      capabilities: ["CURRENT_ADDRESS", "CURRENT_PARCEL"],
      url: "https://opendata.paris.fr/",
      automated: true,
    },
    {
      id: "paris-portes-cocheres",
      label: "Plan de voirie - Portes cochères",
      authority: "Ville de Paris",
      sourceType: "OFFICIAL_OPEN_DATA",
      capabilities: ["CURRENT_ENTRANCE"],
      url: "https://opendata.paris.fr/",
      automated: true,
    },
    {
      id: "paris-archives-parcellaire",
      label: "Plans parcellaires et Atlas Vasserot",
      authority: "Archives de Paris",
      sourceType: "OFFICIAL_ARCHIVE",
      capabilities: ["HISTORICAL_PARCEL", "HISTORICAL_MAP", "NUMBERING_HISTORY", "ALIGNMENT_HISTORY"],
      url: "https://archives.paris.fr/",
      automated: false,
      notes: ["Requires image/plan inspection and georeferencing for exact parcel continuity."],
    },
  ],
  rules: {
    sameNumberIsContinuityProof: false,
    currentParcelIsHistoricalParcelProof: false,
    currentEntranceIsHistoricalEntranceProof: false,
    requireIndependentHistoricalGeometryForExactMatch: true,
  },
};

export const MONTREAL_HISTORICAL_GEO_ADAPTER: HistoricalGeoAdapter = {
  cityId: "montreal-ca",
  cityLabel: "Montréal",
  countryCode: "CA",
  languageHints: ["fr", "en"],
  streetTypes: ["rue", "avenue", "boulevard", "chemin", "place", "côte", "montée", "terrasse", "carré", "voie"],
  capabilities: [
    "STREET_LINEAGE",
    "CURRENT_ADDRESS",
    "CURRENT_PARCEL",
    "HISTORICAL_MAP",
  ],
  sources: [
    {
      id: "montreal-toponymy",
      label: "Répertoire historique des toponymes montréalais",
      authority: "Ville de Montréal",
      sourceType: "OFFICIAL_HERITAGE",
      capabilities: ["STREET_LINEAGE"],
      url: "https://montreal.ca/services/recherche-dun-toponyme",
      automated: false,
      notes: ["Use historical notices and cited principal source; do not infer parcel continuity from naming history alone."],
    },
    {
      id: "montreal-open-data",
      label: "Portail des données ouvertes",
      authority: "Ville de Montréal",
      sourceType: "OFFICIAL_OPEN_DATA",
      capabilities: ["CURRENT_ADDRESS", "CURRENT_PARCEL"],
      url: "https://donnees.montreal.ca/",
      automated: true,
      notes: ["Dataset-specific bindings still need to be added before production use."],
    },
    {
      id: "montreal-evalweb",
      label: "Rôle d'évaluation foncière / Evalweb",
      authority: "Ville de Montréal",
      sourceType: "OFFICIAL_REGISTRY",
      capabilities: ["CURRENT_ADDRESS", "CURRENT_PARCEL"],
      url: "https://montreal.ca/demarches/consulter-les-roles-devaluation-fonciere",
      automated: false,
      notes: ["Can resolve a property from address, lot number or matricule."],
    },
    {
      id: "montreal-heritage",
      label: "Bases de données sur le patrimoine",
      authority: "Ville de Montréal",
      sourceType: "OFFICIAL_HERITAGE",
      capabilities: ["HISTORICAL_MAP"],
      url: "https://montreal.ca/services/consultation-des-bases-de-donnees-sur-le-patrimoine",
      automated: false,
    },
  ],
  rules: {
    sameNumberIsContinuityProof: false,
    currentParcelIsHistoricalParcelProof: false,
    currentEntranceIsHistoricalEntranceProof: false,
    requireIndependentHistoricalGeometryForExactMatch: true,
  },
};

export const HISTORICAL_GEO_ADAPTERS = {
  [PARIS_HISTORICAL_GEO_ADAPTER.cityId]: PARIS_HISTORICAL_GEO_ADAPTER,
  [MONTREAL_HISTORICAL_GEO_ADAPTER.cityId]: MONTREAL_HISTORICAL_GEO_ADAPTER,
} as const;

export function getHistoricalGeoAdapter(cityId: keyof typeof HISTORICAL_GEO_ADAPTERS) {
  return HISTORICAL_GEO_ADAPTERS[cityId];
}
