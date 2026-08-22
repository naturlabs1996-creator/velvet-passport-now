export type ConfidentialRouteStop = { name: string; access: "opening-hours" | "public-street"; alternative: string };
export type ConfidentialRoute = { id: string; zone: string; title: string; durationMinutes: number; stops: ConfidentialRouteStop[]; blockedStreetAlternative: string; ticketProtection: boolean; uncoveredAddressesIncluded: boolean };
export const UNCOVERED_EXCLUSIVE_ADDRESSES: string[] = [
  "Hôtel Particulier Montmartre",
  "Le Pavillon de la Reine",
  "Relais Christine",
  "Les Maisons de Famille",
  "La Table de Colette",
  "Candelaria",
  "Moonshiner",
  "Le Serpent à Plume",
  "Nose Paris",
  "Maison Fabrègue",
  "Librairie du Passage Jouffroy",
  "The Louvre After Closing",
  "La Cave Privée du Faubourg",
  "La Nuit à la Mazarine",
  "Collection Lambert bis",
  "Galerie Carré Privé",
  "Atelier de Restauration Huchet",
  "Le Barbier du Temple",
  "Le Réseau des Intermédiaires",
  "Haze Speakeasy",
  "The Shed — Hôtel des Grands Boulevards",
  "La Perruche — Printemps de l’Homme",
  "Le Perchoir — Marais",
  "La Cour Secrète de l’Hospice",
  "Bar sur la Petite Ceinture"
];
export const CONFIDENTIAL_ROUTES: ConfidentialRoute[] = [
  {
    "id": "louvre-opera-1",
    "zone": "Louvre & Opéra",
    "title": "Covered passages",
    "durationMinutes": 45,
    "stops": [
      {
        "name": "Galerie Véro-Dodat",
        "access": "opening-hours",
        "alternative": "Passage Choiseul"
      },
      {
        "name": "Passage Choiseul",
        "access": "opening-hours",
        "alternative": "Galerie Véro-Dodat"
      },
      {
        "name": "Passage des Princes",
        "access": "opening-hours",
        "alternative": "Passage Choiseul"
      },
      {
        "name": "Square Louvois",
        "access": "opening-hours",
        "alternative": "Passage des Princes"
      }
    ],
    "blockedStreetAlternative": "Rebuild via the nearest public street and preserve the protected arrival window",
    "ticketProtection": true,
    "uncoveredAddressesIncluded": false
  },
  {
    "id": "louvre-opera-2",
    "zone": "Louvre & Opéra",
    "title": "Hidden gardens",
    "durationMinutes": 50,
    "stops": [
      {
        "name": "Jardin du Palais-Royal",
        "access": "opening-hours",
        "alternative": "Rue de Beaujolais"
      },
      {
        "name": "Rue de Beaujolais",
        "access": "public-street",
        "alternative": "Jardin du Palais-Royal"
      },
      {
        "name": "Place de Valois",
        "access": "public-street",
        "alternative": "Rue de Beaujolais"
      },
      {
        "name": "Square Louvois",
        "access": "opening-hours",
        "alternative": "Place de Valois"
      }
    ],
    "blockedStreetAlternative": "Rebuild via the nearest public street and preserve the protected arrival window",
    "ticketProtection": true,
    "uncoveredAddressesIncluded": false
  },
  {
    "id": "louvre-opera-3",
    "zone": "Louvre & Opéra",
    "title": "Quiet Louvre streets",
    "durationMinutes": 55,
    "stops": [
      {
        "name": "Rue de Montpensier",
        "access": "public-street",
        "alternative": "Rue du Beaujolais"
      },
      {
        "name": "Rue du Beaujolais",
        "access": "public-street",
        "alternative": "Rue de Montpensier"
      },
      {
        "name": "Rue de Richelieu",
        "access": "public-street",
        "alternative": "Rue du Beaujolais"
      },
      {
        "name": "Place des Petits-Pères",
        "access": "public-street",
        "alternative": "Rue de Richelieu"
      }
    ],
    "blockedStreetAlternative": "Rebuild via the nearest public street and preserve the protected arrival window",
    "ticketProtection": true,
    "uncoveredAddressesIncluded": false
  },
  {
    "id": "louvre-opera-4",
    "zone": "Louvre & Opéra",
    "title": "Historic galleries",
    "durationMinutes": 60,
    "stops": [
      {
        "name": "Galerie Colbert",
        "access": "opening-hours",
        "alternative": "Rue des Petits-Champs"
      },
      {
        "name": "Rue des Petits-Champs",
        "access": "public-street",
        "alternative": "Galerie Colbert"
      },
      {
        "name": "Rue Vivienne",
        "access": "public-street",
        "alternative": "Rue des Petits-Champs"
      },
      {
        "name": "Place des Victoires",
        "access": "public-street",
        "alternative": "Rue Vivienne"
      }
    ],
    "blockedStreetAlternative": "Rebuild via the nearest public street and preserve the protected arrival window",
    "ticketProtection": true,
    "uncoveredAddressesIncluded": false
  },
  {
    "id": "louvre-opera-5",
    "zone": "Louvre & Opéra",
    "title": "Opera back streets",
    "durationMinutes": 65,
    "stops": [
      {
        "name": "Square de l’Opéra-Louis-Jouvet",
        "access": "opening-hours",
        "alternative": "Rue de la Michodière"
      },
      {
        "name": "Rue de la Michodière",
        "access": "public-street",
        "alternative": "Square de l’Opéra-Louis-Jouvet"
      },
      {
        "name": "Rue Sainte-Anne",
        "access": "public-street",
        "alternative": "Rue de la Michodière"
      },
      {
        "name": "Rue des Petits-Champs",
        "access": "public-street",
        "alternative": "Rue Sainte-Anne"
      }
    ],
    "blockedStreetAlternative": "Rebuild via the nearest public street and preserve the protected arrival window",
    "ticketProtection": true,
    "uncoveredAddressesIncluded": false
  },
  {
    "id": "marais-1",
    "zone": "Le Marais",
    "title": "Hidden gardens",
    "durationMinutes": 45,
    "stops": [
      {
        "name": "Square du Temple",
        "access": "opening-hours",
        "alternative": "Jardin Anne-Frank"
      },
      {
        "name": "Jardin Anne-Frank",
        "access": "opening-hours",
        "alternative": "Square du Temple"
      },
      {
        "name": "Rue des Archives",
        "access": "public-street",
        "alternative": "Jardin Anne-Frank"
      },
      {
        "name": "Rue des Haudriettes",
        "access": "public-street",
        "alternative": "Rue des Archives"
      }
    ],
    "blockedStreetAlternative": "Rebuild via the nearest public street and preserve the protected arrival window",
    "ticketProtection": true,
    "uncoveredAddressesIncluded": false
  },
  {
    "id": "marais-2",
    "zone": "Le Marais",
    "title": "Old courtyards",
    "durationMinutes": 50,
    "stops": [
      {
        "name": "Passage de l’Ancre",
        "access": "opening-hours",
        "alternative": "Rue de Montmorency"
      },
      {
        "name": "Rue de Montmorency",
        "access": "public-street",
        "alternative": "Passage de l’Ancre"
      },
      {
        "name": "Rue Chapon",
        "access": "public-street",
        "alternative": "Rue de Montmorency"
      },
      {
        "name": "Rue au Maire",
        "access": "public-street",
        "alternative": "Rue Chapon"
      }
    ],
    "blockedStreetAlternative": "Rebuild via the nearest public street and preserve the protected arrival window",
    "ticketProtection": true,
    "uncoveredAddressesIncluded": false
  },
  {
    "id": "marais-3",
    "zone": "Le Marais",
    "title": "Artisans' quarter",
    "durationMinutes": 55,
    "stops": [
      {
        "name": "Rue des Gravilliers",
        "access": "public-street",
        "alternative": "Rue Notre-Dame-de-Nazareth"
      },
      {
        "name": "Rue Notre-Dame-de-Nazareth",
        "access": "public-street",
        "alternative": "Rue des Gravilliers"
      },
      {
        "name": "Rue du Vertbois",
        "access": "public-street",
        "alternative": "Rue Notre-Dame-de-Nazareth"
      },
      {
        "name": "Rue Volta",
        "access": "public-street",
        "alternative": "Rue du Vertbois"
      }
    ],
    "blockedStreetAlternative": "Rebuild via the nearest public street and preserve the protected arrival window",
    "ticketProtection": true,
    "uncoveredAddressesIncluded": false
  },
  {
    "id": "marais-4",
    "zone": "Le Marais",
    "title": "Village behind the facades",
    "durationMinutes": 60,
    "stops": [
      {
        "name": "Rue des Barres",
        "access": "public-street",
        "alternative": "Rue François-Miron"
      },
      {
        "name": "Rue François-Miron",
        "access": "public-street",
        "alternative": "Rue des Barres"
      },
      {
        "name": "Rue du Grenier-sur-l’Eau",
        "access": "public-street",
        "alternative": "Rue François-Miron"
      },
      {
        "name": "Rue du Pont-Louis-Philippe",
        "access": "public-street",
        "alternative": "Rue du Grenier-sur-l’Eau"
      }
    ],
    "blockedStreetAlternative": "Rebuild via the nearest public street and preserve the protected arrival window",
    "ticketProtection": true,
    "uncoveredAddressesIncluded": false
  },
  {
    "id": "marais-5",
    "zone": "Le Marais",
    "title": "Quiet Marais evening",
    "durationMinutes": 65,
    "stops": [
      {
        "name": "Rue du Parc-Royal",
        "access": "public-street",
        "alternative": "Rue Payenne"
      },
      {
        "name": "Rue Payenne",
        "access": "public-street",
        "alternative": "Rue du Parc-Royal"
      },
      {
        "name": "Square Georges-Cain",
        "access": "opening-hours",
        "alternative": "Rue Payenne"
      },
      {
        "name": "Jardin des Rosiers–Joseph-Migneret",
        "access": "opening-hours",
        "alternative": "Square Georges-Cain"
      }
    ],
    "blockedStreetAlternative": "Rebuild via the nearest public street and preserve the protected arrival window",
    "ticketProtection": true,
    "uncoveredAddressesIncluded": false
  },
  {
    "id": "saint-germain-1",
    "zone": "Saint-Germain-des-Prés",
    "title": "Discreet passages",
    "durationMinutes": 45,
    "stops": [
      {
        "name": "Passage Dauphine",
        "access": "opening-hours",
        "alternative": "Cour du Commerce-Saint-André"
      },
      {
        "name": "Cour du Commerce-Saint-André",
        "access": "opening-hours",
        "alternative": "Passage Dauphine"
      },
      {
        "name": "Rue de Buci",
        "access": "public-street",
        "alternative": "Cour du Commerce-Saint-André"
      },
      {
        "name": "Rue Grégoire-de-Tours",
        "access": "public-street",
        "alternative": "Rue de Buci"
      }
    ],
    "blockedStreetAlternative": "Rebuild via the nearest public street and preserve the protected arrival window",
    "ticketProtection": true,
    "uncoveredAddressesIncluded": false
  },
  {
    "id": "saint-germain-2",
    "zone": "Saint-Germain-des-Prés",
    "title": "Garden side",
    "durationMinutes": 50,
    "stops": [
      {
        "name": "Square Gabriel-Pierné",
        "access": "opening-hours",
        "alternative": "Rue Visconti"
      },
      {
        "name": "Rue Visconti",
        "access": "public-street",
        "alternative": "Square Gabriel-Pierné"
      },
      {
        "name": "Rue de Seine",
        "access": "public-street",
        "alternative": "Rue Visconti"
      },
      {
        "name": "Rue des Beaux-Arts",
        "access": "public-street",
        "alternative": "Rue de Seine"
      }
    ],
    "blockedStreetAlternative": "Rebuild via the nearest public street and preserve the protected arrival window",
    "ticketProtection": true,
    "uncoveredAddressesIncluded": false
  },
  {
    "id": "saint-germain-3",
    "zone": "Saint-Germain-des-Prés",
    "title": "Former ateliers",
    "durationMinutes": 55,
    "stops": [
      {
        "name": "Rue Jacob",
        "access": "public-street",
        "alternative": "Rue de Furstemberg"
      },
      {
        "name": "Rue de Furstemberg",
        "access": "public-street",
        "alternative": "Rue Jacob"
      },
      {
        "name": "Rue de l’Abbaye",
        "access": "public-street",
        "alternative": "Rue de Furstemberg"
      },
      {
        "name": "Rue Cardinale",
        "access": "public-street",
        "alternative": "Rue de l’Abbaye"
      }
    ],
    "blockedStreetAlternative": "Rebuild via the nearest public street and preserve the protected arrival window",
    "ticketProtection": true,
    "uncoveredAddressesIncluded": false
  },
  {
    "id": "saint-germain-4",
    "zone": "Saint-Germain-des-Prés",
    "title": "Small galleries",
    "durationMinutes": 60,
    "stops": [
      {
        "name": "Rue Bonaparte",
        "access": "public-street",
        "alternative": "Rue des Saints-Pères"
      },
      {
        "name": "Rue des Saints-Pères",
        "access": "public-street",
        "alternative": "Rue Bonaparte"
      },
      {
        "name": "Rue de Verneuil",
        "access": "public-street",
        "alternative": "Rue des Saints-Pères"
      },
      {
        "name": "Rue de Beaune",
        "access": "public-street",
        "alternative": "Rue de Verneuil"
      }
    ],
    "blockedStreetAlternative": "Rebuild via the nearest public street and preserve the protected arrival window",
    "ticketProtection": true,
    "uncoveredAddressesIncluded": false
  },
  {
    "id": "saint-germain-5",
    "zone": "Saint-Germain-des-Prés",
    "title": "Hidden courtyards",
    "durationMinutes": 65,
    "stops": [
      {
        "name": "Rue du Cherche-Midi",
        "access": "public-street",
        "alternative": "Rue du Regard"
      },
      {
        "name": "Rue du Regard",
        "access": "public-street",
        "alternative": "Rue du Cherche-Midi"
      },
      {
        "name": "Rue Notre-Dame-des-Champs",
        "access": "public-street",
        "alternative": "Rue du Regard"
      },
      {
        "name": "Rue Vavin",
        "access": "public-street",
        "alternative": "Rue Notre-Dame-des-Champs"
      }
    ],
    "blockedStreetAlternative": "Rebuild via the nearest public street and preserve the protected arrival window",
    "ticketProtection": true,
    "uncoveredAddressesIncluded": false
  },
  {
    "id": "montmartre-1",
    "zone": "Montmartre",
    "title": "Beyond the crowds",
    "durationMinutes": 45,
    "stops": [
      {
        "name": "Rue de l’Abreuvoir",
        "access": "public-street",
        "alternative": "Rue des Saules"
      },
      {
        "name": "Rue des Saules",
        "access": "public-street",
        "alternative": "Rue de l’Abreuvoir"
      },
      {
        "name": "Rue Saint-Vincent",
        "access": "public-street",
        "alternative": "Rue des Saules"
      },
      {
        "name": "Rue Cortot",
        "access": "public-street",
        "alternative": "Rue Saint-Vincent"
      }
    ],
    "blockedStreetAlternative": "Rebuild via the nearest public street and preserve the protected arrival window",
    "ticketProtection": true,
    "uncoveredAddressesIncluded": false
  },
  {
    "id": "montmartre-2",
    "zone": "Montmartre",
    "title": "Gardens behind the hill",
    "durationMinutes": 50,
    "stops": [
      {
        "name": "Square Suzanne-Buisson",
        "access": "opening-hours",
        "alternative": "Rue des Saules"
      },
      {
        "name": "Rue des Saules",
        "access": "public-street",
        "alternative": "Square Suzanne-Buisson"
      },
      {
        "name": "Rue du Mont-Cenis",
        "access": "public-street",
        "alternative": "Rue des Saules"
      },
      {
        "name": "Square Marcel-Bleustein-Blanchet",
        "access": "opening-hours",
        "alternative": "Rue du Mont-Cenis"
      }
    ],
    "blockedStreetAlternative": "Rebuild via the nearest public street and preserve the protected arrival window",
    "ticketProtection": true,
    "uncoveredAddressesIncluded": false
  },
  {
    "id": "montmartre-3",
    "zone": "Montmartre",
    "title": "Residential Montmartre",
    "durationMinutes": 55,
    "stops": [
      {
        "name": "Rue Paul-Albert",
        "access": "public-street",
        "alternative": "Rue Lamarck"
      },
      {
        "name": "Rue Lamarck",
        "access": "public-street",
        "alternative": "Rue Paul-Albert"
      },
      {
        "name": "Rue du Chevalier-de-La-Barre",
        "access": "public-street",
        "alternative": "Rue Lamarck"
      },
      {
        "name": "Rue Ramey",
        "access": "public-street",
        "alternative": "Rue du Chevalier-de-La-Barre"
      }
    ],
    "blockedStreetAlternative": "Rebuild via the nearest public street and preserve the protected arrival window",
    "ticketProtection": true,
    "uncoveredAddressesIncluded": false
  },
  {
    "id": "montmartre-4",
    "zone": "Montmartre",
    "title": "Atelier side",
    "durationMinutes": 60,
    "stops": [
      {
        "name": "Passage Cottin",
        "access": "opening-hours",
        "alternative": "Rue Muller"
      },
      {
        "name": "Rue Muller",
        "access": "public-street",
        "alternative": "Passage Cottin"
      },
      {
        "name": "Rue André-del-Sarte",
        "access": "public-street",
        "alternative": "Rue Muller"
      },
      {
        "name": "Rue Gabrielle",
        "access": "public-street",
        "alternative": "Rue André-del-Sarte"
      }
    ],
    "blockedStreetAlternative": "Rebuild via the nearest public street and preserve the protected arrival window",
    "ticketProtection": true,
    "uncoveredAddressesIncluded": false
  },
  {
    "id": "montmartre-5",
    "zone": "Montmartre",
    "title": "Quiet hillside",
    "durationMinutes": 65,
    "stops": [
      {
        "name": "Rue Caulaincourt",
        "access": "public-street",
        "alternative": "Rue Joseph-de-Maistre"
      },
      {
        "name": "Rue Joseph-de-Maistre",
        "access": "public-street",
        "alternative": "Rue Caulaincourt"
      },
      {
        "name": "Rue Damrémont",
        "access": "public-street",
        "alternative": "Rue Joseph-de-Maistre"
      },
      {
        "name": "Square Joël-Le-Tac",
        "access": "opening-hours",
        "alternative": "Rue Damrémont"
      }
    ],
    "blockedStreetAlternative": "Rebuild via the nearest public street and preserve the protected arrival window",
    "ticketProtection": true,
    "uncoveredAddressesIncluded": false
  },
  {
    "id": "latin-quarter-1",
    "zone": "Quartier latin",
    "title": "Ancient lanes",
    "durationMinutes": 45,
    "stops": [
      {
        "name": "Rue de la Montagne-Sainte-Geneviève",
        "access": "public-street",
        "alternative": "Rue de la Bûcherie"
      },
      {
        "name": "Rue de la Bûcherie",
        "access": "public-street",
        "alternative": "Rue de la Montagne-Sainte-Geneviève"
      },
      {
        "name": "Rue Maître-Albert",
        "access": "public-street",
        "alternative": "Rue de la Bûcherie"
      },
      {
        "name": "Rue des Bernardins",
        "access": "public-street",
        "alternative": "Rue Maître-Albert"
      }
    ],
    "blockedStreetAlternative": "Rebuild via the nearest public street and preserve the protected arrival window",
    "ticketProtection": true,
    "uncoveredAddressesIncluded": false
  },
  {
    "id": "latin-quarter-2",
    "zone": "Quartier latin",
    "title": "Gardens and passages",
    "durationMinutes": 50,
    "stops": [
      {
        "name": "Square Paul-Langevin",
        "access": "opening-hours",
        "alternative": "Rue Clotilde"
      },
      {
        "name": "Rue Clotilde",
        "access": "public-street",
        "alternative": "Square Paul-Langevin"
      },
      {
        "name": "Rue Descartes",
        "access": "public-street",
        "alternative": "Rue Clotilde"
      },
      {
        "name": "Square Marius-Constant",
        "access": "opening-hours",
        "alternative": "Rue Descartes"
      }
    ],
    "blockedStreetAlternative": "Rebuild via the nearest public street and preserve the protected arrival window",
    "ticketProtection": true,
    "uncoveredAddressesIncluded": false
  },
  {
    "id": "latin-quarter-3",
    "zone": "Quartier latin",
    "title": "Scholars’ streets",
    "durationMinutes": 55,
    "stops": [
      {
        "name": "Rue Valette",
        "access": "public-street",
        "alternative": "Rue Lanneau"
      },
      {
        "name": "Rue Lanneau",
        "access": "public-street",
        "alternative": "Rue Valette"
      },
      {
        "name": "Rue des Carmes",
        "access": "public-street",
        "alternative": "Rue Lanneau"
      },
      {
        "name": "Rue Jean-de-Beauvais",
        "access": "public-street",
        "alternative": "Rue des Carmes"
      }
    ],
    "blockedStreetAlternative": "Rebuild via the nearest public street and preserve the protected arrival window",
    "ticketProtection": true,
    "uncoveredAddressesIncluded": false
  },
  {
    "id": "latin-quarter-4",
    "zone": "Quartier latin",
    "title": "Village side",
    "durationMinutes": 60,
    "stops": [
      {
        "name": "Rue Mouffetard",
        "access": "public-street",
        "alternative": "Rue du Pot-de-Fer"
      },
      {
        "name": "Rue du Pot-de-Fer",
        "access": "public-street",
        "alternative": "Rue Mouffetard"
      },
      {
        "name": "Rue de l’Arbalète",
        "access": "public-street",
        "alternative": "Rue du Pot-de-Fer"
      },
      {
        "name": "Rue Tournefort",
        "access": "public-street",
        "alternative": "Rue de l’Arbalète"
      }
    ],
    "blockedStreetAlternative": "Rebuild via the nearest public street and preserve the protected arrival window",
    "ticketProtection": true,
    "uncoveredAddressesIncluded": false
  },
  {
    "id": "latin-quarter-5",
    "zone": "Quartier latin",
    "title": "Behind the Panthéon",
    "durationMinutes": 65,
    "stops": [
      {
        "name": "Rue Clovis",
        "access": "public-street",
        "alternative": "Square Paul-Painlevé"
      },
      {
        "name": "Square Paul-Painlevé",
        "access": "opening-hours",
        "alternative": "Rue Clovis"
      },
      {
        "name": "Rue de la Parcheminerie",
        "access": "public-street",
        "alternative": "Square Paul-Painlevé"
      },
      {
        "name": "Rue Saint-Séverin",
        "access": "public-street",
        "alternative": "Rue de la Parcheminerie"
      }
    ],
    "blockedStreetAlternative": "Rebuild via the nearest public street and preserve the protected arrival window",
    "ticketProtection": true,
    "uncoveredAddressesIncluded": false
  },
  {
    "id": "seine-1",
    "zone": "Bords de Seine",
    "title": "Quiet Île Saint-Louis",
    "durationMinutes": 45,
    "stops": [
      {
        "name": "Quai de Bourbon",
        "access": "public-street",
        "alternative": "Rue Le Regrattier"
      },
      {
        "name": "Rue Le Regrattier",
        "access": "public-street",
        "alternative": "Quai de Bourbon"
      },
      {
        "name": "Quai d’Anjou",
        "access": "public-street",
        "alternative": "Rue Le Regrattier"
      },
      {
        "name": "Square Barye",
        "access": "opening-hours",
        "alternative": "Quai d’Anjou"
      }
    ],
    "blockedStreetAlternative": "Rebuild via the nearest public street and preserve the protected arrival window",
    "ticketProtection": true,
    "uncoveredAddressesIncluded": false
  },
  {
    "id": "seine-2",
    "zone": "Bords de Seine",
    "title": "Small streets by the river",
    "durationMinutes": 50,
    "stops": [
      {
        "name": "Quai de Montebello",
        "access": "public-street",
        "alternative": "Rue de Bièvre"
      },
      {
        "name": "Rue de Bièvre",
        "access": "public-street",
        "alternative": "Quai de Montebello"
      },
      {
        "name": "Rue des Bernardins",
        "access": "public-street",
        "alternative": "Rue de Bièvre"
      },
      {
        "name": "Quai de la Tournelle",
        "access": "public-street",
        "alternative": "Rue des Bernardins"
      }
    ],
    "blockedStreetAlternative": "Rebuild via the nearest public street and preserve the protected arrival window",
    "ticketProtection": true,
    "uncoveredAddressesIncluded": false
  },
  {
    "id": "seine-3",
    "zone": "Bords de Seine",
    "title": "Between Seine and Saint-Germain",
    "durationMinutes": 55,
    "stops": [
      {
        "name": "Rue de Lille",
        "access": "public-street",
        "alternative": "Rue de Beaune"
      },
      {
        "name": "Rue de Beaune",
        "access": "public-street",
        "alternative": "Rue de Lille"
      },
      {
        "name": "Rue du Bac",
        "access": "public-street",
        "alternative": "Rue de Beaune"
      },
      {
        "name": "Quai Voltaire",
        "access": "public-street",
        "alternative": "Rue du Bac"
      }
    ],
    "blockedStreetAlternative": "Rebuild via the nearest public street and preserve the protected arrival window",
    "ticketProtection": true,
    "uncoveredAddressesIncluded": false
  },
  {
    "id": "seine-4",
    "zone": "Bords de Seine",
    "title": "Eastern riverbank",
    "durationMinutes": 60,
    "stops": [
      {
        "name": "Port de l’Arsenal",
        "access": "public-street",
        "alternative": "Boulevard Morland"
      },
      {
        "name": "Boulevard Morland",
        "access": "public-street",
        "alternative": "Port de l’Arsenal"
      },
      {
        "name": "Quai Henri-IV",
        "access": "public-street",
        "alternative": "Boulevard Morland"
      },
      {
        "name": "Jardin Tino-Rossi",
        "access": "opening-hours",
        "alternative": "Quai Henri-IV"
      }
    ],
    "blockedStreetAlternative": "Rebuild via the nearest public street and preserve the protected arrival window",
    "ticketProtection": true,
    "uncoveredAddressesIncluded": false
  },
  {
    "id": "seine-5",
    "zone": "Bords de Seine",
    "title": "Quays and private mansions",
    "durationMinutes": 65,
    "stops": [
      {
        "name": "Quai des Célestins",
        "access": "public-street",
        "alternative": "Rue de l’Hôtel-de-Ville"
      },
      {
        "name": "Rue de l’Hôtel-de-Ville",
        "access": "public-street",
        "alternative": "Quai des Célestins"
      },
      {
        "name": "Rue des Nonnains-d’Hyères",
        "access": "public-street",
        "alternative": "Rue de l’Hôtel-de-Ville"
      },
      {
        "name": "Rue de Jouy",
        "access": "public-street",
        "alternative": "Rue des Nonnains-d’Hyères"
      }
    ],
    "blockedStreetAlternative": "Rebuild via the nearest public street and preserve the protected arrival window",
    "ticketProtection": true,
    "uncoveredAddressesIncluded": false
  }
];
export function getConfidentialRoutes(zone?: string): ConfidentialRoute[] { return zone ? CONFIDENTIAL_ROUTES.filter(route => route.zone === zone) : CONFIDENTIAL_ROUTES; }
export function isUncoveredExclusive(name: string): boolean { const normalized = name.toLocaleLowerCase("fr-FR"); return UNCOVERED_EXCLUSIVE_ADDRESSES.some(address => address.toLocaleLowerCase("fr-FR") === normalized); }
