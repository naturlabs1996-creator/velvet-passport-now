import type { HistoricalAddressLineageResult } from "./historical-address-lineage";
import type { ResearchLead } from "./research-collectors";

type BanRecord = {
  voie_nom?: string;
  numero?: number;
  suffixe?: string | null;
  position?: string | null;
  cad_parcelles?: string | null;
  long?: number | null;
  lat?: number | null;
  certification_commune?: number | null;
  date_der_maj?: string | null;
  id_ban_adresse?: string | null;
};

type DoorRecord = {
  objectid?: number;
  num_pave?: string | null;
  lib_level?: string | null;
  lib_classe?: string | null;
  geo_point_2d?: { lon?: number; lat?: number } | [number, number] | null;
};

export type HistoricalAddressReference = {
  number: number;
  suffix?: string;
  street: string;
  sourceText: string;
};

export type CurrentAddressCandidate = {
  label: string;
  number: number;
  suffix?: string;
  street: string;
  lat: number;
  lon: number;
  cadParcel?: string;
  position?: string;
  certificationCommune?: number;
  dateUpdated?: string;
  banAddressId?: string;
  truthStatus: "CURRENT_ADDRESS_CANDIDATE_ONLY";
  numberContinuity: "UNVERIFIED";
};

export type CurrentDoorCandidate = {
  objectId?: number;
  pavementSheet?: string;
  label?: string;
  lat: number;
  lon: number;
  distanceMeters?: number;
  truthStatus: "CURRENT_DOOR_CANDIDATE_ONLY";
};

export type CurrentParcelDoorResult = {
  lead: ResearchLead;
  historicalAddress?: HistoricalAddressReference;
  currentAddressCandidates: CurrentAddressCandidate[];
  currentDoorCandidates: CurrentDoorCandidate[];
  cadParcels: string[];
  status:
    | "CURRENT_PARCEL_CANDIDATES_FOUND"
    | "CURRENT_ADDRESS_CANDIDATES_FOUND"
    | "HISTORICAL_NUMBER_MISSING"
    | "LINEAGE_NOT_READY"
    | "NO_CURRENT_MATCH";
  exactHistoricalParcelMatch: false;
  confidence: "MEDIUM" | "LOW" | "NONE";
  reasons: string[];
};

const BASE = "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets";
const BAN_DATASET = "adresses-ban";
const DOORS_DATASET = "plan-de-voirie-portes-cocheres";
const USER_AGENT = "VelvetPassportParcelDoor/1.0 (current parcel + porte cochere candidates; no historical-number continuity inference)";

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, " ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function escapeOds(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

async function queryDataset<T>(dataset: string, where: string, limit = 20, select?: string) {
  const url = new URL(`${BASE}/${dataset}/records`);
  url.searchParams.set("where", where);
  url.searchParams.set("limit", String(limit));
  if (select) url.searchParams.set("select", select);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch(url.toString(), {
      headers: { "user-agent": USER_AGENT, accept: "application/json" },
      signal: controller.signal,
      next: { revalidate: 86400 },
    });
    if (!response.ok) return { ok: false as const, records: [] as T[], status: response.status, url: url.toString() };
    const json = await response.json() as { results?: T[] };
    return { ok: true as const, records: json.results ?? [], status: response.status, url: url.toString() };
  } catch {
    return { ok: false as const, records: [] as T[], status: 0, url: url.toString() };
  } finally {
    clearTimeout(timer);
  }
}

function textsOf(lead: ResearchLead) {
  return [
    lead.address ?? "",
    lead.snippet ?? "",
    ...lead.rawClaims,
    ...(lead.evidenceTrace ?? []).flatMap((item) => item.claims ?? []),
  ].filter(Boolean);
}

export function extractHistoricalNumberedAddress(lead: ResearchLead): HistoricalAddressReference | undefined {
  const streetType = "(?:rue|quai|boulevard|avenue|place|passage|impasse|cour|all[eé]e|square|chemin|route)";
  const pattern = new RegExp(`\\b(\\d{1,4})(?:\\s*(bis|ter|quater|A|B))?\\s*,?\\s+(${streetType}\\s+(?:de\\s+la\\s+|de\\s+l['’]|des\\s+|du\\s+|de\\s+|d['’]|aux\\s+|au\\s+)?[A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-öø-ÿ’' -]{2,70})`, "i");
  for (const text of textsOf(lead)) {
    const match = text.match(pattern);
    if (!match) continue;
    const number = Number(match[1]);
    if (!Number.isFinite(number)) continue;
    return {
      number,
      suffix: match[2]?.toLowerCase(),
      street: match[3].replace(/[.,;:!?)]*$/, "").replace(/\s+/g, " ").trim(),
      sourceText: text.slice(0, 300),
    };
  }
  return undefined;
}

function pointOf(record: DoorRecord) {
  const value = record.geo_point_2d;
  if (Array.isArray(value) && value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
    return { lat: value[0], lon: value[1] };
  }
  if (value && !Array.isArray(value) && typeof value.lat === "number" && typeof value.lon === "number") {
    return { lat: value.lat, lon: value.lon };
  }
  return undefined;
}

async function currentAddressCandidates(street: string, historical: HistoricalAddressReference) {
  const where = `search(voie_nom, "${escapeOds(street)}") and numero=${historical.number}`;
  const response = await queryDataset<BanRecord>(BAN_DATASET, where, 12);
  if (!response.ok) return [];

  return response.records
    .filter((row) =>
      typeof row.lat === "number" &&
      typeof row.long === "number" &&
      typeof row.numero === "number" &&
      row.numero === historical.number &&
      row.voie_nom &&
      (normalize(row.voie_nom) === normalize(street) || normalize(row.voie_nom).includes(normalize(street).replace(/^(rue|quai|boulevard|avenue|place|passage|impasse|cour|allee|square|chemin|route)\s+/, "")))
    )
    .map((row): CurrentAddressCandidate => ({
      label: `${row.numero}${row.suffixe ? ` ${row.suffixe}` : ""} ${row.voie_nom}`,
      number: row.numero!,
      suffix: row.suffixe || undefined,
      street: row.voie_nom!,
      lat: row.lat!,
      lon: row.long!,
      cadParcel: row.cad_parcelles || undefined,
      position: row.position || undefined,
      certificationCommune: row.certification_commune ?? undefined,
      dateUpdated: row.date_der_maj || undefined,
      banAddressId: row.id_ban_adresse || undefined,
      truthStatus: "CURRENT_ADDRESS_CANDIDATE_ONLY",
      numberContinuity: "UNVERIFIED",
    }))
    .filter((row, index, rows) => rows.findIndex((other) => other.lat === row.lat && other.lon === row.lon && other.cadParcel === row.cadParcel) === index);
}

async function nearbyDoors(address: CurrentAddressCandidate, radiusMeters = 30) {
  const where = `within_distance(geo_point_2d, geom'POINT(${address.lon} ${address.lat})', ${radiusMeters} m)`;
  const select = `*, distance(geo_point_2d, geom'POINT(${address.lon} ${address.lat})') as distance_m`;
  const response = await queryDataset<DoorRecord & { distance_m?: number }>(DOORS_DATASET, where, 20, select);
  if (!response.ok) return [];

  return response.records.map((row) => {
    const point = pointOf(row);
    if (!point) return null;
    return {
      objectId: row.objectid,
      pavementSheet: row.num_pave || undefined,
      label: row.lib_classe || row.lib_level || undefined,
      lat: point.lat,
      lon: point.lon,
      distanceMeters: typeof row.distance_m === "number" ? row.distance_m : undefined,
      truthStatus: "CURRENT_DOOR_CANDIDATE_ONLY" as const,
    };
  }).filter((row): row is CurrentDoorCandidate => Boolean(row))
    .sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity))
    .slice(0, 8);
}

function attachInternalClaims(result: CurrentParcelDoorResult) {
  const claims = [
    `HISTORICAL_CURRENT_PARCEL status=${result.status} confidence=${result.confidence} exact_historical_parcel_match=NO parcels=${JSON.stringify(result.cadParcels)}`,
    ...(result.historicalAddress ? [`HISTORICAL_NUMBERED_ADDRESS number=${result.historicalAddress.number} suffix=${JSON.stringify(result.historicalAddress.suffix ?? "")} street=${JSON.stringify(result.historicalAddress.street)}`] : []),
    ...result.currentAddressCandidates.map((candidate) =>
      `HISTORICAL_CURRENT_ADDRESS_CANDIDATE label=${JSON.stringify(candidate.label)} parcel=${JSON.stringify(candidate.cadParcel ?? "")} number_continuity=UNVERIFIED truth=CURRENT_ADDRESS_CANDIDATE_ONLY`
    ),
    ...result.currentDoorCandidates.map((door) =>
      `HISTORICAL_CURRENT_DOOR_CANDIDATE objectid=${door.objectId ?? ""} distance_m=${door.distanceMeters ?? ""} truth=CURRENT_DOOR_CANDIDATE_ONLY`
    ),
  ];
  return { ...result.lead, rawClaims: [...result.lead.rawClaims, ...claims] };
}

export async function resolveCurrentParcelDoorCandidates(lineageResults: HistoricalAddressLineageResult[], maxLookups = 3) {
  const results: CurrentParcelDoorResult[] = [];
  let allocated = 0;

  for (const lineage of lineageResults) {
    if (allocated >= maxLookups || lineage.status !== "CONFIRMED_NAME_LINEAGE" || !lineage.currentStreet) {
      results.push({
        lead: lineage.lead,
        currentAddressCandidates: [],
        currentDoorCandidates: [],
        cadParcels: [],
        status: "LINEAGE_NOT_READY",
        exactHistoricalParcelMatch: false,
        confidence: "NONE",
        reasons: ["Current parcel lookup requires a confirmed former-to-current street-name lineage and available budget."],
      });
      continue;
    }

    const historicalAddress = extractHistoricalNumberedAddress(lineage.lead);
    if (!historicalAddress) {
      results.push({
        lead: lineage.lead,
        currentAddressCandidates: [],
        currentDoorCandidates: [],
        cadParcels: [],
        status: "HISTORICAL_NUMBER_MISSING",
        exactHistoricalParcelMatch: false,
        confidence: "NONE",
        reasons: ["No explicit historical street number was found in the attached evidence; current address matching was not attempted."],
      });
      continue;
    }

    allocated += 1;
    const addresses = await currentAddressCandidates(lineage.currentStreet, historicalAddress);
    const doors = addresses.length ? await nearbyDoors(addresses[0]) : [];
    const parcels = [...new Set(addresses.map((item) => item.cadParcel).filter((value): value is string => Boolean(value)))];

    const status: CurrentParcelDoorResult["status"] =
      parcels.length ? "CURRENT_PARCEL_CANDIDATES_FOUND" :
      addresses.length ? "CURRENT_ADDRESS_CANDIDATES_FOUND" :
      "NO_CURRENT_MATCH";

    const confidence: CurrentParcelDoorResult["confidence"] =
      parcels.length === 1 && addresses.length === 1 ? "MEDIUM" :
      addresses.length ? "LOW" : "NONE";

    const result: CurrentParcelDoorResult = {
      lead: lineage.lead,
      historicalAddress,
      currentAddressCandidates: addresses,
      currentDoorCandidates: doors,
      cadParcels: parcels,
      status,
      exactHistoricalParcelMatch: false,
      confidence,
      reasons: [
        addresses.length
          ? "The historical street number exists today on the confirmed successor street and is retained only as a current-address candidate."
          : "No same-number current address candidate was found on the confirmed successor street.",
        "Number continuity is explicitly unverified: renumbering, widening, parcel merger or demolition may have changed the historic location.",
        parcels.length
          ? "BAN supplies current cadastral parcel identifiers for candidate addresses; these are not historical parcel matches."
          : "No current cadastral parcel identifier was recovered.",
        doors.length
          ? "Mapped current porte-cochère surfaces near the candidate address were recovered as field-check candidates only."
          : "No mapped current porte-cochère candidate was recovered within the bounded search radius.",
        "Exact historical parcel/door matching remains false until historical plan or cadastral geometry is independently aligned to the current parcel fabric.",
      ],
    };
    result.lead = attachInternalClaims(result);
    results.push(result);
  }

  return {
    results,
    leads: results.map((item) => item.lead),
    candidateParcels: results.filter((item) => item.cadParcels.length > 0),
    allocated,
    rule: "A same-number address on a successor street is only a current candidate. BAN cad_parcelles and current porte-cochère geometry can narrow field verification but cannot establish historical number, parcel or door continuity. Exact historical parcel match stays false until independent historical parcel/plan geometry is aligned to current cadastral fabric.",
  };
}
