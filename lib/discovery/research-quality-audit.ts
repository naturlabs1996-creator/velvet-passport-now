import type { ResearchLead } from "./research-collectors";
import type { ClaimVerificationResult } from "./claim-verifier";
import type { SafeDiscoveryCopy } from "./safe-copy-composer";
import type { PageVerificationResult } from "./research-verification";
import { scoreResearchLeadRelevance } from "./research-relevance-engine";
import { scoreExposure, type ExposureVerdict } from "./exposure-intelligence";
import { isInternalResearchClaim } from "./internal-claim-firewall";
import { canonicalSourceFamily } from "./source-family";

const ALLOWED_OFFICIAL = ["paris.fr", "parisjetaime.com", "france.fr", "culture.gouv.fr", "musee-orsay.fr", "musee-orangerie.fr", "musee-rodin.fr"];
function hostOf(url: string) { try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return "unknown"; } }
function officialAllowed(host: string) { return ALLOWED_OFFICIAL.some((allowed) => host === allowed || host.endsWith(`.${allowed}`)); }
function syntheticLead(theme: string, name: string, rawClaims: string[]): ResearchLead {
  return { id: `audit:${theme}:${name}`, pageId: `audit:${theme}`, theme, query: theme, name, snippet: rawClaims.join(" "), url: "https://example.invalid/audit", sourceType: "EDITORIAL", publisher: "audit", independentKey: "audit.invalid", observedAt: new Date().toISOString(), address: "Paris, France", lat: 48.8566, lon: 2.3522, rawClaims };
}
function exposureProbeLead(input: {
  id: string;
  name: string;
  theme: string;
  audits: string[];
  traces: Array<{ url: string; family: string; text: string }>;
}): ResearchLead {
  const observedAt = new Date().toISOString();
  return {
    id: `audit:exposure:${input.id}`,
    pageId: "audit:exposure-confrontation",
    theme: input.theme,
    query: input.theme,
    name: input.name,
    snippet: input.name,
    url: "https://example.invalid/exposure-audit",
    sourceType: "EDITORIAL",
    publisher: "audit",
    independentKey: "audit.invalid",
    observedAt,
    address: "Paris, France",
    lat: 48.8566,
    lon: 2.3522,
    rawClaims: input.audits,
    evidenceTrace: input.traces.map((trace, index) => ({
      sourceId: `audit-exposure:${input.id}:${index}`,
      sourceType: "EDITORIAL" as const,
      publisher: trace.family,
      url: trace.url,
      title: `${input.name} exposure confrontation`,
      observedAt,
      claims: [trace.text],
      independentKey: trace.family,
    })),
  };
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
    { theme: "forgotten-passages", name: "Conciergerie", claims: ["historic monument in Paris", "galerie inside the monument"], mustReject: true },
  ].map((probe) => {
    const score = scoreResearchLeadRelevance(syntheticLead(probe.theme, probe.name, probe.claims));
    const passed = probe.mustReject ? score.decision === "REJECT" : score.decision === "ACCEPT";
    if (!passed) issues.push({ code: "ADVERSARIAL_FALSE_POSITIVE", severity: "ERROR", detail: `${probe.theme}: ${probe.name} => ${score.decision}` });
    return { ...probe, decision: score.decision, score: score.total, exposureLevel: score.exposureLevel, passed };
  });

  const exposureConfrontationSpecs: Array<{
    id: string;
    label: string;
    expected: ExposureVerdict;
    lead: ResearchLead;
  }> = [
    {
      id: "low-exposure-covered",
      label: "Low exposure with sufficient audited coverage",
      expected: "PASS",
      lead: exposureProbeLead({
        id: "low-exposure-covered",
        name: "Audit Discreet Atelier",
        theme: "beyond-the-classics",
        audits: [
          "EXPOSURE_AUDIT family=visitparisregion.com status=CHECKED_NO_ANGLE opened=1 matched=2 inspected=1",
          "EXPOSURE_AUDIT family=sortiraparis.com status=EXPOSED opened=1 matched=4 inspected=1",
          "EXPOSURE_AUDIT family=paris.fr status=CHECKED_NO_ANGLE opened=1 matched=3 inspected=1",
        ],
        traces: [
          { url: "https://www.sortiraparis.com/audit-discreet-atelier", family: "sortiraparis.com", text: "Un atelier insolite et discret à Paris." },
        ],
      }),
    },
    {
      id: "egouts-multi-family-exposed",
      label: "Musée des égouts confrontation: exact angle exposed by official tourism plus travel editorial",
      expected: "FAIL",
      lead: exposureProbeLead({
        id: "egouts-multi-family-exposed",
        name: "Musée des égouts de Paris",
        theme: "unusual-museums",
        audits: [
          "EXPOSURE_AUDIT family=visitparisregion.com status=EXPOSED opened=1 matched=4 inspected=1",
          "EXPOSURE_AUDIT family=sortiraparis.com status=EXPOSED opened=1 matched=8 inspected=1",
          "EXPOSURE_AUDIT family=paris.fr status=CHECKED_NO_ANGLE opened=1 matched=6 inspected=1",
        ],
        traces: [
          { url: "https://www.visitparisregion.com/audit-egouts", family: "visitparisregion.com", text: "Un musée insolite consacré aux égouts et au Paris souterrain." },
          { url: "https://www.sortiraparis.com/audit-egouts", family: "sortiraparis.com", text: "Le musée des égouts, une visite insolite et souterraine à Paris." },
        ],
      }),
    },
    {
      id: "strongly-exposed",
      label: "Strongly exposed exact angle across tourism, editorial and marketplace families",
      expected: "FAIL",
      lead: exposureProbeLead({
        id: "strongly-exposed",
        name: "Audit Famous Underground Attraction",
        theme: "unusual-museums",
        audits: [
          "EXPOSURE_AUDIT family=parisjetaime.com status=EXPOSED opened=1 matched=10 inspected=2",
          "EXPOSURE_AUDIT family=sortiraparis.com status=EXPOSED opened=1 matched=12 inspected=2",
          "EXPOSURE_AUDIT family=getyourguide.com status=EXPOSED opened=1 matched=20 inspected=2",
        ],
        traces: [
          { url: "https://parisjetaime.com/audit-famous", family: "parisjetaime.com", text: "Une expérience souterraine insolite incontournable à Paris." },
          { url: "https://www.sortiraparis.com/audit-famous", family: "sortiraparis.com", text: "Top 10 des visites insolites et souterraines à Paris." },
          { url: "https://www.getyourguide.com/audit-famous", family: "getyourguide.com", text: "Unusual underground museum experience in Paris." },
        ],
      }),
    },
    {
      id: "insufficient-coverage",
      label: "Low observed exposure but insufficient audit coverage",
      expected: "HOLD_UNKNOWN",
      lead: exposureProbeLead({
        id: "insufficient-coverage",
        name: "Audit Hidden Courtyard",
        theme: "beyond-the-classics",
        audits: [
          "EXPOSURE_AUDIT family=sortiraparis.com status=EXPOSED opened=1 matched=2 inspected=1",
          "EXPOSURE_AUDIT family=parisjetaime.com status=UNAVAILABLE opened=0 matched=0 inspected=0",
          "EXPOSURE_AUDIT family=visitparisregion.com status=UNAVAILABLE opened=0 matched=0 inspected=0",
        ],
        traces: [
          { url: "https://www.sortiraparis.com/audit-hidden-courtyard", family: "sortiraparis.com", text: "Une cour insolite et discrète à Paris." },
        ],
      }),
    },
  ];

  const exposureConfrontation = exposureConfrontationSpecs.map((probe) => {
    const result = scoreExposure(probe.lead);
    const passed = result.verdict === probe.expected;
    if (!passed) issues.push({ code: "EXPOSURE_CONFRONTATION_MISMATCH", severity: "ERROR", detail: `${probe.id}: expected ${probe.expected}, got ${result.verdict}` });
    return {
      id: probe.id,
      label: probe.label,
      expected: probe.expected,
      actual: result.verdict,
      passed,
      degree: result.exposureDegree,
      exactScore: result.exactAngleExposureScore,
      level: result.level,
      auditedFamilies: result.auditedFamilies,
      officialTourismAudited: result.officialTourismAudited,
      coveragePass: result.auditCoveragePass,
      sourceFamilies: result.sourceFamilies,
      auditCoverage: result.auditCoverage,
    };
  });

  const errors = issues.filter((issue) => issue.severity === "ERROR").length;
  return {
    status: errors === 0 ? "PASS" as const : "FAIL" as const,
    errors,
    warnings: issues.filter((issue) => issue.severity === "WARN").length,
    issues: issues.slice(0, 30),
    adversarial,
    exposureConfrontation,
    auditedThemes: [...new Set([...allLeads.map((lead) => lead.theme), ...adversarial.map((item) => item.theme)])],
    rule: "Quality audit fails on false official labeling, duplicate publisher-family inflation, internal metadata leakage, untraced Safe Copy, high-risk single-source verification, publication below five, adversarial tourist/noise/semantic false positives, or any Exposure confrontation regression where PASS, FAIL and HOLD_UNKNOWN no longer separate according to exact-angle evidence and audit coverage.",
  };
}
