import type { ResearchLead } from "./research-collectors";
import type { ClaimVerificationResult } from "./claim-verifier";
import type { SafeDiscoveryCopy } from "./safe-copy-composer";
import type { PageVerificationResult } from "./research-verification";
import { scoreResearchLeadRelevance } from "./research-relevance-engine";
import { isInternalResearchClaim } from "./internal-claim-firewall";
import { canonicalSourceFamily } from "./source-family";

const ALLOWED_OFFICIAL = ["paris.fr", "parisjetaime.com", "france.fr", "culture.gouv.fr", "musee-orsay.fr", "musee-orangerie.fr", "musee-rodin.fr"];
function hostOf(url: string) { try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return "unknown"; } }
function officialAllowed(host: string) { return ALLOWED_OFFICIAL.some((allowed) => host === allowed || host.endsWith(`.${allowed}`)); }
function syntheticLead(theme: string, name: string, rawClaims: string[]): ResearchLead {
  return { id: `audit:${theme}:${name}`, pageId: `audit:${theme}`, theme, query: theme, name, snippet: rawClaims.join(" "), url: "https://example.invalid/audit", sourceType: "EDITORIAL", publisher: "audit", independentKey: "audit.invalid", observedAt: new Date().toISOString(), address: "Paris, France", lat: 48.8566, lon: 2.3522, rawClaims };
}

export function runResearchQualityAudit(input: {
  researchCollections: Array<{ leads: ResearchLead[] }>;
  claimPortfolios: ClaimVerificationResult[][];
  safeCopyPortfolios: SafeDiscoveryCopy[][];
  pageVerifications: PageVerificationResult[];
}) {
  const issues: Array<{ code: string; severity: "ERROR" | "WARN"; detail: string }> = [];
  const allLeads = input.researchCollections.flatMap((collection) => collection.leads);
  const allClaims = input.claimPortfolios.flat();
  const allSafe = input.safeCopyPortfolios.flat();

  for (const lead of allLeads) {
    if (lead.sourceType === "OFFICIAL" && !officialAllowed(hostOf(lead.url))) issues.push({ code: "FALSE_OFFICIAL_SOURCE", severity: "ERROR", detail: `${lead.name} marked OFFICIAL from ${hostOf(lead.url)}` });
  }
  for (const result of allClaims) {
    for (const claim of result.claims) {
      if (claim.status === "VERIFIED" && claim.risk === "HIGH" && claim.independentSources < 2) issues.push({ code: "HIGH_RISK_SINGLE_SOURCE_VERIFIED", severity: "ERROR", detail: `${result.candidateName}: ${claim.claim}` });
      const families = new Set(claim.evidence.map((item) => canonicalSourceFamily(item.independentKey)));
      if (claim.independentSources !== families.size) issues.push({ code: "SOURCE_FAMILY_COUNT_MISMATCH", severity: "ERROR", detail: `${result.candidateName}: reported ${claim.independentSources}, canonical ${families.size}` });
    }
  }
  for (const copy of allSafe) {
    for (const sentence of [...copy.summary, ...copy.facts]) {
      if (isInternalResearchClaim(sentence.text)) issues.push({ code: "INTERNAL_METADATA_SAFE_COPY", severity: "ERROR", detail: `${copy.name}: ${sentence.text}` });
      if (!sentence.sourceIds.length || !sentence.sourceUrls.length) issues.push({ code: "UNTRACED_SAFE_COPY", severity: "ERROR", detail: `${copy.name}: ${sentence.text}` });
    }
  }
  for (const verification of input.pageVerifications) {
    if (verification.status === "PUBLISHABLE" && verification.usableDiscoveries.length < 5) issues.push({ code: "PUBLISHABLE_BELOW_FIVE", severity: "ERROR", detail: verification.pageId });
  }

  const adversarial = [
    { theme: "beyond-the-classics", name: "Musée du Louvre", claims: ["INTENT_EVIDENCE beyond-the-classics: hidden | status=CONFIRMED", "EXPOSURE_EVIDENCE level=MASS_TOURISM score=90"], mustReject: true },
    { theme: "paris-after-dark", name: "Paris Hilton", claims: ["night Paris"], mustReject: true },
    { theme: "quiet-paris", name: "Eiffel Tower", claims: ["quiet Paris", "top 10 iconic world-famous"], mustReject: true },
    { theme: "unusual-museums", name: "Arc de Triomphe", claims: ["unusual museum Paris", "must-see iconic landmark"], mustReject: true },
  ].map((probe) => {
    const score = scoreResearchLeadRelevance(syntheticLead(probe.theme, probe.name, probe.claims));
    const passed = probe.mustReject ? score.decision === "REJECT" : score.decision === "ACCEPT";
    if (!passed) issues.push({ code: "ADVERSARIAL_FALSE_POSITIVE", severity: "ERROR", detail: `${probe.theme}: ${probe.name} => ${score.decision}` });
    return { ...probe, decision: score.decision, score: score.total, exposureLevel: score.exposureLevel, passed };
  });

  const errors = issues.filter((issue) => issue.severity === "ERROR").length;
  return {
    status: errors === 0 ? "PASS" as const : "FAIL" as const,
    errors,
    warnings: issues.filter((issue) => issue.severity === "WARN").length,
    issues: issues.slice(0, 30),
    adversarial,
    auditedThemes: [...new Set([...allLeads.map((lead) => lead.theme), ...adversarial.map((item) => item.theme)])],
    rule: "Quality audit fails on false official labeling, duplicate publisher-family inflation, internal metadata leakage, untraced Safe Copy, high-risk single-source verification, publication below five, or adversarial tourist/noise false positives.",
  };
}
