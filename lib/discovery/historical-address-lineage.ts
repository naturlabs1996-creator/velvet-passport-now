import type { HistoricalMicroLocationResult } from "./historical-micro-location-hypotheses";
import type { ResearchLead } from "./research-collectors";

export type HistoricalAddressLineageStatus =
  | "CONFIRMED_NAME_LINEAGE"
  | "CURRENT_STREET_ONLY"
  | "HISTORICAL_STREET_ONLY"
  | "AMBIGUOUS"
  | "UNRESOLVED";

type ParisStreetRecord = {
  id?: string | number;
  typvoie?: string | null;
  prevoie?: string | null;
  nomvoie?: string | null;
  typo?: string | null;
  typo_min?: string | null;
  arrdt?: string[] | string | null;
  quartier?: string[] | string | null;
  date_arret?: string | null;
  date_voie_ancienne?: string | null;
  cvoie?: string | null;
  cdgi?: string | null;
  feuille?: string[] | string | null;
  debut?: string | null;
  fin?: string | null;
  n_pair?: string | null;
  n_impair?: string | null;
  alignement?: string | null;
  historique?: string | null;
  denomination?: string | null;
  observation?: string | null;
  numerotage?: string | null;
  declassement?: string | null;
  ouverture?: string | null;
  geo_point_2d?: { lon?: number; lat?: number } | null;
};

export type HistoricalAddressLineageResult = {
  lead: ResearchLead;
  status: HistoricalAddressLineageStatus;
  historicalStreet?: string;
  currentStreet?: string;
  historicalRecord?: ParisStreetRecord;
  currentRecord?: ParisStreetRecord;
  parcelSheets: string[];
  numberingReferences: string[];
  alignmentReferences: string[];
  currentStreetReferencePoint?: { lat: number; lon: number; truthStatus: "STREET_REFERENCE_ONLY" };
  requiresParcelReconstruction: boolean;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  reasons: string[];
};

const BASE = "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets";
const CURRENT_DATASET = "denominations-emprises-voies-actuelles";
const CADUC_DATASET = "denominations-des-voies-caduques";
const USER_AGENT = "VelvetPassportHistoricalAddress/1.0 (official Paris Data street lineage; fail closed; no centroid-to-door inference)";

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function streetLabel(record: ParisStreetRecord) {
  return (record.typo_min || record.typo || [record.typvoie, record.prevoie, record.nomvoie].filter(Boolean).join(" ")).trim();
}

function stringArray(value?: string[] | string | null) {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
}

function exactStreetMatch(record: ParisStreetRecord, wanted: string) {
  const label = normalize(streetLabel(record));
  const target = normalize(wanted);
  return label === target;
}

async function queryParisData(dataset: string, term: string, limit = 8) {
  const safe = term.replace(/"/g, "\\\"");
  const where = `search(*, "${safe}")`;
  const url = `${BASE}/${dataset}/records?where=${encodeURIComponent(where)}&limit=${limit}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "application/json" },
      signal: controller.signal,
      next: { revalidate: 86400 },
    });
    if (!response.ok) return { ok: false as const, status: response.status, records: [] as ParisStreetRecord[], url };
    const json = await response.json() as { results?: ParisStreetRecord[] };
    return { ok: true as const, status: response.status, records: json.results ?? [], url };
  } catch {
    return { ok: false as const, status: 0, records: [] as ParisStreetRecord[], url };
  } finally {
    clearTimeout(timer);
  }
}

function extractStreetReferences(lead: ResearchLead) {
  const values = [
    lead.address ?? "",
    lead.snippet ?? "",
    ...lead.rawClaims,
    ...(lead.evidenceTrace ?? []).flatMap((item) => item.claims ?? []),
  ];

  const refs: string[] = [];
  const pattern = /\b(?:rue|quai|boulevard|avenue|place|passage|impasse|cour|all[eé]e|square|chemin|route)\s+(?:de\s+la\s+|de\s+l['’]|des\s+|du\s+|de\s+|d['’]|aux\s+|au\s+)?[A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-öø-ÿ’' -]{2,70}/g;

  for (const value of values) {
    for (const match of value.matchAll(pattern)) {
      const cleaned = match[0]
        .replace(/[.,;:!?)]*$/, "")
        .replace(/\s+/g, " ")
        .trim();
      if (cleaned.length >= 5 && cleaned.length <= 90) refs.push(cleaned);
    }
  }

  return [...new Set(refs.map((ref) => ref.trim()))].slice(0, 8);
}

function currentNameFromHistory(history?: string | null) {
  if (!history) return undefined;
  const patterns = [
    /\bActuellement\s+((?:rue|quai|boulevard|avenue|place|passage|impasse|cour|all[eé]e|square|chemin|route)\s+[^.;]+)/i,
    /\b(?:est devenue|devient|renomm[eé]e?)\s+((?:rue|quai|boulevard|avenue|place|passage|impasse|cour|all[eé]e|square|chemin|route)\s+[^.;]+)/i,
  ];
  for (const pattern of patterns) {
    const match = history.match(pattern)?.[1]?.trim();
    if (match) return match.replace(/[.,;:]$/, "").trim();
  }
  return undefined;
}

function historyMentionsStreet(history: string | null | undefined, street: string) {
  if (!history) return false;
  return normalize(history).includes(normalize(street));
}

async function resolveOneStreet(reference: string) {
  const [caduc, current] = await Promise.all([
    queryParisData(CADUC_DATASET, reference),
    queryParisData(CURRENT_DATASET, reference),
  ]);

  const caducExact = caduc.records.filter((record) => exactStreetMatch(record, reference));
  const currentExact = current.records.filter((record) => exactStreetMatch(record, reference));

  if (caducExact.length === 1) {
    const historicalRecord = caducExact[0];
    const historicalStreet = streetLabel(historicalRecord);
    const nextName = currentNameFromHistory(historicalRecord.historique);
    if (nextName) {
      const next = await queryParisData(CURRENT_DATASET, nextName);
      const currentMatches = next.records.filter((record) => exactStreetMatch(record, nextName));
      const reciprocal = currentMatches.filter((record) => historyMentionsStreet(record.historique, historicalStreet));
      if (reciprocal.length === 1) {
        return {
          status: "CONFIRMED_NAME_LINEAGE" as const,
          historicalStreet,
          currentStreet: streetLabel(reciprocal[0]),
          historicalRecord,
          currentRecord: reciprocal[0],
          reciprocal: true,
        };
      }
      if (currentMatches.length === 1) {
        return {
          status: "HISTORICAL_STREET_ONLY" as const,
          historicalStreet,
          currentStreet: streetLabel(currentMatches[0]),
          historicalRecord,
          currentRecord: currentMatches[0],
          reciprocal: false,
        };
      }
    }
    return {
      status: "HISTORICAL_STREET_ONLY" as const,
      historicalStreet,
      historicalRecord,
      reciprocal: false,
    };
  }

  if (currentExact.length === 1) {
    return {
      status: "CURRENT_STREET_ONLY" as const,
      currentStreet: streetLabel(currentExact[0]),
      currentRecord: currentExact[0],
      reciprocal: false,
    };
  }

  if (caducExact.length > 1 || currentExact.length > 1) {
    return { status: "AMBIGUOUS" as const, reciprocal: false };
  }

  return { status: "UNRESOLVED" as const, reciprocal: false };
}

function attachClaims(result: HistoricalAddressLineageResult) {
  const claims = [
    `HISTORICAL_ADDRESS_LINEAGE status=${result.status} confidence=${result.confidence} historical=${JSON.stringify(result.historicalStreet ?? "")} current=${JSON.stringify(result.currentStreet ?? "")}`,
    `HISTORICAL_ADDRESS_PARCEL_RECONSTRUCTION required=${result.requiresParcelReconstruction ? "YES" : "NO"} sheets=${JSON.stringify(result.parcelSheets)}`,
    ...result.numberingReferences.map((value) => `HISTORICAL_ADDRESS_NUMBERING_REFERENCE ${JSON.stringify(value)}`),
    ...result.alignmentReferences.map((value) => `HISTORICAL_ADDRESS_ALIGNMENT_REFERENCE ${JSON.stringify(value)}`),
  ];
  return { ...result.lead, rawClaims: [...result.lead.rawClaims, ...claims] };
}

export async function resolveHistoricalAddressLineage(
  microResults: HistoricalMicroLocationResult[],
  maxLookups = 3,
) {
  const output: HistoricalAddressLineageResult[] = [];
  let allocated = 0;

  for (const item of microResults) {
    if (!item.fieldReady || allocated >= maxLookups) {
      output.push({
        lead: item.lead,
        status: "UNRESOLVED",
        parcelSheets: [],
        numberingReferences: [],
        alignmentReferences: [],
        requiresParcelReconstruction: item.fieldReady,
        confidence: "NONE",
        reasons: [item.fieldReady ? "Historical address-lineage lookup budget was not allocated to this field-ready candidate." : "Micro-location evidence is not field-ready, so address lineage was not queried."],
      });
      continue;
    }

    const references = extractStreetReferences(item.lead);
    if (!references.length) {
      output.push({
        lead: item.lead,
        status: "UNRESOLVED",
        parcelSheets: [],
        numberingReferences: [],
        alignmentReferences: [],
        requiresParcelReconstruction: true,
        confidence: "NONE",
        reasons: ["No explicit street reference could be extracted from the attached historical evidence."],
      });
      continue;
    }

    allocated += 1;
    let resolved: Awaited<ReturnType<typeof resolveOneStreet>> | null = null;
    let usedReference: string | undefined;
    for (const reference of references.slice(0, 3)) {
      const candidate = await resolveOneStreet(reference);
      if (candidate.status === "CONFIRMED_NAME_LINEAGE" || candidate.status === "HISTORICAL_STREET_ONLY" || candidate.status === "CURRENT_STREET_ONLY") {
        resolved = candidate;
        usedReference = reference;
        break;
      }
      if (!resolved && candidate.status === "AMBIGUOUS") {
        resolved = candidate;
        usedReference = reference;
      }
    }

    if (!resolved) resolved = { status: "UNRESOLVED", reciprocal: false };

    const parcelSheets = stringArray(resolved.currentRecord?.feuille);
    const numberingReferences = [resolved.historicalRecord?.numerotage, resolved.currentRecord?.numerotage].filter((value): value is string => Boolean(value));
    const alignmentReferences = [resolved.historicalRecord?.alignement, resolved.currentRecord?.alignement].filter((value): value is string => Boolean(value));
    const point = resolved.currentRecord?.geo_point_2d;
    const currentStreetReferencePoint =
      typeof point?.lat === "number" && typeof point?.lon === "number"
        ? { lat: point.lat, lon: point.lon, truthStatus: "STREET_REFERENCE_ONLY" as const }
        : undefined;

    const confidence: HistoricalAddressLineageResult["confidence"] =
      resolved.status === "CONFIRMED_NAME_LINEAGE" ? "HIGH" :
      resolved.status === "HISTORICAL_STREET_ONLY" || resolved.status === "CURRENT_STREET_ONLY" ? "MEDIUM" :
      resolved.status === "AMBIGUOUS" ? "LOW" : "NONE";

    const requiresParcelReconstruction =
      resolved.status !== "UNRESOLVED" &&
      Boolean(resolved.historicalStreet || item.fieldReady);

    const result: HistoricalAddressLineageResult = {
      lead: item.lead,
      status: resolved.status,
      historicalStreet: resolved.historicalStreet,
      currentStreet: resolved.currentStreet,
      historicalRecord: resolved.historicalRecord,
      currentRecord: resolved.currentRecord,
      parcelSheets,
      numberingReferences,
      alignmentReferences,
      currentStreetReferencePoint,
      requiresParcelReconstruction,
      confidence,
      reasons: [
        usedReference ? `Street reference tested against official Paris Data: ${usedReference}.` : "No street reference resolved in official Paris Data.",
        resolved.status === "CONFIRMED_NAME_LINEAGE"
          ? "Former and current street records corroborate the naming lineage in both directions."
          : "Naming continuity is incomplete or one-sided; no exact present-day micro-location may be inferred.",
        "The current street geometry/centroid is street-level orientation only and can never stand in for a historical door, parcel or building.",
      ],
    };
    result.lead = attachClaims(result);
    output.push(result);
  }

  return {
    results: output,
    leads: output.map((item) => item.lead),
    confirmed: output.filter((item) => item.status === "CONFIRMED_NAME_LINEAGE"),
    allocated,
    rule: "Official Paris Data may establish street-name lineage, numbering/alignement references and parcel-sheet targets. Street polygons and centroids are orientation aids only. Door-, building- and parcel-level continuity requires independent historical plans/cadastre and cannot be inferred from a current street geometry.",
  };
}


/**
 * Mission-mode street lineage resolver.
 * This deliberately resolves only street-name/numbering/alignment lineage from
 * explicit evidence attached to a lead. It does NOT require field-ready
 * micro-location clues because street-name history is independently verifiable.
 * It never grants door, building or parcel continuity.
 */
export async function resolveHistoricalStreetLineageFromLeads(
  leads: ResearchLead[],
  maxLookups = 3,
) {
  const output: HistoricalAddressLineageResult[] = [];
  let allocated = 0;

  for (const lead of leads) {
    if (allocated >= maxLookups) {
      output.push({
        lead,
        status: "UNRESOLVED",
        parcelSheets: [],
        numberingReferences: [],
        alignmentReferences: [],
        requiresParcelReconstruction: false,
        confidence: "NONE",
        reasons: ["Mission street-lineage lookup budget was not allocated to this candidate."],
      });
      continue;
    }

    const references = extractStreetReferences(lead);
    if (!references.length) {
      output.push({
        lead,
        status: "UNRESOLVED",
        parcelSheets: [],
        numberingReferences: [],
        alignmentReferences: [],
        requiresParcelReconstruction: false,
        confidence: "NONE",
        reasons: ["No explicit street reference could be extracted from the mission evidence."],
      });
      continue;
    }

    allocated += 1;
    let resolved: Awaited<ReturnType<typeof resolveOneStreet>> | null = null;
    let usedReference: string | undefined;

    for (const reference of references.slice(0, 3)) {
      const candidate = await resolveOneStreet(reference);
      if (
        candidate.status === "CONFIRMED_NAME_LINEAGE" ||
        candidate.status === "HISTORICAL_STREET_ONLY" ||
        candidate.status === "CURRENT_STREET_ONLY"
      ) {
        resolved = candidate;
        usedReference = reference;
        break;
      }
      if (!resolved && candidate.status === "AMBIGUOUS") {
        resolved = candidate;
        usedReference = reference;
      }
    }

    if (!resolved) resolved = { status: "UNRESOLVED", reciprocal: false };

    const parcelSheets = stringArray(resolved.currentRecord?.feuille);
    const numberingReferences = [
      resolved.historicalRecord?.numerotage,
      resolved.currentRecord?.numerotage,
    ].filter((value): value is string => Boolean(value));
    const alignmentReferences = [
      resolved.historicalRecord?.alignement,
      resolved.currentRecord?.alignement,
    ].filter((value): value is string => Boolean(value));

    const point = resolved.currentRecord?.geo_point_2d;
    const currentStreetReferencePoint =
      typeof point?.lat === "number" && typeof point?.lon === "number"
        ? { lat: point.lat, lon: point.lon, truthStatus: "STREET_REFERENCE_ONLY" as const }
        : undefined;

    const confidence: HistoricalAddressLineageResult["confidence"] =
      resolved.status === "CONFIRMED_NAME_LINEAGE" ? "HIGH" :
      resolved.status === "HISTORICAL_STREET_ONLY" || resolved.status === "CURRENT_STREET_ONLY" ? "MEDIUM" :
      resolved.status === "AMBIGUOUS" ? "LOW" : "NONE";

    const result: HistoricalAddressLineageResult = {
      lead,
      status: resolved.status,
      historicalStreet: resolved.historicalStreet,
      currentStreet: resolved.currentStreet,
      historicalRecord: resolved.historicalRecord,
      currentRecord: resolved.currentRecord,
      parcelSheets,
      numberingReferences,
      alignmentReferences,
      currentStreetReferencePoint,
      requiresParcelReconstruction: resolved.status !== "UNRESOLVED",
      confidence,
      reasons: [
        usedReference
          ? `Mission street reference tested against official Paris Data: ${usedReference}.`
          : "No street reference resolved in official Paris Data.",
        resolved.status === "CONFIRMED_NAME_LINEAGE"
          ? "Former and current street records corroborate the naming lineage in both directions."
          : "Street-name continuity is incomplete or one-sided.",
        "Street lineage alone never proves historical parcel, building or entrance continuity.",
      ],
    };
    result.lead = attachClaims(result);
    output.push(result);
  }

  return {
    results: output,
    leads: output.map((item) => item.lead),
    confirmed: output.filter((item) => item.status === "CONFIRMED_NAME_LINEAGE"),
    allocated,
    rule: "Mission street-lineage resolution may precede micro-location because official naming history is independently verifiable. It cannot establish parcel, building or entrance continuity.",
  };
}
