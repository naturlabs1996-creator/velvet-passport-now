import { assessNowTrust, type TrustEvidence, type TrustRisk, type TrustVerificationStatus } from "./now-trust-gate";

export type RestaurantHygieneStatus = "clear" | "concern" | "failed" | "unknown";
export type RestaurantLocalFit = "strong" | "acceptable" | "weak" | "unknown";

export type RestaurantTrustInput = {
  name: string;
  provider?: string;
  evidence?: TrustEvidence[];
  touristTrapRisk?: TrustRisk;
  massMarketRisk?: TrustRisk;
  valueRisk?: TrustRisk;
  qualityConsistencyRisk?: TrustRisk;
  hygieneStatus?: RestaurantHygieneStatus;
  verifiedRecentPestReports?: number;
  verifiedRecentSeriousFoodSafetyComplaints?: number;
  ownershipOrConceptChangedRecently?: boolean;
  localFit?: RestaurantLocalFit;
  editorialApproved?: boolean;
  lesserKnown?: boolean;
  partnerRelationship?: boolean;
};

export type RestaurantTrustAssessment = {
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

export function assessRestaurantTrust(input: RestaurantTrustInput): RestaurantTrustAssessment {
  const hygieneStatus = input.hygieneStatus ?? "unknown";
  const valueRisk = input.valueRisk ?? "unknown";
  const qualityConsistencyRisk = input.qualityConsistencyRisk ?? "unknown";
  const localFit = input.localFit ?? "unknown";
  const verifiedRecentPestReports = Math.max(0, input.verifiedRecentPestReports ?? 0);
  const verifiedRecentSeriousFoodSafetyComplaints = Math.max(0, input.verifiedRecentSeriousFoodSafetyComplaints ?? 0);

  const base = assessNowTrust({
    provider: input.provider ?? "unknown",
    subject: "restaurant",
    evidence: input.evidence,
    touristTrapRisk: input.touristTrapRisk,
    massMarketRisk: input.massMarketRisk,
    editorialApproved: input.editorialApproved,
    lesserKnown: input.lesserKnown,
  });

  const hardStopReasons: string[] = [];
  if (hygieneStatus === "failed") hardStopReasons.push("Recent hygiene verification failed.");
  if (verifiedRecentPestReports >= 1) hardStopReasons.push("A verified recent pest or infestation report exists.");
  if (verifiedRecentSeriousFoodSafetyComplaints >= 2) hardStopReasons.push("Multiple verified recent serious food-safety complaints exist.");
  if (input.touristTrapRisk === "high") hardStopReasons.push("Tourist-trap risk is high.");
  if (qualityConsistencyRisk === "high") hardStopReasons.push("Recent quality consistency risk is high.");

  let score = base.trustScore;
  if (hygieneStatus === "clear") score += 8;
  if (hygieneStatus === "concern") score -= 20;
  if (valueRisk === "medium") score -= 8;
  if (valueRisk === "high") score -= 20;
  if (qualityConsistencyRisk === "medium") score -= 10;
  if (qualityConsistencyRisk === "high") score -= 25;
  if (localFit === "strong") score += 6;
  if (localFit === "weak") score -= 10;
  if (input.ownershipOrConceptChangedRecently) score -= 8;
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
  if (hygieneStatus === "unknown") reviewFlags.push("Recent hygiene status has not been independently verified.");
  if (hygieneStatus === "concern") reviewFlags.push("Recent hygiene evidence contains a concern that requires review.");
  if (valueRisk === "high") reviewFlags.push("Value-for-money risk is high.");
  if (qualityConsistencyRisk === "medium") reviewFlags.push("Recent quality appears inconsistent.");
  if (input.ownershipOrConceptChangedRecently) reviewFlags.push("Recent ownership or concept change requires a fresh editorial check.");
  if (localFit === "weak") reviewFlags.push("The restaurant has weak local fit for Velvet/NOW positioning.");

  const approved = base.status === "approved"
    && hygieneStatus === "clear"
    && valueRisk !== "high"
    && qualityConsistencyRisk !== "high"
    && localFit !== "weak"
    && score >= 72;

  return {
    status: approved ? "approved" : "review_required",
    trustScore: score,
    independentEvidenceCount: base.independentEvidenceCount,
    reason: approved
      ? "Restaurant passed the specialized NOW Restaurant Trust Gate."
      : reviewFlags.join(" ") || "Restaurant requires additional verification before NOW recommends it.",
    hardStopReasons,
    reviewFlags,
    commercialRelationshipIgnored: true,
  };
}

export function passesRestaurantTrustGate(input: RestaurantTrustInput) {
  return assessRestaurantTrust(input).status === "approved";
}
