export type LocalTrustSourceKind =
  | "official-hygiene"
  | "official-sanction"
  | "official-closure"
  | "official-police-justice"
  | "official-registry";

export type LocalTrustSource = {
  id: string;
  city: "montreal" | "paris";
  label: string;
  kind: LocalTrustSourceKind;
  authority: string;
  canonicalUrl: string;
  primary: boolean;
  notes: string;
};

export const LOCAL_TRUST_SOURCES: LocalTrustSource[] = [
  {
    id: "montreal-food-inspections",
    city: "montreal",
    label: "Ville de Montréal / MAPAQ food inspection data",
    kind: "official-hygiene",
    authority: "Ville de Montréal / MAPAQ",
    canonicalUrl: "https://donnees.montreal.ca/",
    primary: true,
    notes: "Use establishment identity plus address/business identifier. Absence of an adverse record is not treated as proof of perfect hygiene.",
  },
  {
    id: "montreal-food-offenders",
    city: "montreal",
    label: "Inspection des aliments — contrevenants",
    kind: "official-sanction",
    authority: "Ville de Montréal / MAPAQ",
    canonicalUrl: "https://donnees.montreal.ca/ville-de-montreal/inspection-aliments-contrevenants",
    primary: true,
    notes: "Use for convictions, serious infractions and enforcement history. Match by establishment identity, not name alone.",
  },
  {
    id: "paris-alimconfiance",
    city: "paris",
    label: "Alim’confiance",
    kind: "official-hygiene",
    authority: "Ministère de l’Agriculture",
    canonicalUrl: "https://alimconfiance.agriculture.gouv.fr/",
    primary: true,
    notes: "Primary Paris restaurant hygiene source. Preserve the official four-level classification and control date. Never infer a better status than the published result.",
  },
  {
    id: "paris-alimconfiance-open-data",
    city: "paris",
    label: "Alim’confiance open data",
    kind: "official-registry",
    authority: "Ministère de l’Agriculture / data.gouv.fr",
    canonicalUrl: "https://www.data.gouv.fr/datasets/resultats-des-controles-officiels-sanitaires-dispositif-dinformation-alimconfiance",
    primary: true,
    notes: "Machine-readable source for matching establishment name/address and retrieving inspection date plus official hygiene level.",
  },
  {
    id: "paris-prefecture-enforcement",
    city: "paris",
    label: "Préfecture de Paris / services de l’État",
    kind: "official-closure",
    authority: "Préfecture de la région d’Île-de-France, préfecture de Paris",
    canonicalUrl: "https://www.prefectures-regions.gouv.fr/ile-de-france/",
    primary: false,
    notes: "Use as a complementary source for administrative closures, serious enforcement actions and exceptional safety measures when a named establishment is implicated.",
  },
  {
    id: "paris-police-justice",
    city: "paris",
    label: "Official police / justice publications",
    kind: "official-police-justice",
    authority: "French police, justice or competent State authority",
    canonicalUrl: "https://www.interieur.gouv.fr/",
    primary: false,
    notes: "Use only for serious named cases supported by an official publication. Never treat media reports alone as an official adverse record.",
  },
];

export function getLocalTrustSources(city: LocalTrustSource["city"]) {
  return LOCAL_TRUST_SOURCES.filter((source) => source.city === city);
}

export function getPrimaryLocalTrustSources(city: LocalTrustSource["city"]) {
  return getLocalTrustSources(city).filter((source) => source.primary);
}
