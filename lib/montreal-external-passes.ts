export type MontrealExternalPassId = "passeport-mtl";

export type MontrealExternalPassDefinition = {
  id: MontrealExternalPassId;
  name: string;
  issuer: string;
  city: "montreal";
  status: "supported";
  benefitDataStatus: "pending-verified-catalog" | "verified";
};

export type MontrealPassBenefit = {
  id: string;
  passId: MontrealExternalPassId;
  partnerName: string;
  category: "restaurant" | "cafe" | "attraction" | "museum" | "experience" | "other";
  routeIds: string[];
  benefitSummary: string;
  validFrom?: string;
  validUntil?: string;
  verificationStatus: "verified" | "review_required";
  lastVerified: string;
};

export const MONTREAL_EXTERNAL_PASSES: MontrealExternalPassDefinition[] = [
  {
    id: "passeport-mtl",
    name: "Passeport MTL",
    issuer: "Tourisme Montréal",
    city: "montreal",
    status: "supported",
    benefitDataStatus: "pending-verified-catalog",
  },
];

// Benefits stay empty until each current offer is verified from an authoritative source.
// NOW must never invent or assume a pass benefit from old marketing copy or provider data.
export const MONTREAL_PASS_BENEFITS: MontrealPassBenefit[] = [];

function isSupportedPass(value: string): value is MontrealExternalPassId {
  return MONTREAL_EXTERNAL_PASSES.some((pass) => pass.id === value);
}

export function parseMontrealTravelerPasses(raw: string | null | undefined) {
  const requested = String(raw || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const recognized = Array.from(new Set(requested.filter(isSupportedPass)));
  const unknown = Array.from(new Set(requested.filter((value) => !isSupportedPass(value))));
  return { recognized, unknown };
}

export function getMontrealPassContext(routeId: string, travelerPasses: MontrealExternalPassId[]) {
  const activePasses = MONTREAL_EXTERNAL_PASSES.filter((pass) => travelerPasses.includes(pass.id));
  const matchingBenefits = MONTREAL_PASS_BENEFITS.filter((benefit) =>
    travelerPasses.includes(benefit.passId)
      && benefit.routeIds.includes(routeId)
      && benefit.verificationStatus === "verified"
  );

  return {
    activePasses,
    matchingBenefits,
    benefitAwarenessEnabled: activePasses.length > 0,
    recommendationRule: "A pass benefit can improve value or timing, but it never bypasses NOW Trust Gate or editorial quality checks.",
  };
}
