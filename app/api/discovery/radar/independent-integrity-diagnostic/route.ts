import { NextResponse } from "next/server";
import { verifyIntegrity, INDEPENDENT_INTEGRITY_RULE } from "@/lib/discovery/independent-integrity-verifier";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const clean = verifyIntegrity({
    claimId: "clean",
    claimText: "Former street name is corroborated by official records.",
    claimedStatus: "VERIFIED",
    claimedConfidence: "HIGH",
    sourceIds: ["a", "b"],
    sourceUrls: ["https://example.invalid/a", "https://example.invalid/b"],
    independentSourceFamilies: 2,
    contradictionsKnown: [],
    contradictionsDisclosed: [],
    verifierStatus: "VERIFIED",
    verifierConfidence: "HIGH",
  });

  const mismatch = verifyIntegrity({
    claimId: "mismatch",
    claimText: "Exact historical door identified.",
    claimedStatus: "PROBABLE",
    claimedConfidence: "HIGH",
    sourceIds: ["a"],
    sourceUrls: ["https://example.invalid/a"],
    independentSourceFamilies: 1,
    contradictionsKnown: [],
    contradictionsDisclosed: [],
    verifierStatus: "HYPOTHESIS",
    verifierConfidence: "LOW",
  });

  const unsupportedVerified = verifyIntegrity({
    claimId: "unsupported",
    claimText: "Exact historical parcel is verified.",
    claimedStatus: "VERIFIED",
    claimedConfidence: "HIGH",
    sourceIds: [],
    sourceUrls: [],
    independentSourceFamilies: 0,
    contradictionsKnown: [],
    contradictionsDisclosed: [],
    verifierStatus: "HYPOTHESIS",
    verifierConfidence: "NONE",
  });

  const concealedContradiction = verifyIntegrity({
    claimId: "concealed",
    claimText: "The same entrance survived unchanged.",
    claimedStatus: "VERIFIED",
    claimedConfidence: "HIGH",
    sourceIds: ["a"],
    sourceUrls: ["https://example.invalid/a"],
    independentSourceFamilies: 1,
    contradictionsKnown: ["1908 facade reconstruction"],
    contradictionsDisclosed: [],
    verifierStatus: "PROBABLE",
    verifierConfidence: "MEDIUM",
  });

  const checks = {
    cleanPasses: clean.verdict === "PASS",
    mismatchHolds: mismatch.verdict === "HOLD",
    unsupportedVerifiedKills: unsupportedVerified.verdict === "KILL_SWITCH",
    concealedContradictionKills: concealedContradiction.verdict === "KILL_SWITCH",
  };

  const ok = Object.values(checks).every(Boolean);

  return NextResponse.json({
    ok,
    generatedAt: new Date().toISOString(),
    checks,
    cases: { clean, mismatch, unsupportedVerified, concealedContradiction },
    rule: INDEPENDENT_INTEGRITY_RULE,
  }, {
    status: ok ? 200 : 500,
    headers: { "cache-control": "no-store, max-age=0" },
  });
}
