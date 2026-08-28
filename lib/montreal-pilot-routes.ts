export type MontrealPilotStop = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  access: "public" | "opening-hours" | "event-dependent";
  address?: string;
  source: "Ville de Montréal" | "Commission de toponymie du Québec" | "Official venue";
  fallback?: string;
};

export type MontrealPilotRoute = {
  id: string;
  zone: "Vieux-Montréal" | "Centre-ville" | "Plateau / Mile End";
  titleFr: string;
  titleEn: string;
  targetMinutes: number;
  purpose: string[];
  stops: MontrealPilotStop[];
};

export const MONTREAL_PILOT_ROUTES: MontrealPilotRoute[] = [
  {
    id: "montreal-old-1",
    zone: "Vieux-Montréal",
    titleFr: "Pierres, places et vieux Montréal",
    titleEn: "Stone, Squares & Old Montréal",
    targetMinutes: 45,
    purpose: ["gps", "walking", "pause-resume", "weather", "public-space fallback"],
    stops: [
      {
        id: "old-parc-la-presse",
        name: "Parc de La Presse",
        lat: 45.50573,
        lon: -73.55786,
        access: "public",
        address: "Côte de la Place-d'Armes, Montréal",
        source: "Commission de toponymie du Québec",
        fallback: "Place d'Armes",
      },
      {
        id: "old-place-darmes",
        name: "Place d'Armes",
        lat: 45.50472,
        lon: -73.55722,
        access: "public",
        address: "Place-d'Armes, Montréal",
        source: "Commission de toponymie du Québec",
        fallback: "Parc de La Presse",
      },
      {
        id: "old-jacques-cartier",
        name: "Place Jacques-Cartier",
        lat: 45.50796,
        lon: -73.55330,
        access: "public",
        address: "Place Jacques-Cartier, Montréal",
        source: "Ville de Montréal",
        fallback: "Place d'Armes",
      },
    ],
  },
  {
    id: "montreal-downtown-1",
    zone: "Centre-ville",
    titleFr: "Patrimoine au cœur du centre-ville",
    titleEn: "Downtown Heritage Pulse",
    targetMinutes: 60,
    purpose: ["opening-hours", "weather", "walking", "transit-entry", "indoor-outdoor switch"],
    stops: [
      {
        id: "downtown-dorchester",
        name: "Square Dorchester",
        lat: 45.49977,
        lon: -73.57086,
        access: "public",
        address: "2903 rue Peel, Montréal",
        source: "Commission de toponymie du Québec",
        fallback: "Place du Canada",
      },
      {
        id: "downtown-place-canada",
        name: "Place du Canada",
        lat: 45.49860,
        lon: -73.56931,
        access: "public",
        address: "Place du Canada, Montréal",
        source: "Commission de toponymie du Québec",
        fallback: "Square Dorchester",
      },
      {
        id: "downtown-mccord",
        name: "Musée McCord Stewart",
        lat: 45.50455,
        lon: -73.57370,
        access: "opening-hours",
        address: "690 rue Sherbrooke Ouest, Montréal",
        source: "Official venue",
        fallback: "Square Dorchester",
      },
    ],
  },
  {
    id: "montreal-mile-end-1",
    zone: "Plateau / Mile End",
    titleFr: "Mile End : lettres, parc et façade",
    titleEn: "Mile End: Books, Park & Facades",
    targetMinutes: 55,
    purpose: ["opening-hours", "accessibility", "walking", "neighbourhood-routing", "event-dependent fallback"],
    stops: [
      {
        id: "mile-richler",
        name: "Bibliothèque Mordecai-Richler",
        lat: 45.52165,
        lon: -73.60176,
        access: "opening-hours",
        address: "5434 avenue du Parc, Montréal",
        source: "Ville de Montréal",
        fallback: "Parc Lahaie",
      },
      {
        id: "mile-lahaie",
        name: "Parc Lahaie",
        lat: 45.52295,
        lon: -73.59187,
        access: "public",
        address: "4921 boulevard Saint-Laurent, Montréal",
        source: "Ville de Montréal",
        fallback: "Bibliothèque Mordecai-Richler",
      },
      {
        id: "mile-rialto",
        name: "Théâtre Rialto",
        lat: 45.52344,
        lon: -73.60494,
        access: "event-dependent",
        address: "5723 avenue du Parc, Montréal",
        source: "Official venue",
        fallback: "Bibliothèque Mordecai-Richler",
      },
    ],
  },
];

export function getMontrealPilotRoute(id: string) {
  return MONTREAL_PILOT_ROUTES.find((route) => route.id === id) ?? null;
}
