export type InternalPoiCategory = "restaurant" | "cafe" | "pharmacy";

export type InternalPoi = {
  id: string;
  name: string;
  category: InternalPoiCategory;
  address: string;
  zone: string;
  routeIds: string[];
  priority: number;
  note: string;
};

function routeIds(prefix: string) {
  return [1, 2, 3, 4, 5].map((index) => `${prefix}-${index}`);
}

export const INTERNAL_POI_CATALOG: InternalPoi[] = [
  {
    id: "louvre-relais",
    name: "Le Relais du Louvre",
    category: "restaurant",
    address: "3 Rue du Louvre, 75001 Paris",
    zone: "Louvre & Opéra",
    routeIds: routeIds("louvre-opera"),
    priority: 92,
    note: "Reliable central brasserie close to the Louvre corridor.",
  },
  {
    id: "louvre-kitsune",
    name: "Café Kitsuné Palais Royal",
    category: "cafe",
    address: "51 Galerie de Montpensier, 75001 Paris",
    zone: "Louvre & Opéra",
    routeIds: routeIds("louvre-opera"),
    priority: 90,
    note: "Compact café inside the Palais-Royal route area.",
  },
  {
    id: "louvre-pharmacy-opera",
    name: "Pharmacie Avenue de l'Opéra",
    category: "pharmacy",
    address: "20 Avenue de l'Opéra, 75001 Paris",
    zone: "Louvre & Opéra",
    routeIds: routeIds("louvre-opera"),
    priority: 96,
    note: "Central pharmacy convenient for Louvre and Opéra routes.",
  },

  {
    id: "marais-bourguignon",
    name: "Au Bourguignon du Marais",
    category: "restaurant",
    address: "52 Rue François Miron, 75004 Paris",
    zone: "Le Marais",
    routeIds: routeIds("marais"),
    priority: 93,
    note: "Established French brasserie on a route-friendly Marais axis.",
  },
  {
    id: "marais-cafeotheque",
    name: "La Caféothèque de Paris",
    category: "cafe",
    address: "52 Rue de l'Hôtel de Ville, 75004 Paris",
    zone: "Le Marais",
    routeIds: routeIds("marais"),
    priority: 88,
    note: "Coffee stop close to the eastern Marais and Seine edge.",
  },
  {
    id: "marais-pharmacy-pont-louis-philippe",
    name: "Pharmacie du Pont Louis Philippe",
    category: "pharmacy",
    address: "26 Rue du Pont Louis-Philippe, 75004 Paris",
    zone: "Le Marais",
    routeIds: routeIds("marais"),
    priority: 95,
    note: "Neighborhood pharmacy positioned inside the eastern Marais corridor.",
  },

  {
    id: "sgp-brasserie-des-pres",
    name: "Brasserie des Prés",
    category: "restaurant",
    address: "6 Cour du Commerce Saint-André, 75006 Paris",
    zone: "Saint-Germain-des-Prés",
    routeIds: routeIds("saint-germain"),
    priority: 91,
    note: "Directly aligned with the Passage Dauphine / Odéon route area.",
  },
  {
    id: "sgp-flore",
    name: "Café de Flore",
    category: "cafe",
    address: "172 Boulevard Saint-Germain, 75006 Paris",
    zone: "Saint-Germain-des-Prés",
    routeIds: routeIds("saint-germain"),
    priority: 84,
    note: "Historic café used as a dependable landmark and seated stop.",
  },
  {
    id: "sgp-citypharma",
    name: "Citypharma",
    category: "pharmacy",
    address: "26 Rue du Four, 75006 Paris",
    zone: "Saint-Germain-des-Prés",
    routeIds: routeIds("saint-germain"),
    priority: 96,
    note: "Large central pharmacy within the Saint-Germain route cluster.",
  },

  {
    id: "montmartre-chez-marie",
    name: "Chez Marie",
    category: "restaurant",
    address: "22 Rue Lepic, 75018 Paris",
    zone: "Montmartre",
    routeIds: routeIds("montmartre"),
    priority: 89,
    note: "Neighborhood French option below the hill with broad opening hours.",
  },
  {
    id: "montmartre-immersion",
    name: "Immersion Montmartre",
    category: "cafe",
    address: "93 Rue des Martyrs, 75018 Paris",
    zone: "Montmartre",
    routeIds: routeIds("montmartre"),
    priority: 88,
    note: "Daytime coffee and brunch stop near the Abbesses side.",
  },
  {
    id: "montmartre-caulaincourt",
    name: "Aprium Pharmacie Caulaincourt",
    category: "pharmacy",
    address: "106 Rue Caulaincourt, 75018 Paris",
    zone: "Montmartre",
    routeIds: routeIds("montmartre"),
    priority: 96,
    note: "Strong fit for the quieter Caulaincourt and Lamarck routes.",
  },

  {
    id: "latin-kozy",
    name: "Kozy Notre-Dame",
    category: "restaurant",
    address: "6 Rue du Petit Pont, 75005 Paris",
    zone: "Quartier latin",
    routeIds: routeIds("latin-quarter"),
    priority: 89,
    note: "Useful daytime food option near the northern Latin Quarter routes.",
  },
  {
    id: "latin-nouvelle-mairie",
    name: "Café de la Nouvelle Mairie",
    category: "cafe",
    address: "19 Rue des Fossés Saint-Jacques, 75005 Paris",
    zone: "Quartier latin",
    routeIds: routeIds("latin-quarter"),
    priority: 87,
    note: "Quiet seated café close to Panthéon-side routes.",
  },
  {
    id: "latin-maubert",
    name: "Pharmacie Maubert - Côté Pharma",
    category: "pharmacy",
    address: "50 Boulevard Saint-Germain, 75005 Paris",
    zone: "Quartier latin",
    routeIds: routeIds("latin-quarter"),
    priority: 95,
    note: "Practical pharmacy near Maubert-Mutualité and the river edge.",
  },

  {
    id: "seine-maslow",
    name: "Maslow 1er",
    category: "restaurant",
    address: "14 Quai de la Mégisserie, 75001 Paris",
    zone: "Bords de Seine",
    routeIds: routeIds("seine"),
    priority: 90,
    note: "River-facing restaurant useful for central Seine routes.",
  },
  {
    id: "seine-cafeotheque",
    name: "La Caféothèque de Paris",
    category: "cafe",
    address: "52 Rue de l'Hôtel de Ville, 75004 Paris",
    zone: "Bords de Seine",
    routeIds: routeIds("seine"),
    priority: 87,
    note: "Reliable coffee stop near the eastern central Seine routes.",
  },
  {
    id: "seine-pharmacy-pont-louis-philippe",
    name: "Pharmacie du Pont Louis Philippe",
    category: "pharmacy",
    address: "26 Rue du Pont Louis-Philippe, 75004 Paris",
    zone: "Bords de Seine",
    routeIds: routeIds("seine"),
    priority: 94,
    note: "Practical pharmacy close to Île Saint-Louis and Hôtel de Ville routes.",
  },
];

export function getInternalPois(routeId: string | null | undefined, zone: string, category: InternalPoiCategory) {
  return INTERNAL_POI_CATALOG
    .filter((poi) => poi.category === category && (poi.routeIds.includes(routeId ?? "") || poi.zone === zone))
    .sort((a, b) => b.priority - a.priority);
}
