import type { AnswerPageSpec } from "./page-factory";

export type VerificationStatus = "VERIFIED" | "PARTIAL" | "UNVERIFIED" | "REJECTED";
export type PublishStatus = "PUBLISHABLE" | "RESEARCH_REQUIRED" | "HOLD";
export type EvidenceFreshness = "CURRENT" | "AGING" | "STALE" | "UNDATED";

export type ResearchEvidence = {
  sourceId: string;
  sourceType: "OFFICIAL" | "EDITORIAL" | "MAP" | "WIKIDATA" | "COMMUNITY" | "MARKETPLACE";
  publisher: string;
  url: string;
  title?: string;
  observedAt: string;
  publishedAt?: string;
  claims: string[];
  independentKey: string;
};

export type CandidateDiscovery = {
  id: string;
  name: string;
  city: string;
  theme: string;
  address?: string;
  neighborhood?: string;
  factualClaims: string[];
  timeSensitiveClaims: string[];
  evidence: ResearchEvidence[];
  velvetFit?: number;
};

export type VerifiedDiscovery = CandidateDiscovery & {
  verificationStatus: VerificationStatus;
  confidence: number;
  independentSources: number;
  officialSourcePresent: boolean;
  freshness: EvidenceFreshness;
  rejectedReasons: string[];
};

export type ResearchPacket = {
  pageId: string;
  theme: string;
  route: string;
  query: string;
  requiredDiscoveries: { min: number; target: number; max: number };
  requiredEvidence: {
    independentSourcesPerDiscovery: number;
    officialPreferred: boolean;
    timeSensitiveMaxAgeDays: number;
  };
  tasks: string[];
};

export type PageVerificationResult = {
  pageId: string;
  theme: string;
  status: PublishStatus;
  verifiedDiscoveries: VerifiedDiscovery[];
  usableDiscoveries: VerifiedDiscovery[];
  rejectedDiscoveries: VerifiedDiscovery[];
  unresolvedRequirements: string[];
  robots: "index,follow" | "noindex,nofollow";
  publishReasons: string[];
};

function daysBetween(iso: string, now: Date) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now.getTime() - then) / 86_400_000);
}

function evidenceFreshness(evidence: ResearchEvidence[], now: Date): EvidenceFreshness {
  if (!evidence.length) return "UNDATED";
  const dated = evidence.map((item) => item.publishedAt ?? item.observedAt).filter(Boolean);
  if (!dated.length) return "UNDATED";
  const newest = Math.min(...dated.map((date) => daysBetween(date, now)));
  if (newest <= 30) return "CURRENT";
  if (newest <= 180) return "AGING";
  return "STALE";
}

function independentSourceCount(evidence: ResearchEvidence[]) {
  return new Set(evidence.map((item) => item.independentKey.trim().toLowerCase()).filter(Boolean)).size;
}

function hasOfficialSource(evidence: ResearchEvidence[]) {
  return evidence.some((item) => item.sourceType === "OFFICIAL");
}

export function verifyDiscovery(candidate: CandidateDiscovery, now = new Date()): VerifiedDiscovery {
  const independentSources = independentSourceCount(candidate.evidence);
  const officialSourcePresent = hasOfficialSource(candidate.evidence);
  const freshness = evidenceFreshness(candidate.evidence, now);
  const rejectedReasons: string[] = [];

  if (!candidate.name.trim()) rejectedReasons.push("MISSING_NAME");
  if (!candidate.factualClaims.length) rejectedReasons.push("NO_FACTUAL_CLAIMS");
  if (independentSources < 1) rejectedReasons.push("NO_INDEPENDENT_EVIDENCE");
  if ((candidate.velvetFit ?? 0) > 0 && (candidate.velvetFit ?? 0) < 55) rejectedReasons.push("LOW_VELVET_FIT");

  const staleTimeSensitive = candidate.timeSensitiveClaims.length > 0 && freshness === "STALE";
  if (staleTimeSensitive) rejectedReasons.push("STALE_TIME_SENSITIVE_EVIDENCE");

  let verificationStatus: VerificationStatus = "UNVERIFIED";
  if (rejectedReasons.length) verificationStatus = "REJECTED";
  else if (independentSources >= 2 && (officialSourcePresent || independentSources >= 3)) verificationStatus = "VERIFIED";
  else if (independentSources >= 1) verificationStatus = "PARTIAL";

  let confidence = 0;
  confidence += Math.min(45, independentSources * 18);
  if (officialSourcePresent) confidence += 20;
  if (freshness === "CURRENT") confidence += 20;
  else if (freshness === "AGING") confidence += 10;
  if ((candidate.velvetFit ?? 0) >= 80) confidence += 15;
  confidence = Math.max(0, Math.min(100, Math.round(confidence)));
  if (verificationStatus === "REJECTED") confidence = Math.min(confidence, 25);

  return {
    ...candidate,
    verificationStatus,
    confidence,
    independentSources,
    officialSourcePresent,
    freshness,
    rejectedReasons,
  };
}

export function buildResearchPacket(page: AnswerPageSpec): ResearchPacket {
  return {
    pageId: page.id,
    theme: page.theme,
    route: page.route,
    query: page.seo.primaryKeyword,
    requiredDiscoveries: { min: 5, target: 7, max: 9 },
    requiredEvidence: {
      independentSourcesPerDiscovery: 2,
      officialPreferred: true,
      timeSensitiveMaxAgeDays: 30,
    },
    tasks: [
      `Find 7 candidate discoveries in ${page.city} that directly satisfy “${page.seo.primaryKeyword}”.`,
      "Capture the exact source URL and publisher for every factual claim.",
      "Prefer an official place/municipal/museum source plus one independent editorial or map source.",
      "Verify address/location separately from atmosphere or editorial-fit claims.",
      "Treat opening hours, prices, reservation rules and access restrictions as time-sensitive and re-check before publication.",
      "Reject generic tourist attractions unless the specific angle genuinely answers the search intent.",
      "Never infer that a place is hidden, secret, local-only or uncrowded without evidence supporting that characterization.",
    ],
  };
}

export function verifyPageResearch(
  page: AnswerPageSpec,
  candidates: CandidateDiscovery[],
  now = new Date(),
): PageVerificationResult {
  if (page.status === "HOLD") {
    return {
      pageId: page.id,
      theme: page.theme,
      status: "HOLD",
      verifiedDiscoveries: [],
      usableDiscoveries: [],
      rejectedDiscoveries: [],
      unresolvedRequirements: ["PAGE_FACTORY_HOLD"],
      robots: "noindex,nofollow",
      publishReasons: ["Page Factory marked this page HOLD."],
    };
  }

  const verifiedDiscoveries = candidates
    .filter((candidate) => candidate.theme === page.theme && candidate.city.toLowerCase() === page.city.toLowerCase())
    .map((candidate) => verifyDiscovery(candidate, now));
  const usableDiscoveries = verifiedDiscoveries.filter((item) => item.verificationStatus === "VERIFIED");
  const rejectedDiscoveries = verifiedDiscoveries.filter((item) => item.verificationStatus === "REJECTED");
  const unresolvedRequirements: string[] = [];

  if (usableDiscoveries.length < 5) unresolvedRequirements.push("MINIMUM_5_VERIFIED_DISCOVERIES");
  if (usableDiscoveries.some((item) => item.independentSources < 2)) unresolvedRequirements.push("TWO_INDEPENDENT_SOURCES_PER_DISCOVERY");
  if (usableDiscoveries.some((item) => item.timeSensitiveClaims.length > 0 && item.freshness !== "CURRENT")) {
    unresolvedRequirements.push("REFRESH_TIME_SENSITIVE_FACTS");
  }

  const status: PublishStatus = unresolvedRequirements.length ? "RESEARCH_REQUIRED" : "PUBLISHABLE";
  const publishReasons = status === "PUBLISHABLE"
    ? [
        `${usableDiscoveries.length} discoveries passed the verification threshold.`,
        "Each usable discovery has at least two independent evidence sources.",
        "Time-sensitive claims are current or absent.",
      ]
    : ["Verification gate remains closed until every unresolved requirement is satisfied."];

  return {
    pageId: page.id,
    theme: page.theme,
    status,
    verifiedDiscoveries,
    usableDiscoveries,
    rejectedDiscoveries,
    unresolvedRequirements,
    robots: status === "PUBLISHABLE" ? "index,follow" : "noindex,nofollow",
    publishReasons,
  };
}

export function buildResearchVerificationQueue(pages: AnswerPageSpec[]) {
  return pages
    .filter((page) => page.status !== "HOLD")
    .map((page) => ({
      packet: buildResearchPacket(page),
      verification: verifyPageResearch(page, []),
    }));
}
