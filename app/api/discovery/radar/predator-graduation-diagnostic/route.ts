import { NextResponse } from "next/server";
import { PREDATOR_GRADUATION } from "@/lib/discovery/predator-graduation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const checks = {
    shadowReady: PREDATOR_GRADUATION.status === "SHADOW_READY",
    hasHistoricalResearchCore:
      PREDATOR_GRADUATION.completedCapabilities.includes("historical witness spatial clue extraction") &&
      PREDATOR_GRADUATION.completedCapabilities.includes("historical parcel alignment with fail-closed exact-match gate"),
    independentVerificationRequired:
      PREDATOR_GRADUATION.permanentRestrictions.some((item) =>
        item.toLowerCase().includes("independent verification remains mandatory"),
      ),
    noDirectProduction:
      PREDATOR_GRADUATION.permanentRestrictions.some((item) =>
        item.toLowerCase().includes("no direct publication, merge or production deployment"),
      ),
    exactMatchGateRetained:
      PREDATOR_GRADUATION.permanentRestrictions.some((item) =>
        item.toLowerCase().includes("no exact historical parcel or entrance claim"),
      ),
    boundedAutonomyNotYetGranted:
      PREDATOR_GRADUATION.status !== "BOUNDED_AUTONOMY",
  };

  const ok = Object.values(checks).every(Boolean);

  return NextResponse.json({
    ok,
    generatedAt: new Date().toISOString(),
    checks,
    graduation: PREDATOR_GRADUATION,
  }, {
    status: ok ? 200 : 500,
    headers: { "cache-control": "no-store, max-age=0" },
  });
}
