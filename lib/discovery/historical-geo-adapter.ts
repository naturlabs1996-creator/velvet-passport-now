export type HistoricalGeoCapability =
  | "STREET_LINEAGE"
  | "CURRENT_ADDRESS"
  | "CURRENT_PARCEL"
  | "CURRENT_ENTRANCE"
  | "HISTORICAL_PARCEL"
  | "HISTORICAL_MAP"
  | "NUMBERING_HISTORY"
  | "ALIGNMENT_HISTORY";

export type HistoricalGeoSource = {
  id: string;
  label: string;
  authority: string;
  sourceType: "OFFICIAL_OPEN_DATA" | "OFFICIAL_ARCHIVE" | "OFFICIAL_REGISTRY" | "OFFICIAL_HERITAGE";
  capabilities: HistoricalGeoCapability[];
  url: string;
  automated: boolean;
  notes?: string[];
};

export type HistoricalGeoAdapter = {
  cityId: string;
  cityLabel: string;
  countryCode: string;
  languageHints: string[];
  streetTypes: string[];
  capabilities: HistoricalGeoCapability[];
  sources: HistoricalGeoSource[];
  rules: {
    sameNumberIsContinuityProof: false;
    currentParcelIsHistoricalParcelProof: false;
    currentEntranceIsHistoricalEntranceProof: false;
    requireIndependentHistoricalGeometryForExactMatch: true;
  };
};

export function missingCapabilities(adapter: HistoricalGeoAdapter, required: HistoricalGeoCapability[]) {
  return required.filter((capability) => !adapter.capabilities.includes(capability));
}

export function adapterCanAttemptExactMicroLocation(adapter: HistoricalGeoAdapter) {
  const required: HistoricalGeoCapability[] = [
    "STREET_LINEAGE",
    "CURRENT_ADDRESS",
    "CURRENT_PARCEL",
    "HISTORICAL_PARCEL",
    "HISTORICAL_MAP",
  ];
  return {
    ok: missingCapabilities(adapter, required).length === 0,
    missing: missingCapabilities(adapter, required),
  };
}

export const HISTORICAL_GEO_ADAPTER_RULE =
  "City adapters describe authoritative local source capabilities; they never weaken the universal evidence doctrine. Same-number addresses, current parcels, current entrances and street centroids remain candidates until independent historical geometry proves continuity.";
