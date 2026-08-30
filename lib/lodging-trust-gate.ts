import { assessNowTrust, type TrustEvidence, type TrustRisk, type TrustVerificationStatus } from "./now-trust-gate";

export type LodgingServiceConsistency = "strong" | "acceptable" | "inconsistent" | "unknown";
export type LodgingLocationFit = "strong" | "acceptable" | "weak" | "unknown";

export type LodgingTrustInput = {
  name: string;
  provider?: string;
  evidence?: TrustEvidence[];
  touristTrapRisk?: TrustRisk;
  massMarketRisk?: TrustRisk;
  cleanlinessRisk?: TrustRisk;
  safetyRisk?: TrustRisk;
  infestationRisk?: TrustRisk;
  valueRisk?: TrustRisk;
  verifiedRecentInfestationReports?: number;
  unverifiedRecentInfestationSignals?: number;
  serviceConsistency?: LodgingServiceConsistency;
  locationFit?: LodgingLocationFit;
  editorialApproved?: boolean;
  lesserKnown?: boolean;
  partnerRelationship?: boolean;
};

export type LodgingTrustAssessment = {
  status: TrustVerificationStatus;
  trustScore: number;
  independentEvidenceCount: number;
  reason: string;
  hardStopReasons: string[];
  reviewFlags: string[];
  commercialRelationshipIgnored: true;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function assessLodgingTrust(input: LodgingTrustInput): LodgingTrustAssessment {
  const cleanlinessRisk = input.cleanlinessRisk ?? "unknown";
  const safetyRisk = input.safetyRisk ?? "unknown";
  const infestationRisk = input.infestationRisk ?? "unknown";
  const valueRisk = input.valueRisk ?? "unknown";
  const serviceConsistency = input.serviceConsistency ?? "unknown";
  const locationFit = input.locationFit ?? "unknown";
  const verifiedRecentInfestationReports = Math.max(0, input.verifiedRecentInfestationReports ?? 0);
  const unverifiedRecentInfestationSignals = Math.max(0, input.unverifiedRecentInfestationSignals ?? 0);

  const base = assessNowTrust({
    provider: input.provider ?? "unknown",
    subject: "lodging",
    evidence: input.evidence,
    touristTrapRisk: input.touristTrapRisk,
    massMarketRisk: input.massMarketRisk,
    editorialApproved: input.editorialApproved,
    lesserKnown: input.lesserKnown,
  });

  const hardStopReasons: string[] = [];
  if (verifiedRecentInfestationReports >= 1) hardStopReasons.push("A verified recent bedbug or infestation report exists.");
  if (infestationRisk === "high") hardStopReasons.push("Infestation risk is high.");
  if (cleanlinessRisk === "high") hardStopReasons.push("Recent cleanliness risk is high.");
  if (safetyRisk === "high") hardStopReasons.push("Guest safety risk is high.");
  if (input.touristTrapRisk === "high") hardStopReasons.push("Tourist-trap risk is high.");

  let score = base.trustScore;
  if (cleanlinessRisk === "low") score += 8;
  if (cleanlinessRisk === "medium") score -= 12;
  if (safetyRisk === "low") score += 6;
  if (safetyRisk === "medium") score -= 15;
  if (infestationRisk === "low") score += 8;
  if (infestationRisk === "medium") score -= 18;
  if (valueRisk === "medium") score -= 8;
  if (valueRisk === "high") score -= 20;
  if (serviceConsistency === "strong") score += 5;
  if (serviceConsistency === "inconsistent") score -= 12;
  if (locationFit === "strong") score += 5;
  if (locationFit === "weak") score -= 10;
  if (unverifiedRecentInfestationSignals >= 2) score -= 20;
  score = clampScore(score);

  if (hardStopReasons.length > 0) {
    return {
      status: "rejected",
      trustScore: score,
      independentEvidenceCount: base.independentEvidenceCount,
      reason: hardStopReasons.join(" "),
      hardStopReasons,
      reviewFlags: [],
      commercialRelationshipIgnored: true,
    };
  }

  const reviewFlags: string[] = [];
  if (base.status !== "approved") reviewFlags.push(base.reason);
  if (cleanlinessRisk === "unknown") reviewFlags.push("Recent cleanliness evidence is incomplete.");
  if (safetyRisk === "unknown") reviewFlags.push("Recent safety evidence is incomplete.");
  if (infestationRisk === "unknown") reviewFlags.push("Recent infestation/bedbug evidence is incomplete.");
  if (unverifiedRecentInfestationSignals >= 1) reviewFlags.push("Recent unverified infestation signals require manual review.");
  if (serviceConsistency === "inconsistent") reviewFlags.push("Recent service quality appears inconsistent.");
  if (valueRisk === "high") reviewFlags.push("Value-for-money risk is high.");
  if (locationFit === "weak") reviewFlags.push("Location fit is weak for the intended NOW traveler context.");

  const approved = base.status === "approved"
    && cleanlinessRisk === "low"
    && safetyRisk !== "high"
    && infestationRisk === "low"
    && verifiedRecentInfestationReports === 0
    && unverifiedRecentInfestationSignals === 0
    && valueRisk !== "high"
    && serviceConsistency !== "inconsistent"
    && locationFit !== "weak"
    && score >= 75;

  return {
    status: approved ? "approved" : "review_required",
    trustScore: score,
    independentEvidenceCount: base.independentEvidenceCount,
    reason: approved
      ? "Property passed the specialized NOW Lodging Trust Gate."
      : reviewFlags.join(" ") || "Property requires additional verification before NOW recommends it.",
    hardStopReasons,
    reviewFlags,
    commercialRelationshipIgnored: true,
  };
}

export function passesLodgingTrustGate(input: LodgingTrustInput) {
  return assessLodgingTrust(input).status === "approved";
}
