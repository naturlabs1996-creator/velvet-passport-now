import { INTERNAL_POI_CATALOG, type InternalPoi, type InternalPoiCategory } from "./internal-catalog";

const SUPPLEMENTAL_POIS: InternalPoi[] = [
  // MARAIS — close route 2/3 food + pharmacy gaps.
  { id: "audit-mar-derriere", name: "Derrière", category: "restaurant", address: "69 Rue des Gravilliers, 75003 Paris", zone: "Le Marais", routeIds: ["marais-2", "marais-3"], priority: 99, note: "Verified quiet restaurant directly on the Gravilliers / Arts-et-Métiers corridor." },
  { id: "audit-mar-pharm-arts", name: "Pharmacie des Arts et Métiers", category: "pharmacy", address: "11 Rue Bailly, 75003 Paris", zone: "Le Marais", routeIds: ["marais-2", "marais-3"], priority: 99, note: "Verified pharmacy beside Arts et Métiers for northern Marais routes." },
  { id: "audit-mar-pharm-beaubourg", name: "Pharmacie Pharmavance Beaubourg", category: "pharmacy", address: "54 Rue Beaubourg, 75003 Paris", zone: "Le Marais", routeIds: ["marais-2", "marais-3"], priority: 95, note: "Second northern Marais pharmacy so NOW can stay internal-first." },

  // SAINT-GERMAIN — close route 5 food/cafe gaps.
  { id: "audit-sg-nemrod", name: "Le Nemrod", category: "restaurant", address: "51 Rue du Cherche-Midi, 75006 Paris", zone: "Saint-Germain-des-Prés", routeIds: ["saint-germain-5"], priority: 99, note: "Verified continuous-service neighborhood bistrot directly on Cherche-Midi." },
  { id: "audit-sg-vavin-food", name: "Café Vavin", category: "restaurant", address: "18 Rue Vavin, 75006 Paris", zone: "Saint-Germain-des-Prés", routeIds: ["saint-germain-5"], priority: 97, note: "Verified food option at Vavin / Notre-Dame-des-Champs." },
  { id: "audit-sg-vavin-cafe", name: "Café Vavin", category: "cafe", address: "18 Rue Vavin, 75006 Paris", zone: "Saint-Germain-des-Prés", routeIds: ["saint-germain-5"], priority: 98, note: "Verified seated café exactly on the Vavin end of the route." },

  // MONTMARTRE — close route 3/4/5 gaps.
  { id: "audit-mon-au-relais", name: "Au Relais", category: "restaurant", address: "48 Rue Lamarck, 75018 Paris", zone: "Montmartre", routeIds: ["montmartre-3", "montmartre-5"], priority: 99, note: "Verified 7-day neighborhood bistrot on Lamarck / Mont-Cenis." },
  { id: "audit-mon-dose", name: "Dose Lamarck", category: "cafe", address: "74 Rue Lamarck, 75018 Paris", zone: "Montmartre", routeIds: ["montmartre-3", "montmartre-5"], priority: 99, note: "Verified specialty café at Lamarck-Caulaincourt." },
  { id: "audit-mon-pharm-abbesses", name: "Pharmacie des Abbesses", category: "pharmacy", address: "34 Rue des Abbesses, 75018 Paris", zone: "Montmartre", routeIds: ["montmartre-4"], priority: 99, note: "Verified active pharmacy for the Abbesses / atelier-side route." },

  // QUARTIER LATIN — close route 2/4/5 food + pharmacy gaps.
  { id: "audit-lat-hugo", name: "Hugo & Co", category: "restaurant", address: "48 Rue Monge, 75005 Paris", zone: "Quartier latin", routeIds: ["latin-quarter-2", "latin-quarter-4", "latin-quarter-5"], priority: 98, note: "Verified active restaurant on Monge, useful for eastern and Panthéon routes." },
  { id: "audit-lat-pharm-monge", name: "Pharmacie Monge Notre-Dame", category: "pharmacy", address: "1 Place Monge, 75005 Paris", zone: "Quartier latin", routeIds: ["latin-quarter-4"], priority: 99, note: "Verified pharmacy at Place Monge for Mouffetard / Tournefort route." },

  // BORDS DE SEINE — close route 3/4/5 gaps.
  { id: "audit-sei-empire-food", name: "Café de l'Empire", category: "restaurant", address: "17 Rue du Bac, 75007 Paris", zone: "Bords de Seine", routeIds: ["seine-3"], priority: 99, note: "Verified all-day food stop on Rue du Bac for the western Seine route." },
  { id: "audit-sei-empire-cafe", name: "Café de l'Empire", category: "cafe", address: "17 Rue du Bac, 75007 Paris", zone: "Bords de Seine", routeIds: ["seine-3"], priority: 99, note: "Verified café directly on the Rue du Bac corridor." },
  { id: "audit-sei-pharm-bac", name: "La Grande Pharmacie du Bac", category: "pharmacy", address: "70 Rue du Bac, 75007 Paris", zone: "Bords de Seine", routeIds: ["seine-3"], priority: 99, note: "Verified pharmacy with broad hours on Rue du Bac." },
  { id: "audit-sei-chez-julien", name: "Chez Julien", category: "restaurant", address: "1 Rue du Pont Louis-Philippe, 75004 Paris", zone: "Bords de Seine", routeIds: ["seine-4", "seine-5"], priority: 98, note: "Verified restaurant on the eastern Seine / Hôtel-de-Ville corridor." },
];

// Audit-approved extensions of existing POIs to an adjacent route where the address
// is still naturally on the route cluster. This avoids unnecessary duplicate records.
const ROUTE_EXTENSIONS: Record<string, string[]> = {
  "lou-daroco": ["louvre-opera-2"],
  "mar-breizh": ["marais-2"],
  "sg-cafe-auteur": ["saint-germain-4"],
  "lat-sourire": ["latin-quarter-4"],
};

function extendedBaseCatalog(): InternalPoi[] {
  return INTERNAL_POI_CATALOG.map((poi) => {
    const additions = ROUTE_EXTENSIONS[poi.id] ?? [];
    if (!additions.length) return poi;
    return { ...poi, routeIds: Array.from(new Set([...poi.routeIds, ...additions])) };
  });
}

export const EFFECTIVE_INTERNAL_POI_CATALOG: InternalPoi[] = [
  ...extendedBaseCatalog(),
  ...SUPPLEMENTAL_POIS,
];

export function getEffectiveInternalPois(routeId: string | null | undefined, zone: string, category: InternalPoiCategory) {
  const direct = EFFECTIVE_INTERNAL_POI_CATALOG
    .filter((poi) => poi.category === category && poi.routeIds.includes(routeId ?? ""))
    .sort((a, b) => b.priority - a.priority);

  const target = category === "pharmacy" ? 2 : 3;
  if (direct.length >= target) return direct;

  const fallback = EFFECTIVE_INTERNAL_POI_CATALOG
    .filter((poi) => poi.category === category && poi.zone === zone && !direct.some((match) => match.id === poi.id))
    .sort((a, b) => b.priority - a.priority);

  return [...direct, ...fallback];
}

export type CoverageRow = {
  routeId: string;
  restaurant: number;
  cafe: number;
  pharmacy: number;
  minimumHealthy: boolean;
};

export function auditEffectiveCoverage(): CoverageRow[] {
  const prefixes = ["louvre-opera", "marais", "saint-germain", "montmartre", "latin-quarter", "seine"];
  const rows: CoverageRow[] = [];
  for (const prefix of prefixes) {
    for (let index = 1; index <= 5; index += 1) {
      const routeId = `${prefix}-${index}`;
      const count = (category: InternalPoiCategory) => EFFECTIVE_INTERNAL_POI_CATALOG.filter((poi) => poi.category === category && poi.routeIds.includes(routeId)).length;
      const restaurant = count("restaurant");
      const cafe = count("cafe");
      const pharmacy = count("pharmacy");
      rows.push({ routeId, restaurant, cafe, pharmacy, minimumHealthy: restaurant >= 2 && cafe >= 1 && pharmacy >= 1 });
    }
  }
  return rows;
}
