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

function routes(prefix: string, ...indices: number[]) {
  return indices.map((index) => `${prefix}-${index}`);
}

const ALL = [1, 2, 3, 4, 5];

export const INTERNAL_POI_CATALOG: InternalPoi[] = [
  // LOUVRE & OPERA
  { id: "lou-daroco", name: "DAROCO Bourse", category: "restaurant", address: "6 Rue Vivienne, 75002 Paris", zone: "Louvre & Opéra", routeIds: routes("louvre-opera", 1, 3, 4, 5), priority: 95, note: "Strong fit for Vivienne, Bourse and covered-passage routes." },
  { id: "lou-grand-colbert", name: "Le Grand Colbert", category: "restaurant", address: "2 Rue Vivienne, 75002 Paris", zone: "Louvre & Opéra", routeIds: routes("louvre-opera", 1, 3, 4), priority: 91, note: "Classic seated option directly on the Vivienne corridor." },
  { id: "lou-juveniles", name: "Juveniles", category: "restaurant", address: "47 Rue de Richelieu, 75001 Paris", zone: "Louvre & Opéra", routeIds: routes("louvre-opera", 2, 3, 4, 5), priority: 93, note: "Compact restaurant well placed between Palais-Royal and Opéra back streets." },
  { id: "lou-shin", name: "Café Shin Palais Royal", category: "cafe", address: "28 Bis Rue de Richelieu, 75001 Paris", zone: "Louvre & Opéra", routeIds: routes("louvre-opera", 2, 3, 4, 5), priority: 95, note: "Calm specialty-coffee stop close to Palais-Royal." },
  { id: "lou-kitsune", name: "Café Kitsuné Palais Royal", category: "cafe", address: "51 Galerie de Montpensier, 75001 Paris", zone: "Louvre & Opéra", routeIds: routes("louvre-opera", 1, 2, 3, 4), priority: 92, note: "Compact stop directly inside the Palais-Royal route cluster." },
  { id: "lou-pharm-palais", name: "Pharmacie du Palais Royal", category: "pharmacy", address: "164 Rue Saint-Honoré, 75001 Paris", zone: "Louvre & Opéra", routeIds: routes("louvre-opera", ...ALL), priority: 98, note: "Very central pharmacy close to Louvre and Palais-Royal." },
  { id: "lou-pharm-opera", name: "Pharmacie Opéra Garnier - Choiseul", category: "pharmacy", address: "23 Rue de Choiseul, 75002 Paris", zone: "Louvre & Opéra", routeIds: routes("louvre-opera", 1, 4, 5), priority: 96, note: "Useful later-opening option for Choiseul and Opéra-side routes." },
  { id: "lou-pharm-victoire", name: "Pharmacie Louvre Victoire", category: "pharmacy", address: "7 Rue Coq Héron, 75001 Paris", zone: "Louvre & Opéra", routeIds: routes("louvre-opera", 2, 3, 4), priority: 94, note: "Alternative pharmacy for Louvre-Rivoli and Place des Victoires side." },

  // LE MARAIS
  { id: "mar-bourguignon", name: "Au Bourguignon du Marais", category: "restaurant", address: "52 Rue François Miron, 75004 Paris", zone: "Le Marais", routeIds: routes("marais", 1, 4, 5), priority: 95, note: "Dependable French stop on the eastern Marais axis." },
  { id: "mar-breizh", name: "Breizh Café Le Marais", category: "restaurant", address: "109 Rue Vieille du Temple, 75003 Paris", zone: "Le Marais", routeIds: routes("marais", 1, 3, 5), priority: 91, note: "Useful seated option for Temple and northern Marais routes." },
  { id: "mar-les-philosophes", name: "Les Philosophes", category: "restaurant", address: "28 Rue Vieille du Temple, 75004 Paris", zone: "Le Marais", routeIds: routes("marais", 4, 5), priority: 90, note: "Central Marais fallback near the south-western route cluster." },
  { id: "mar-trinci", name: "trinci - café d'artisan", category: "cafe", address: "33 Rue de Montmorency, 75003 Paris", zone: "Le Marais", routeIds: routes("marais", 2, 3), priority: 97, note: "Small calm coffee stop particularly suited to Montmorency and artisan routes." },
  { id: "mar-tanat", name: "Tanat - Archives", category: "cafe", address: "96 Rue des Archives, 75003 Paris", zone: "Le Marais", routeIds: routes("marais", 1, 3, 5), priority: 94, note: "Specialty coffee aligned with the Archives corridor." },
  { id: "mar-cafeotheque", name: "La Caféothèque de Paris", category: "cafe", address: "52 Rue de l'Hôtel de Ville, 75004 Paris", zone: "Le Marais", routeIds: routes("marais", 4, 5), priority: 92, note: "Strong eastern Marais / Seine-edge coffee fallback." },
  { id: "mar-pharm-rivoli", name: "Pharmacie Rivoli", category: "pharmacy", address: "13 Rue de Rivoli, 75004 Paris", zone: "Le Marais", routeIds: routes("marais", 1, 4, 5), priority: 97, note: "Central Saint-Paul pharmacy with broad hours." },
  { id: "mar-pharm-pont", name: "Pharmacie du Pont Louis Philippe", category: "pharmacy", address: "26 Rue du Pont Louis-Philippe, 75004 Paris", zone: "Le Marais", routeIds: routes("marais", 4, 5), priority: 96, note: "Best aligned with François-Miron and Hôtel-de-Ville side." },

  // SAINT-GERMAIN-DES-PRES
  { id: "sg-brasserie-pres", name: "Brasserie des Prés", category: "restaurant", address: "6 Cour du Commerce Saint-André, 75006 Paris", zone: "Saint-Germain-des-Prés", routeIds: routes("saint-germain", 1, 2, 3), priority: 95, note: "Directly aligned with Odéon and Cour du Commerce routes." },
  { id: "sg-semilla", name: "Semilla", category: "restaurant", address: "54 Rue de Seine, 75006 Paris", zone: "Saint-Germain-des-Prés", routeIds: routes("saint-germain", 2, 3, 4), priority: 93, note: "Good fit for Rue de Seine and gallery-side routes." },
  { id: "sg-fish", name: "Fish La Boissonnerie", category: "restaurant", address: "69 Rue de Seine, 75006 Paris", zone: "Saint-Germain-des-Prés", routeIds: routes("saint-germain", 1, 2, 4), priority: 90, note: "Compact option within the western Saint-Germain cluster." },
  { id: "sg-cafe-auteur", name: "Café d'Auteur", category: "cafe", address: "39 Rue Mazarine, 75006 Paris", zone: "Saint-Germain-des-Prés", routeIds: routes("saint-germain", 1, 2, 3), priority: 97, note: "Specialty coffee close to Mazarine and Odéon routes." },
  { id: "sg-yog-matcha", name: "Yog&Matcha", category: "cafe", address: "64 Rue Mazarine, 75006 Paris", zone: "Saint-Germain-des-Prés", routeIds: routes("saint-germain", 1, 2, 3), priority: 92, note: "Quiet café alternative on Rue Mazarine." },
  { id: "sg-citypharma", name: "Citypharma", category: "pharmacy", address: "26 Rue du Four, 75006 Paris", zone: "Saint-Germain-des-Prés", routeIds: routes("saint-germain", 1, 2, 3, 4), priority: 98, note: "Large central pharmacy for most Saint-Germain routes." },
  { id: "sg-delpech", name: "Pharmacie Delpech", category: "pharmacy", address: "5 Rue Danton, 75006 Paris", zone: "Saint-Germain-des-Prés", routeIds: routes("saint-germain", 1, 2), priority: 94, note: "Useful independent pharmacy near Odéon and Danton." },
  { id: "sg-ndc", name: "Pharmacie Notre Dame des Champs", category: "pharmacy", address: "112 Rue Notre Dame des Champs, 75006 Paris", zone: "Saint-Germain-des-Prés", routeIds: routes("saint-germain", 5), priority: 96, note: "Better fit for the southern Cherche-Midi / Vavin route." },

  // MONTMARTRE
  { id: "mon-poulbot", name: "Le Poulbot", category: "restaurant", address: "3 Rue Poulbot, 75018 Paris", zone: "Montmartre", routeIds: routes("montmartre", 1, 2, 4), priority: 94, note: "Small classic bistro close to the upper-hill routes." },
  { id: "mon-coq-rico", name: "Le Coq & Fils", category: "restaurant", address: "98 Rue Lepic, 75018 Paris", zone: "Montmartre", routeIds: routes("montmartre", 1, 2, 5), priority: 92, note: "Strong food option for Lepic, Saules and Caulaincourt side." },
  { id: "mon-bouillon", name: "Bouillon Pigalle", category: "restaurant", address: "22 Boulevard de Clichy, 75018 Paris", zone: "Montmartre", routeIds: routes("montmartre", 3, 4), priority: 86, note: "High-capacity fallback below the hill when upper routes are busy." },
  { id: "mon-crema", name: "CREMA Café Montmartre", category: "cafe", address: "20 Rue Durantin, 75018 Paris", zone: "Montmartre", routeIds: routes("montmartre", 1, 2, 4), priority: 96, note: "Calm neighborhood-style café between Abbesses and upper Montmartre." },
  { id: "mon-immersion", name: "Immersion Montmartre", category: "cafe", address: "93 Rue des Martyrs, 75018 Paris", zone: "Montmartre", routeIds: routes("montmartre", 3, 4), priority: 90, note: "Useful daytime café on the lower eastern approach." },
  { id: "mon-pharm-caulaincourt", name: "Aprium Pharmacie Caulaincourt", category: "pharmacy", address: "106 Rue Caulaincourt, 75018 Paris", zone: "Montmartre", routeIds: routes("montmartre", 1, 2, 3, 5), priority: 98, note: "Primary pharmacy for Lamarck, Damrémont and Caulaincourt routes." },
  { id: "mon-pharm-radja", name: "Pharmacie Radja", category: "pharmacy", address: "63 Rue Damrémont, 75018 Paris", zone: "Montmartre", routeIds: routes("montmartre", 3, 5), priority: 94, note: "Quiet neighborhood pharmacy for Damrémont-side routes." },

  // QUARTIER LATIN
  { id: "lat-kozy", name: "Kozy Notre-Dame", category: "restaurant", address: "6 Rue du Petit Pont, 75005 Paris", zone: "Quartier latin", routeIds: routes("latin-quarter", 1, 2), priority: 92, note: "Useful daytime option for the northern Latin Quarter." },
  { id: "lat-bouillon-racine", name: "Bouillon Racine", category: "restaurant", address: "3 Rue Racine, 75006 Paris", zone: "Quartier latin", routeIds: routes("latin-quarter", 3, 5), priority: 91, note: "Historic seated option near Sorbonne and Panthéon-side routes." },
  { id: "lat-sourire", name: "Le Petit Prince de Paris", category: "restaurant", address: "12 Rue de Lanneau, 75005 Paris", zone: "Quartier latin", routeIds: routes("latin-quarter", 1, 3), priority: 89, note: "Small restaurant directly aligned with Lanneau and Carmes streets." },
  { id: "lat-nouvelle-mairie", name: "Café de la Nouvelle Mairie", category: "cafe", address: "19 Rue des Fossés Saint-Jacques, 75005 Paris", zone: "Quartier latin", routeIds: routes("latin-quarter", 2, 3, 5), priority: 95, note: "Calm seated stop close to Panthéon routes." },
  { id: "lat-strada", name: "Strada Café Monge", category: "cafe", address: "24 Rue Monge, 75005 Paris", zone: "Quartier latin", routeIds: routes("latin-quarter", 1, 4), priority: 90, note: "Useful coffee fallback for Mouffetard and eastern Latin Quarter." },
  { id: "lat-pharm-pantheon", name: "Pharmacie du Panthéon", category: "pharmacy", address: "169 Rue Saint-Jacques, 75005 Paris", zone: "Quartier latin", routeIds: routes("latin-quarter", 2, 3, 5), priority: 98, note: "Primary pharmacy for Panthéon and Saint-Jacques side." },
  { id: "lat-pharm-maubert", name: "Pharmacie Maubert - Côté Pharma", category: "pharmacy", address: "50 Boulevard Saint-Germain, 75005 Paris", zone: "Quartier latin", routeIds: routes("latin-quarter", 1, 2), priority: 96, note: "Primary pharmacy for Maubert and river-side Latin routes." },

  // BORDS DE SEINE
  { id: "sei-maslow", name: "Maslow", category: "restaurant", address: "14 Quai de la Mégisserie, 75001 Paris", zone: "Bords de Seine", routeIds: routes("seine", 2, 3), priority: 92, note: "River-facing central option for western Seine routes." },
  { id: "sei-bourguignon", name: "Au Bourguignon du Marais", category: "restaurant", address: "52 Rue François Miron, 75004 Paris", zone: "Bords de Seine", routeIds: routes("seine", 1, 4, 5), priority: 94, note: "Strong eastern riverbank food stop just inland from the Seine." },
  { id: "sei-mon-vieil-ami", name: "Mon Vieil Ami", category: "restaurant", address: "69 Rue Saint-Louis en l'Île, 75004 Paris", zone: "Bords de Seine", routeIds: routes("seine", 1, 2), priority: 93, note: "Well positioned for Île Saint-Louis and quai routes." },
  { id: "sei-cafeotheque", name: "La Caféothèque de Paris", category: "cafe", address: "52 Rue de l'Hôtel de Ville, 75004 Paris", zone: "Bords de Seine", routeIds: routes("seine", 1, 4, 5), priority: 96, note: "Reliable eastern river coffee stop." },
  { id: "sei-saint-regis", name: "Café Saint-Régis", category: "cafe", address: "6 Rue Jean du Bellay, 75004 Paris", zone: "Bords de Seine", routeIds: routes("seine", 1, 2), priority: 90, note: "Seated option between Île Saint-Louis and Île de la Cité." },
  { id: "sei-pharm-island", name: "Pharmacie Centrale Île Saint-Louis", category: "pharmacy", address: "14 Rue des Deux Ponts, 75004 Paris", zone: "Bords de Seine", routeIds: routes("seine", 1, 2), priority: 98, note: "Primary pharmacy directly on Île Saint-Louis." },
  { id: "sei-pharm-pont", name: "Pharmacie du Pont Louis Philippe", category: "pharmacy", address: "26 Rue du Pont Louis-Philippe, 75004 Paris", zone: "Bords de Seine", routeIds: routes("seine", 4, 5), priority: 96, note: "Best fit for Hôtel-de-Ville and eastern Seine routes." },
];

export function getInternalPois(routeId: string | null | undefined, zone: string, category: InternalPoiCategory) {
  const routeMatches = INTERNAL_POI_CATALOG
    .filter((poi) => poi.category === category && poi.routeIds.includes(routeId ?? ""))
    .sort((a, b) => b.priority - a.priority);

  if (routeMatches.length >= 3) return routeMatches;

  const zoneFallbacks = INTERNAL_POI_CATALOG
    .filter((poi) => poi.category === category && poi.zone === zone && !routeMatches.some((match) => match.id === poi.id))
    .sort((a, b) => b.priority - a.priority);

  return [...routeMatches, ...zoneFallbacks];
}
