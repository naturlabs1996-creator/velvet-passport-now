import { assessNowTrust, type TrustEvidence, type TrustRisk, type TrustSubject, type TrustVerificationStatus } from "./now-trust-gate";

export type TicketCandidate = {
  id: string;
  title: string;
  destination: string;
  durationMinutes: number;
  travelMinutes: number;
  departureTime?: string;
  flexibleDeparture?: boolean;
  productUrl: string;
  provider: "viator";
  currentPrice?: number;
  originalPrice?: number;
  currency?: string;
  availabilityVerifiedAt?: string;
  priceVerifiedAt?: string;
  trustSubject?: TrustSubject;
  trustEvidence?: TrustEvidence[];
  touristTrapRisk?: TrustRisk;
  massMarketRisk?: TrustRisk;
  editorialApproved?: boolean;
};

export type TicketContext = {
  availableMinutes: number;
  elapsedMinutes?: number;
  protectedMarginMinutes?: number;
  nextObligationInMinutes?: number;
  maxSuggestions?: number;
};

export type TicketRecommendation = TicketCandidate & {
  fit: boolean;
  score: number;
  committedMinutes: number;
  remainingMinutes: number;
  ticketMarginProtected: boolean;
  availabilityVerified: boolean;
  promotionVerified: boolean;
  trustStatus: TrustVerificationStatus;
  trustScore: number;
  trustReason: string;
  independentEvidenceCount: number;
  bookingReady: boolean;
  affiliateUrl: string;
  reason: string;
};

const VIATOR_PID = process.env.VIATOR_PARTNER_ID || "P00314403";
const VIATOR_MCID = process.env.VIATOR_MCID || "42383";
const VIATOR_MEDIUM = process.env.VIATOR_MEDIUM || "link";
const REQUIRED_SUGGESTIONS = 3;

function safeCampaign(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "now-ticket";
}

export function isExactViatorProductUrl(productUrl: string) {
  try {
    const url = new URL(productUrl);
    if (url.protocol !== "https:" || !/(^|\.)viator\.com$/i.test(url.hostname)) return false;
    if (!/^\/tours\//i.test(url.pathname)) return false;
    return /\/d\d+-[A-Za-z0-9]+\/?$/i.test(url.pathname);
  } catch {
    return false;
  }
}

export function buildViatorAffiliateUrl(productUrl: string, campaign: string) {
  if (!isExactViatorProductUrl(productUrl)) throw new Error("Viator URL must point to an exact product page");
  const url = new URL(productUrl);
  url.searchParams.set("pid", VIATOR_PID);
  url.searchParams.set("mcid", VIATOR_MCID);
  url.searchParams.set("medium", VIATOR_MEDIUM);
  url.searchParams.set("medium_version", "selector");
  url.searchParams.set("campaign", safeCampaign(campaign));
  return url.toString();
}

function freshEnough(iso?: string, maxAgeMinutes = 30) {
  if (!iso) return false;
  const ts = Date.parse(iso);
  return Number.isFinite(ts) && Date.now() - ts >= 0 && Date.now() - ts <= maxAgeMinutes * 60_000;
}

function timeToMinutes(value?: string) {
  if (!value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function timingPenalty(candidate: TicketCandidate) {
  const departure = timeToMinutes(candidate.departureTime);
  if (departure === null) return candidate.flexibleDeparture ? 0 : 4;
  return 0;
}

function verifiedPromotion(candidate: TicketCandidate) {
  return typeof candidate.currentPrice === "number"
    && typeof candidate.originalPrice === "number"
    && candidate.currentPrice < candidate.originalPrice
    && freshEnough(candidate.priceVerifiedAt, 30);
}

export function rankTicketCandidates(candidates: TicketCandidate[], context: TicketContext): TicketRecommendation[] {
  const elapsed = Math.max(0, context.elapsedMinutes ?? 0);
  const protectedMargin = Math.max(10, context.protectedMarginMinutes ?? 15);
  const totalBudget = Math.max(15, context.availableMinutes);
  const hardWindow = typeof context.nextObligationInMinutes === "number"
    ? Math.min(totalBudget, Math.max(0, context.nextObligationInMinutes))
    : totalBudget;

  const ranked = candidates
    .filter((candidate) => isExactViatorProductUrl(candidate.productUrl))
    .map((candidate) => {
      const committedMinutes = Math.max(0, candidate.travelMinutes) + Math.max(1, candidate.durationMinutes);
      const remainingMinutes = Math.max(0, hardWindow - elapsed - committedMinutes);
      const availabilityVerified = freshEnough(candidate.availabilityVerifiedAt, 15);
      const ticketMarginProtected = remainingMinutes >= protectedMargin;
      const promotionVerified = verifiedPromotion(candidate);
      const trust = assessNowTrust({
        provider: candidate.provider,
        subject: candidate.trustSubject,
        evidence: candidate.trustEvidence,
        touristTrapRisk: candidate.touristTrapRisk,
        massMarketRisk: candidate.massMarketRisk,
        editorialApproved: candidate.editorialApproved,
      });
      const trustApproved = trust.status === "approved";
      const bookingReady = availabilityVerified && ticketMarginProtected && trustApproved;
      const fit = bookingReady;

      let score = 100;
      if (!ticketMarginProtected) score -= 70;
      if (!availabilityVerified) score -= 40;
      if (!trustApproved) score -= 60;
      score += Math.round((trust.trustScore - 70) / 5);
      if (candidate.flexibleDeparture) score += 8;
      if (promotionVerified) score += 6;
      score -= timingPenalty(candidate);
      score -= Math.min(20, Math.round(committedMinutes / 20));

      const reason = !trustApproved
        ? `NOW Trust Gate blocked this offer: ${trust.reason}`
        : !ticketMarginProtected
          ? "Does not fit without sacrificing the protected margin."
          : !availabilityVerified
            ? "Schedule fit is possible, but live availability is not fresh enough to recommend booking."
            : "Fits the current schedule, live availability is fresh, and the risk-weighted trust check passed.";

      return {
        ...candidate,
        fit,
        score,
        committedMinutes,
        remainingMinutes,
        ticketMarginProtected,
        availabilityVerified,
        promotionVerified,
        trustStatus: trust.status,
        trustScore: trust.trustScore,
        trustReason: trust.reason,
        independentEvidenceCount: trust.independentEvidenceCount,
        bookingReady,
        affiliateUrl: buildViatorAffiliateUrl(candidate.productUrl, `paris-now-${candidate.id}`),
        reason,
      };
    })
    .filter((candidate) => candidate.bookingReady)
    .sort((a, b) => b.score - a.score || a.committedMinutes - b.committedMinutes);

  const requested = Math.max(1, Math.min(5, context.maxSuggestions ?? REQUIRED_SUGGESTIONS));
  const required = requested === REQUIRED_SUGGESTIONS ? REQUIRED_SUGGESTIONS : requested;
  if (ranked.length < required) return [];
  return ranked.slice(0, required);
}

export const PARIS_TICKET_SEEDS: TicketCandidate[] = [
  {
    id: "louvre-timed-entry",
    title: "Louvre Museum timed entry",
    destination: "Louvre Museum",
    durationMinutes: 180,
    travelMinutes: 20,
    productUrl: "https://www.viator.com/tours/Paris/Entry-ticket-for-the-Louvre-Museum-in-Paris/d479-374060P8",
    provider: "viator",
    trustSubject: "museum-ticket",
    touristTrapRisk: "unknown",
    massMarketRisk: "unknown",
    editorialApproved: false,
  },
  {
    id: "seine-pont-neuf",
    title: "Seine sightseeing cruise from Pont Neuf",
    destination: "Pont Neuf",
    durationMinutes: 60,
    travelMinutes: 15,
    flexibleDeparture: true,
    productUrl: "https://www.viator.com/tours/Paris/Paris-Seine-River-Sightseeing-cruise/d479-9511P19",
    provider: "viator",
    trustSubject: "tour-activity",
    touristTrapRisk: "unknown",
    massMarketRisk: "unknown",
    editorialApproved: false,
  },
  {
    id: "seine-sightseeing",
    title: "Seine River sightseeing cruise",
    destination: "Seine River",
    durationMinutes: 80,
    travelMinutes: 20,
    flexibleDeparture: true,
    productUrl: "https://www.viator.com/tours/Paris/Paris-Seine-River-Sightseeing-Cruise-Tour/d479-242747P85",
    provider: "viator",
    trustSubject: "tour-activity",
    touristTrapRisk: "unknown",
    massMarketRisk: "unknown",
    editorialApproved: false,
  },
];
