import { NextResponse } from "next/server";
import { adapterCanAttemptExactMicroLocation, HISTORICAL_GEO_ADAPTER_RULE } from "@/lib/discovery/historical-geo-adapter";
import { PARIS_HISTORICAL_GEO_ADAPTER, MONTREAL_HISTORICAL_GEO_ADAPTER } from "@/lib/discovery/historical-geo-adapters";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const paris = adapterCanAttemptExactMicroLocation(PARIS_HISTORICAL_GEO_ADAPTER);
  const montreal = adapterCanAttemptExactMicroLocation(MONTREAL_HISTORICAL_GEO_ADAPTER);

  const checks = {
    sameUniversalRules:
      PARIS_HISTORICAL_GEO_ADAPTER.rules.sameNumberIsContinuityProof === false &&
      MONTREAL_HISTORICAL_GEO_ADAPTER.rules.sameNumberIsContinuityProof === false &&
      PARIS_HISTORICAL_GEO_ADAPTER.rules.currentParcelIsHistoricalParcelProof === false &&
      MONTREAL_HISTORICAL_GEO_ADAPTER.rules.currentParcelIsHistoricalParcelProof === false &&
      PARIS_HISTORICAL_GEO_ADAPTER.rules.currentEntranceIsHistoricalEntranceProof === false &&
      MONTREAL_HISTORICAL_GEO_ADAPTER.rules.currentEntranceIsHistoricalEntranceProof === false,
    parisCanAttemptExactMicroLocation: paris.ok === true,
    montrealFailsClosedUntilHistoricalParcelSourceExists:
      montreal.ok === false && montreal.missing.includes("HISTORICAL_PARCEL"),
    montrealGapIsExplicit: montreal.missing.length > 0,
  };

  const ok = Object.values(checks).every(Boolean);

  return NextResponse.json({
    ok,
    generatedAt: new Date().toISOString(),
    checks,
    cities: {
      paris: {
        cityId: PARIS_HISTORICAL_GEO_ADAPTER.cityId,
        capabilities: PARIS_HISTORICAL_GEO_ADAPTER.capabilities,
        canAttemptExactMicroLocation: paris.ok,
        missing: paris.missing,
      },
      montreal: {
        cityId: MONTREAL_HISTORICAL_GEO_ADAPTER.cityId,
        capabilities: MONTREAL_HISTORICAL_GEO_ADAPTER.capabilities,
        canAttemptExactMicroLocation: montreal.ok,
        missing: montreal.missing,
      },
    },
    rule: HISTORICAL_GEO_ADAPTER_RULE,
  }, {
    status: ok ? 200 : 500,
    headers: { "cache-control": "no-store, max-age=0" },
  });
}
