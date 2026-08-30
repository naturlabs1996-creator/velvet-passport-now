import { assessLodgingTrust, type LodgingTrustAssessment } from "./lodging-trust-gate";
import type { TrustEvidence } from "./now-trust-gate";

export type SlhHotelCandidate = {
  group: "Small Luxury Hotels of the World";
  city: "paris" | "montreal" | "quebec-city";
  name: string;
  address: string;
  country: "France" | "Canada";
  slhListed: true;
  slhGlobalRating?: number;
  slhReviewCount?: number;
  partnerCandidate: true;
  recommendationStatus: "not_assessed";
  evidence: TrustEvidence[];
};

export type AuditedSlhHotelCandidate = SlhHotelCandidate & {
  trustAssessment: LodgingTrustAssessment;
};

const verifiedAt = "2026-08-30";

function slhProviderEvidence(name: string): TrustEvidence {
  return {
    source: `Small Luxury Hotels of the World — ${name}`,
    kind: "provider",
    independent: false,
    verifiedAt,
    positive: true,
  };
}

export const SLH_PARIS_CANDIDATES: SlhHotelCandidate[] = [
  {
    group: "Small Luxury Hotels of the World",
    city: "paris",
    name: "Chateau des Fleurs",
    address: "19 Rue Vernet, 75008 Paris, France",
    country: "France",
    slhListed: true,
    slhGlobalRating: 4.7,
    slhReviewCount: 319,
    partnerCandidate: true,
    recommendationStatus: "not_assessed",
    evidence: [slhProviderEvidence("Chateau des Fleurs")],
  },
  {
    group: "Small Luxury Hotels of the World",
    city: "paris",
    name: "Grand Hôtel du Palais Royal",
    address: "4 Rue de Valois, 75001 Paris, France",
    country: "France",
    slhListed: true,
    slhGlobalRating: 4.8,
    slhReviewCount: 1463,
    partnerCandidate: true,
    recommendationStatus: "not_assessed",
    evidence: [slhProviderEvidence("Grand Hôtel du Palais Royal")],
  },
  {
    group: "Small Luxury Hotels of the World",
    city: "paris",
    name: "Grand Powers",
    address: "52 Rue François 1er, 75008 Paris, France",
    country: "France",
    slhListed: true,
    slhGlobalRating: 4.8,
    slhReviewCount: 769,
    partnerCandidate: true,
    recommendationStatus: "not_assessed",
    evidence: [slhProviderEvidence("Grand Powers")],
  },
  {
    group: "Small Luxury Hotels of the World",
    city: "paris",
    name: "Hotel Bowmann",
    address: "99 Boulevard Haussmann, 75008 Paris, France",
    country: "France",
    slhListed: true,
    slhGlobalRating: 4.6,
    slhReviewCount: 447,
    partnerCandidate: true,
    recommendationStatus: "not_assessed",
    evidence: [slhProviderEvidence("Hotel Bowmann")],
  },
  {
    group: "Small Luxury Hotels of the World",
    city: "paris",
    name: "Hotel Norman Paris",
    address: "9 Rue Balzac, 75008 Paris, France",
    country: "France",
    slhListed: true,
    slhGlobalRating: 4.6,
    slhReviewCount: 174,
    partnerCandidate: true,
    recommendationStatus: "not_assessed",
    evidence: [slhProviderEvidence("Hotel Norman Paris")],
  },
  {
    group: "Small Luxury Hotels of the World",
    city: "paris",
    name: "Hôtel San Régis",
    address: "12 Rue Jean Goujon, 75008 Paris, France",
    country: "France",
    slhListed: true,
    slhGlobalRating: 4.9,
    slhReviewCount: 1468,
    partnerCandidate: true,
    recommendationStatus: "not_assessed",
    evidence: [slhProviderEvidence("Hôtel San Régis")],
  },
  {
    group: "Small Luxury Hotels of the World",
    city: "paris",
    name: "Le Narcisse Blanc Hôtel & Spa",
    address: "19 Boulevard de la Tour-Maubourg, 75007 Paris, France",
    country: "France",
    slhListed: true,
    slhGlobalRating: 4.7,
    slhReviewCount: 468,
    partnerCandidate: true,
    recommendationStatus: "not_assessed",
    evidence: [slhProviderEvidence("Le Narcisse Blanc Hôtel & Spa")],
  },
  {
    group: "Small Luxury Hotels of the World",
    city: "paris",
    name: "L’Hotel",
    address: "13 Rue des Beaux-Arts, 75006 Paris, France",
    country: "France",
    slhListed: true,
    slhGlobalRating: 4.5,
    slhReviewCount: 507,
    partnerCandidate: true,
    recommendationStatus: "not_assessed",
    evidence: [slhProviderEvidence("L’Hotel")],
  },
  {
    group: "Small Luxury Hotels of the World",
    city: "paris",
    name: "Marquis Faubourg Saint Honoré",
    address: "8 Rue d’Anjou, 75008 Paris, France",
    country: "France",
    slhListed: true,
    slhGlobalRating: 4.6,
    slhReviewCount: 153,
    partnerCandidate: true,
    recommendationStatus: "not_assessed",
    evidence: [slhProviderEvidence("Marquis Faubourg Saint Honoré")],
  },
];

export const SLH_MONTREAL_CANDIDATES: SlhHotelCandidate[] = [];

export const SLH_QUEBEC_CITY_CANDIDATES: SlhHotelCandidate[] = [
  {
    group: "Small Luxury Hotels of the World",
    city: "quebec-city",
    name: "Monsieur Jean, Hôtel Particulier",
    address: "Québec City, Québec, Canada",
    country: "Canada",
    slhListed: true,
    slhGlobalRating: 4.9,
    slhReviewCount: 862,
    partnerCandidate: true,
    recommendationStatus: "not_assessed",
    evidence: [slhProviderEvidence("Monsieur Jean, Hôtel Particulier")],
  },
];

export function auditSlhHotelCandidate(candidate: SlhHotelCandidate): AuditedSlhHotelCandidate {
  const trustAssessment = assessLodgingTrust({
    name: candidate.name,
    provider: "Small Luxury Hotels of the World",
    evidence: candidate.evidence,
    touristTrapRisk: "unknown",
    massMarketRisk: "low",
    cleanlinessRisk: "unknown",
    safetyRisk: "unknown",
    infestationRisk: "unknown",
    valueRisk: "unknown",
    serviceConsistency: "unknown",
    locationFit: "strong",
    editorialApproved: false,
    partnerRelationship: false,
  });

  return { ...candidate, trustAssessment };
}

export function getAuditedSlhCandidates(city: SlhHotelCandidate["city"]) {
  const candidates = city === "paris"
    ? SLH_PARIS_CANDIDATES
    : city === "montreal"
      ? SLH_MONTREAL_CANDIDATES
      : SLH_QUEBEC_CITY_CANDIDATES;

  return candidates.map(auditSlhHotelCandidate);
}
