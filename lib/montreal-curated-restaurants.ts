import { assessRestaurantTrust, type RestaurantHygieneStatus, type RestaurantLocalFit, type RestaurantTrustAssessment } from "./restaurant-trust-gate";
import type { TrustEvidence, TrustRisk } from "./now-trust-gate";

export type CuratedMontrealRestaurant = {
  routeId: string;
  name: string;
  lat: number;
  lon: number;
  address: string;
  source: "curated";
  profile: "daytime-casual" | "refined-brasserie" | "signature-dinner";
  priceBand: "$$" | "$$$" | "$$$$";
  reservation: "none" | "recommended" | "required";
  editorialStatus: "approved";
  editorialReason: string;
  touristTrapRisk: "low";
  lastVerified: string;
  trustEvidence: TrustEvidence[];
  hygieneStatus: RestaurantHygieneStatus;
  valueRisk: TrustRisk;
  qualityConsistencyRisk: TrustRisk;
  localFit: RestaurantLocalFit;
};

export type AuditedMontrealRestaurant = CuratedMontrealRestaurant & {
  trustAssessment: RestaurantTrustAssessment;
};

export const MONTREAL_CURATED_RESTAURANTS: CuratedMontrealRestaurant[] = [
  {
    routeId: "montreal-old-1",
    name: "Olive et Gourmando",
    lat: 45.50122,
    lon: -73.55640,
    address: "351 Rue Saint-Paul Ouest, Montréal, QC H2Y 2A7",
    source: "curated",
    profile: "daytime-casual",
    priceBand: "$$",
    reservation: "none",
    editorialStatus: "approved",
    editorialReason: "Long-established local daytime institution with house-made food, strong local credibility, and a distinct identity beyond Old Montreal tourist traffic.",
    touristTrapRisk: "low",
    lastVerified: "2026-08-30",
    hygieneStatus: "unknown",
    valueRisk: "medium",
    qualityConsistencyRisk: "low",
    localFit: "strong",
    trustEvidence: [
      {
        source: "Tourisme Montréal — Olive et Gourmando current gastronomy profile",
        kind: "local-editorial",
        independent: true,
        verifiedAt: "2026-08-30",
        positive: true,
      },
      {
        source: "Restaurantji — Olive et Gourmando current review aggregate, updated August 2026",
        kind: "independent-reviews",
        independent: true,
        verifiedAt: "2026-08-30",
        positive: true,
      },
      {
        source: "Tripadvisor — Olive et Gourmando recent 2026 traveler reviews",
        kind: "independent-reviews",
        independent: true,
        verifiedAt: "2026-08-30",
        positive: true,
      },
    ],
  },
  {
    routeId: "montreal-old-1",
    name: "Monarque",
    lat: 45.50170,
    lon: -73.55982,
    address: "406 Rue Saint-Jacques, Montréal, QC H2Y 1S1",
    source: "curated",
    profile: "refined-brasserie",
    priceBand: "$$$",
    reservation: "recommended",
    editorialStatus: "approved",
    editorialReason: "Chef-led Montreal restaurant with separate brasserie and dining-room experiences, strong local reputation, and serious food and wine programs.",
    touristTrapRisk: "low",
    lastVerified: "2026-08-30",
    hygieneStatus: "unknown",
    valueRisk: "medium",
    qualityConsistencyRisk: "medium",
    localFit: "strong",
    trustEvidence: [
      {
        source: "MICHELIN Guide Québec 2026 — Monarque recommended selection",
        kind: "local-editorial",
        independent: true,
        verifiedAt: "2026-08-30",
        positive: true,
      },
      {
        source: "Tourisme Montréal — award-winning restaurants 2026, Monarque",
        kind: "local-editorial",
        independent: true,
        verifiedAt: "2026-08-30",
        positive: true,
      },
      {
        source: "Restaurantji — Monarque current review aggregate, updated August 2026",
        kind: "independent-reviews",
        independent: true,
        verifiedAt: "2026-08-30",
        positive: true,
      },
      {
        source: "Tripadvisor — Monarque recent 2026 traveler reviews",
        kind: "independent-reviews",
        independent: true,
        verifiedAt: "2026-08-30",
        positive: true,
      },
    ],
  },
  {
    routeId: "montreal-old-1",
    name: "Le Club Chasse et Pêche",
    lat: 45.50894,
    lon: -73.55250,
    address: "423 Rue Saint-Claude, Montréal, QC H2Y 3B6",
    source: "curated",
    profile: "signature-dinner",
    priceBand: "$$$$",
    reservation: "required",
    editorialStatus: "approved",
    editorialReason: "Discreet Old Montreal institution with more than two decades of local credibility, chef-driven Quebec cuisine, and an intimate destination-worthy experience.",
    touristTrapRisk: "low",
    lastVerified: "2026-08-30",
    hygieneStatus: "unknown",
    valueRisk: "medium",
    qualityConsistencyRisk: "low",
    localFit: "strong",
    trustEvidence: [
      {
        source: "MICHELIN Guide — Le Club Chasse et Pêche current Montréal listing",
        kind: "local-editorial",
        independent: true,
        verifiedAt: "2026-08-30",
        positive: true,
      },
      {
        source: "OpenTable editors — Le Club Chasse et Pêche 2026 Icon/current editorial profile",
        kind: "local-editorial",
        independent: true,
        verifiedAt: "2026-08-30",
        positive: true,
      },
      {
        source: "Restaurantji — Le Club Chasse et Pêche current review aggregate, August 2026",
        kind: "independent-reviews",
        independent: true,
        verifiedAt: "2026-08-30",
        positive: true,
      },
      {
        source: "Tripadvisor — Le Club Chasse et Pêche recent July-August 2026 traveler reviews",
        kind: "independent-reviews",
        independent: true,
        verifiedAt: "2026-08-30",
        positive: true,
      },
    ],
  },
];

function auditRestaurant(restaurant: CuratedMontrealRestaurant): AuditedMontrealRestaurant {
  const trustAssessment = assessRestaurantTrust({
    name: restaurant.name,
    provider: "Velvet Passport Curated",
    evidence: restaurant.trustEvidence,
    touristTrapRisk: restaurant.touristTrapRisk,
    editorialApproved: restaurant.editorialStatus === "approved",
    hygieneStatus: restaurant.hygieneStatus,
    valueRisk: restaurant.valueRisk,
    qualityConsistencyRisk: restaurant.qualityConsistencyRisk,
    localFit: restaurant.localFit,
  });

  return { ...restaurant, trustAssessment };
}

export function getCuratedMontrealRestaurants(routeId: string) {
  return MONTREAL_CURATED_RESTAURANTS.filter((restaurant) => restaurant.routeId === routeId).map(auditRestaurant);
}

export function getTrustedCuratedMontrealRestaurants(routeId: string) {
  return getCuratedMontrealRestaurants(routeId).filter((restaurant) => restaurant.trustAssessment.status === "approved");
}
