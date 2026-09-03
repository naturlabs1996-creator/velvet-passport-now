import type { AssembledAnswerPage } from "./page-assembly";
import type { SafeDiscoveryCopy } from "./safe-copy-composer";
import type { PageVerificationResult } from "./research-verification";
import { isInternalResearchClaim } from "./internal-claim-firewall";

export type PublicationCanaryStatus = "PASS_PREVIEW" | "BLOCKED";

export function runPublicationCanary(input: {
  assembly: AssembledAnswerPage;
  verification?: PageVerificationResult;
  safeCopies: SafeDiscoveryCopy[];
}) {
  const readyCopies = input.safeCopies.filter((copy) => copy.status === "READY");
  const safeTexts = input.safeCopies.flatMap((copy) => [...copy.summary, ...copy.facts].map((item) => item.text));
  const traceable = input.safeCopies.every((copy) => [...copy.summary, ...copy.facts].every((item) => item.sourceIds.length > 0 && item.sourceUrls.length > 0));
  const internalLeaks = safeTexts.filter((text) => isInternalResearchClaim(text));
  const verifiedDiscoveries = input.verification?.usableDiscoveries.length ?? 0;
  const checks = {
    fiveVerifiedDiscoveries: verifiedDiscoveries >= 5,
    fiveReadySafeCopies: readyCopies.length >= 5,
    verificationPublishable: input.verification?.status === "PUBLISHABLE",
    assemblyReady: input.assembly.status === "READY_TO_RENDER",
    sourceAuditPresent: input.assembly.sourceAudit.length > 0,
    factualTraceComplete: traceable,
    internalMetadataAbsent: internalLeaks.length === 0,
    robotsOpenOnlyWhenReady: input.assembly.status === "READY_TO_RENDER" ? input.assembly.robots === "index,follow" : input.assembly.robots === "noindex,nofollow",
  };
  const blockers = Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key);
  const eligibleForPublic = blockers.length === 0;
  return {
    pageId: input.assembly.pageId,
    theme: input.assembly.theme,
    status: eligibleForPublic ? "PASS_PREVIEW" as const : "BLOCKED" as const,
    eligibleForPublic,
    verifiedDiscoveries,
    readySafeCopies: readyCopies.length,
    checks,
    blockers,
    rule: "Publication Canary is fail-closed: it can confirm readiness but can never override Research Verification, Safe Copy, source trace, robots or minimum-five gates.",
  };
}
