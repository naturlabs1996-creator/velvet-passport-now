import { assessLodgingTrust, type LodgingLocationFit, type LodgingServiceConsistency, type LodgingTrustAssessment } from "./lodging-trust-gate";
import type { TrustEvidence, TrustRisk } from "./now-trust-gate";

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
  recommendationStatus: "not_assessed" | "approved" | "review_required" | "rejected";
  evidence: TrustEvidence[];
  cleanlinessRisk?: TrustRisk;
  safetyRisk?: TrustRisk;
  infestationRisk?: TrustRisk;
  valueRisk?: TrustRisk;
  touristTrapRisk?: TrustRisk;
  serviceConsistency?: LodgingServiceConsistency;
  locationFit?: LodgingLocationFit;
  verifiedRecentInfestationReports?: number;
  unverifiedRecentInfestationSignals?: number;
  auditNote?: string;
};

export type AuditedSlhHotelCandidate = SlhHotelCandidate & {
  trustAssessment: LodgingTrustAssessment;
};

const verifiedAt = "2026-08-30";

function evidence(source: string, kind: TrustEvidence["kind"] = "independent-reviews", positive = true): TrustEvidence {
  return { source, kind, independent: kind !== "provider", verifiedAt, positive };
}

function slhProviderEvidence(name: string): TrustEvidence {
  return evidence(`Small Luxury Hotels of the World — ${name}`, "provider", true);
}

export const SLH_PARIS_CANDIDATES: SlhHotelCandidate[] = [
  {
    group: "Small Luxury Hotels of the World", city: "paris", name: "Chateau des Fleurs",
    address: "19 Rue Vernet, 75008 Paris, France", country: "France", slhListed: true,
    slhGlobalRating: 4.7, slhReviewCount: 319, partnerCandidate: true, recommendationStatus: "approved",
    evidence: [slhProviderEvidence("Chateau des Fleurs"), evidence("Booking.com 2026 — 8.7/10 overall, 8.9 cleanliness, 9.2 staff, 9.6 location"), evidence("Tripadvisor 2026 recent stays — strong service/cleanliness/location pattern")],
    cleanlinessRisk: "low", safetyRisk: "low", infestationRisk: "low", valueRisk: "medium", touristTrapRisk: "low",
    serviceConsistency: "strong", locationFit: "strong", verifiedRecentInfestationReports: 0, unverifiedRecentInfestationSignals: 0,
    auditNote: "No credible recent infestation signal found in targeted public-source search. Good recent quality pattern; value is the main softer point.",
  },
  {
    group: "Small Luxury Hotels of the World", city: "paris", name: "Grand Hôtel du Palais Royal",
    address: "4 Rue de Valois, 75001 Paris, France", country: "France", slhListed: true,
    slhGlobalRating: 4.8, slhReviewCount: 1463, partnerCandidate: true, recommendationStatus: "approved",
    evidence: [slhProviderEvidence("Grand Hôtel du Palais Royal"), evidence("Booking.com 2026 — 9.2/10 overall, 9.5 cleanliness, 9.9 location"), evidence("Tripadvisor 2026 — 4.8/5, 4.9 cleanliness/service, recent spotless-room reports")],
    cleanlinessRisk: "low", safetyRisk: "low", infestationRisk: "low", valueRisk: "low", touristTrapRisk: "low",
    serviceConsistency: "strong", locationFit: "strong", verifiedRecentInfestationReports: 0, unverifiedRecentInfestationSignals: 0,
    auditNote: "Very strong independent consistency on cleanliness, service and location; no credible recent infestation signal found.",
  },
  {
    group: "Small Luxury Hotels of the World", city: "paris", name: "Grand Powers",
    address: "52 Rue François 1er, 75008 Paris, France", country: "France", slhListed: true,
    slhGlobalRating: 4.8, slhReviewCount: 769, partnerCandidate: true, recommendationStatus: "approved",
    evidence: [slhProviderEvidence("Grand Powers"), evidence("Booking.com 2026 — 9.2/10 overall, 9.5 cleanliness, 9.8 location, 8.6 value"), evidence("Travelocity verified reviews 2026 — 9.6/10 overall, 9.8 cleanliness and staff/service"), evidence("Tripadvisor 2026 — 5.0/5, strong recent cleanliness/service pattern")],
    cleanlinessRisk: "low", safetyRisk: "low", infestationRisk: "low", valueRisk: "low", touristTrapRisk: "low",
    serviceConsistency: "strong", locationFit: "strong", verifiedRecentInfestationReports: 0, unverifiedRecentInfestationSignals: 0,
    auditNote: "One of the strongest SLH Paris candidates by independent cleanliness/service consistency; no credible recent infestation signal found.",
  },
  {
    group: "Small Luxury Hotels of the World", city: "paris", name: "Hotel Bowmann",
    address: "99 Boulevard Haussmann, 75008 Paris, France", country: "France", slhListed: true,
    slhGlobalRating: 4.6, slhReviewCount: 447, partnerCandidate: true, recommendationStatus: "approved",
    evidence: [slhProviderEvidence("Hotel Bowmann"), evidence("Booking.com 2026 — 8.9/10 overall, 9.2 cleanliness, 9.4 comfort, 9.2 location"), evidence("Tripadvisor 2026 — recent spotless-room and excellent-staff reports"), evidence("Tripadvisor Jan 2026 — maintenance/aging concerns", "independent-reviews", false)],
    cleanlinessRisk: "low", safetyRisk: "low", infestationRisk: "low", valueRisk: "medium", touristTrapRisk: "low",
    serviceConsistency: "strong", locationFit: "strong", verifiedRecentInfestationReports: 0, unverifiedRecentInfestationSignals: 0,
    auditNote: "Passes, but with a maintenance/value watch flag: one detailed 2026 review reports wear and spa maintenance issues. No credible recent infestation report found.",
  },
  {
    group: "Small Luxury Hotels of the World", city: "paris", name: "Hotel Norman Paris",
    address: "9 Rue Balzac, 75008 Paris, France", country: "France", slhListed: true,
    slhGlobalRating: 4.6, slhReviewCount: 174, partnerCandidate: true, recommendationStatus: "approved",
    evidence: [slhProviderEvidence("Hotel Norman Paris"), evidence("Booking.com 2026 — 9.0/10 overall, 9.3 cleanliness, 9.4 staff, 9.6 location"), evidence("Hotels.com verified reviews — 9.4/10 overall, 9.6 cleanliness, 9.2 staff/service"), evidence("Tripadvisor 2026 — recent fresh/new property and strong service reports")],
    cleanlinessRisk: "low", safetyRisk: "low", infestationRisk: "low", valueRisk: "medium", touristTrapRisk: "low",
    serviceConsistency: "strong", locationFit: "strong", verifiedRecentInfestationReports: 0, unverifiedRecentInfestationSignals: 0,
    auditNote: "Strong recent boutique-hotel profile and cleanliness; no credible recent infestation signal found. Value score is good rather than exceptional.",
  },
  {
    group: "Small Luxury Hotels of the World", city: "paris", name: "Hôtel San Régis",
    address: "12 Rue Jean Goujon, 75008 Paris, France", country: "France", slhListed: true,
    slhGlobalRating: 4.9, slhReviewCount: 1468, partnerCandidate: true, recommendationStatus: "approved",
    evidence: [slhProviderEvidence("Hôtel San Régis"), evidence("Booking.com 2026 — 9.3/10 overall, 9.3 cleanliness, 9.5 staff, 9.8 location"), evidence("Hotels.com verified reviews — 9.4/10 overall, 9.6 cleanliness, 9.4 staff/service"), evidence("Tripadvisor 2026 — recent spotless-room and outstanding-service reports")],
    cleanlinessRisk: "low", safetyRisk: "low", infestationRisk: "low", valueRisk: "low", touristTrapRisk: "low",
    serviceConsistency: "strong", locationFit: "strong", verifiedRecentInfestationReports: 0, unverifiedRecentInfestationSignals: 0,
    auditNote: "Strong independent cross-check across cleanliness, service and location; no credible recent infestation signal found.",
  },
  {
    group: "Small Luxury Hotels of the World", city: "paris", name: "Le Narcisse Blanc Hôtel & Spa",
    address: "19 Boulevard de la Tour-Maubourg, 75007 Paris, France", country: "France", slhListed: true,
    slhGlobalRating: 4.7, slhReviewCount: 468, partnerCandidate: true, recommendationStatus: "approved",
    evidence: [slhProviderEvidence("Le Narcisse Blanc Hôtel & Spa"), evidence("Booking.com 2026 — 9.1/10 overall, 9.4 cleanliness, 9.3 staff, 9.6 location"), evidence("Hotels.com verified reviews 2026 — 9.8/10 overall, 10/10 cleanliness, 9.8 staff/service"), evidence("Petit Futé Apr 2026 — spotless hotel in safe area")],
    cleanlinessRisk: "low", safetyRisk: "low", infestationRisk: "low", valueRisk: "low", touristTrapRisk: "low",
    serviceConsistency: "strong", locationFit: "strong", verifiedRecentInfestationReports: 0, unverifiedRecentInfestationSignals: 0,
    auditNote: "Exceptional cleanliness/service consistency across independent platforms; no credible recent infestation signal found.",
  },
  {
    group: "Small Luxury Hotels of the World", city: "paris", name: "L’Hotel",
    address: "13 Rue des Beaux-Arts, 75006 Paris, France", country: "France", slhListed: true,
    slhGlobalRating: 4.5, slhReviewCount: 507, partnerCandidate: true, recommendationStatus: "approved",
    evidence: [slhProviderEvidence("L’Hotel"), evidence("Booking.com 2026 — 9.2/10 overall, 9.4 cleanliness, 9.7 location, 8.5 value"), evidence("Tripadvisor 2026 — 4.4/5 overall, 4.5 cleanliness/service, repeat-guest praise")],
    cleanlinessRisk: "low", safetyRisk: "low", infestationRisk: "low", valueRisk: "medium", touristTrapRisk: "low",
    serviceConsistency: "acceptable", locationFit: "strong", verifiedRecentInfestationReports: 0, unverifiedRecentInfestationSignals: 0,
    auditNote: "Passes with a value watch: strong Booking.com results, while Tripadvisor value is more modest. No credible recent infestation signal found.",
  },
  {
    group: "Small Luxury Hotels of the World", city: "paris", name: "Marquis Faubourg Saint Honoré",
    address: "8 Rue d’Anjou, 75008 Paris, France", country: "France", slhListed: true,
    slhGlobalRating: 4.6, slhReviewCount: 153, partnerCandidate: true, recommendationStatus: "review_required",
    evidence: [slhProviderEvidence("Marquis Faubourg Saint Honoré"), evidence("Hotels.com verified reviews 2026 — 9.0/10 overall, 9.6 cleanliness, 8.8 staff/service"), evidence("Tripadvisor May-Jun 2026 — multiple detailed complaints about room/bathroom cleanliness and service consistency", "independent-reviews", false), evidence("Tripadvisor Jul 2026 — repeat guest still positive but notes occasional understaffing")],
    cleanlinessRisk: "medium", safetyRisk: "low", infestationRisk: "low", valueRisk: "medium", touristTrapRisk: "low",
    serviceConsistency: "inconsistent", locationFit: "strong", verifiedRecentInfestationReports: 0, unverifiedRecentInfestationSignals: 0,
    auditNote: "Do not recommend yet. Strong aggregate scores conflict with several recent, specific 2026 cleanliness/service complaints; requires fresh manual re-check before approval.",
  },
];

export const SLH_MONTREAL_CANDIDATES: SlhHotelCandidate[] = [];

export const SLH_QUEBEC_CITY_CANDIDATES: SlhHotelCandidate[] = [
  {
    group: "Small Luxury Hotels of the World", city: "quebec-city", name: "Monsieur Jean, Hôtel Particulier",
    address: "Québec City, Québec, Canada", country: "Canada", slhListed: true,
    slhGlobalRating: 4.9, slhReviewCount: 862, partnerCandidate: true, recommendationStatus: "not_assessed",
    evidence: [slhProviderEvidence("Monsieur Jean, Hôtel Particulier")],
  },
];

export function auditSlhHotelCandidate(candidate: SlhHotelCandidate): AuditedSlhHotelCandidate {
  const trustAssessment = assessLodgingTrust({
    name: candidate.name,
    provider: "Small Luxury Hotels of the World",
    evidence: candidate.evidence,
    touristTrapRisk: candidate.touristTrapRisk ?? "unknown",
    massMarketRisk: "low",
    cleanlinessRisk: candidate.cleanlinessRisk ?? "unknown",
    safetyRisk: candidate.safetyRisk ?? "unknown",
    infestationRisk: candidate.infestationRisk ?? "unknown",
    valueRisk: candidate.valueRisk ?? "unknown",
    verifiedRecentInfestationReports: candidate.verifiedRecentInfestationReports ?? 0,
    unverifiedRecentInfestationSignals: candidate.unverifiedRecentInfestationSignals ?? 0,
    serviceConsistency: candidate.serviceConsistency ?? "unknown",
    locationFit: candidate.locationFit ?? "strong",
    editorialApproved: candidate.recommendationStatus === "approved",
    partnerRelationship: false,
  });

  return { ...candidate, recommendationStatus: trustAssessment.status, trustAssessment };
}

export function getAuditedSlhCandidates(city: SlhHotelCandidate["city"]) {
  const candidates = city === "paris"
    ? SLH_PARIS_CANDIDATES
    : city === "montreal"
      ? SLH_MONTREAL_CANDIDATES
      : SLH_QUEBEC_CITY_CANDIDATES;

  return candidates.map(auditSlhHotelCandidate);
}
