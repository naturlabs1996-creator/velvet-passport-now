export type CuratedMontrealRestaurant = {
  routeId: string;
  name: string;
  lat: number;
  lon: number;
  address: string;
  profile: "daytime-casual" | "refined-brasserie" | "signature-dinner";
  priceBand: "$$" | "$$$" | "$$$$";
  reservation: "none" | "recommended" | "required";
  editorialStatus: "approved";
  editorialReason: string;
  touristTrapRisk: "low";
  lastVerified: string;
};

export const MONTREAL_CURATED_RESTAURANTS: CuratedMontrealRestaurant[] = [
  {
    routeId: "montreal-old-1",
    name: "Olive et Gourmando",
    lat: 45.50122,
    lon: -73.55640,
    address: "351 Rue Saint-Paul Ouest, Montréal, QC H2Y 2A7",
    profile: "daytime-casual",
    priceBand: "$$",
    reservation: "none",
    editorialStatus: "approved",
    editorialReason: "Long-established local daytime institution with house-made food, strong local credibility, and a distinct identity beyond Old Montreal tourist traffic.",
    touristTrapRisk: "low",
    lastVerified: "2026-08-30",
  },
  {
    routeId: "montreal-old-1",
    name: "Monarque",
    lat: 45.50170,
    lon: -73.55982,
    address: "406 Rue Saint-Jacques, Montréal, QC H2Y 1S1",
    profile: "refined-brasserie",
    priceBand: "$$$",
    reservation: "recommended",
    editorialStatus: "approved",
    editorialReason: "Chef-led Montreal restaurant with separate brasserie and dining-room experiences, strong local reputation, and serious food and wine programs.",
    touristTrapRisk: "low",
    lastVerified: "2026-08-30",
  },
  {
    routeId: "montreal-old-1",
    name: "Le Club Chasse et Pêche",
    lat: 45.50894,
    lon: -73.55250,
    address: "423 Rue Saint-Claude, Montréal, QC H2Y 3B6",
    profile: "signature-dinner",
    priceBand: "$$$$",
    reservation: "required",
    editorialStatus: "approved",
    editorialReason: "Discreet Old Montreal institution with more than two decades of local credibility, chef-driven Quebec cuisine, and an intimate destination-worthy experience.",
    touristTrapRisk: "low",
    lastVerified: "2026-08-30",
  },
];

export function getCuratedMontrealRestaurants(routeId: string) {
  return MONTREAL_CURATED_RESTAURANTS.filter((restaurant) => restaurant.routeId === routeId);
}
