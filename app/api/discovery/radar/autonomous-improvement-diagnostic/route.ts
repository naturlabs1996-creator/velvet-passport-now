import { NextResponse } from "next/server";
import { AUTONOMOUS_IMPROVEMENT_RULES, evaluateImprovementProposal } from "@/lib/discovery/autonomous-improvement-governor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const regression = evaluateImprovementProposal({
    domain: "WITNESS_SPATIAL_GRAMMAR",
    proposalId: "regression",
    description: "Improves recall but creates more false positives.",
    before: { benchmarkPassRate: 0.8, falsePositiveRate: 0.05, falseNegativeRate: 0.15 },
    after: { benchmarkPassRate: 0.88, falsePositiveRate: 0.08, falseNegativeRate: 0.08 },
    regressionAudit: "PASS",
    publicationCanary: "PASS",
    evidenceCases: 30,
    citiesCovered: ["paris-fr", "montreal-ca"],
    changedGates: false,
    changedThresholds: false,
  });

  const gateWeakening = evaluateImprovementProposal({
    domain: "HISTORICAL_PARCEL_MATCH",
    proposalId: "gate-weakening",
    description: "Relaxes exact parcel continuity to increase matches.",
    before: { benchmarkPassRate: 0.7, falsePositiveRate: 0.02, falseNegativeRate: 0.2 },
    after: { benchmarkPassRate: 0.9, falsePositiveRate: 0.02, falseNegativeRate: 0.08 },
    regressionAudit: "PASS",
    publicationCanary: "PASS",
    evidenceCases: 40,
    citiesCovered: ["paris-fr", "montreal-ca"],
    changedGates: true,
    changedThresholds: false,
  });

  const insufficient = evaluateImprovementProposal({
    domain: "STREET_LINEAGE",
    proposalId: "insufficient",
    description: "Promising lineage heuristic tested on too few cases.",
    before: { benchmarkPassRate: 0.75, falsePositiveRate: 0.03, falseNegativeRate: 0.16 },
    after: { benchmarkPassRate: 0.9, falsePositiveRate: 0.03, falseNegativeRate: 0.06 },
    regressionAudit: "PASS",
    publicationCanary: "PASS",
    evidenceCases: 5,
    citiesCovered: ["paris-fr"],
    changedGates: false,
    changedThresholds: false,
  });

  const promotable = evaluateImprovementProposal({
    domain: "WITNESS_SPATIAL_GRAMMAR",
    proposalId: "promotable",
    description: "Improves witness grammar across Paris and Montreal without increasing false positives.",
    before: { benchmarkPassRate: 0.78, falsePositiveRate: 0.04, falseNegativeRate: 0.16 },
    after: { benchmarkPassRate: 0.9, falsePositiveRate: 0.03, falseNegativeRate: 0.08 },
    regressionAudit: "PASS",
    publicationCanary: "PASS",
    evidenceCases: 28,
    citiesCovered: ["paris-fr", "montreal-ca"],
    changedGates: false,
    changedThresholds: false,
  });

  const checks = {
    regressionRejected: regression.decision === "REJECT_REGRESSION",
    gateWeakeningRejected: gateWeakening.decision === "REJECT_GATE_WEAKENING",
    insufficientEvidenceRejected: insufficient.decision === "REJECT_INSUFFICIENT_EVIDENCE",
    safeImprovementPromotable: promotable.decision === "PROMOTE_CANDIDATE",
    noDirectSelfAdoption:
      [regression, gateWeakening, insufficient, promotable].every((item) => item.automaticAdoptionAllowed === false),
  };

  const ok = Object.values(checks).every(Boolean);

  return NextResponse.json({
    ok,
    generatedAt: new Date().toISOString(),
    checks,
    cases: { regression, gateWeakening, insufficient, promotable },
    rules: AUTONOMOUS_IMPROVEMENT_RULES,
  }, {
    status: ok ? 200 : 500,
    headers: { "cache-control": "no-store, max-age=0" },
  });
}
