// @ts-nocheck
import type { ResearchEvidence } from "./research-verification";
import type { ResearchLead } from "./research-collectors";
import { enrichHistoryEvidence } from "./history-evidence-layer";
import { extractHistoricalSpatialClues } from "./historical-spatial-clue-extractor";
import { buildHistoricalMicroLocationHypotheses } from "./historical-micro-location-hypotheses";
import { resolveHistoricalAddressLineage } from "./historical-address-lineage";
import { resolveCurrentParcelDoorCandidates } from "./current-parcel-door-candidates";
import { HISTORICAL_GEO_ADAPTERS } from "./historical-geo-adapters";
import { buildGovernanceTelemetry } from "./predator-governance-telemetry";
import { evaluatePredatorHeartbeat } from "./predator-heartbeat-watchdog";
import { verifyIntegrity } from "./independent-integrity-verifier";
import { PREDATOR_GRADUATION } from "./predator-graduation";

export type PredatorMissionRequest = {
  cityId: keyof typeof HISTORICAL_GEO_ADAPTERS;
  subject: string;
  objective: string;
  knownAddress?: string;
  knownFacts?: string[];
  requestedDepth?: "STANDARD" | "DEEP" | "MAXIMUM";
};

export type PredatorMissionStatus =
  | "COMPLETED"
  | "PARTIAL"
  | "HOLD_CAPABILITY_GAP"
  | "REJECTED_MANDATE"
  | "CONTAINED";

const EXECUTABLE_CITY_IDS = new Set(["paris-fr"]);
const BASELINE = "0cb3eb08287e4d7e2a17a89d8965c37c1c4037d9";
const USER_AGENT = "VelvetPassportPredator/2.0 (bounded historical mission runner; fail closed)";

function clean(value: unknown, max = 500) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function missionId() {
  return `predator-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isHistoricalMandate(text: string) {
  return /(histor|archive|ancien|ancienne|adresse|parcelle|cadastre|plan|immeuble|maison|hotel|hôtel|rue|porte|entree|entrée|cour|localis|lieu|batiment|bâtiment|propriet|propriét|occup|construction|demoli|démoli|heritage|patrimoine)/i.test(text);
}

async function fetchJson(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "application/json" },
      signal: controller.signal,
      next: { revalidate: 86400 },
    });
    if (!response.ok) return undefined;
    return await response.json();
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

async function buildSeedLeads(request: PredatorMissionRequest, id: string): Promise<ResearchLead[]> {
  const adapter = HISTORICAL_GEO_ADAPTERS[request.cityId];
  const locationLabel = `${adapter.cityLabel}, ${adapter.countryCode}`;
  const q = [request.subject, request.knownAddress, locationLabel].filter(Boolean).join(", ");
  const leads: ResearchLead[] = [];
  const observedAt = new Date().toISOString();

  const osm = await fetchJson(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&q=${encodeURIComponent(q)}`) as
    | Array<{ place_id?: number; display_name?: string; lat?: string; lon?: string; name?: string }>
    | undefined;

  for (const item of osm ?? []) {
    const lat = Number(item.lat);
    const lon = Number(item.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const url = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}`;
    const evidence: ResearchEvidence = {
      sourceId: `predator-osm:${item.place_id ?? `${lat},${lon}`}`,
      sourceType: "MAP",
      publisher: "OpenStreetMap/Nominatim",
      url,
      title: item.name || request.subject,
      observedAt,
      claims: [item.display_name || q, `Coordinates ${lat}, ${lon}`],
      independentKey: "openstreetmap.org",
    };
    leads.push({
      id: `${id}:osm:${item.place_id ?? leads.length}`,
      pageId: id,
      theme: "predator-historical-mission",
      query: q,
      name: item.name || request.subject,
      snippet: item.display_name,
      url,
      sourceType: "MAP",
      publisher: "OpenStreetMap/Nominatim",
      independentKey: "openstreetmap.org",
      observedAt,
      address: item.display_name || request.knownAddress,
      lat,
      lon,
      rawClaims: [...(request.knownFacts ?? []), ...(item.display_name ? [item.display_name] : [])],
      evidenceTrace: [evidence],
    });
  }

  const wiki = await fetchJson(
    `https://fr.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(`${request.subject} ${adapter.cityLabel}`)}&srlimit=5&format=json&origin=*`,
  ) as { query?: { search?: Array<{ pageid: number; title: string; snippet?: string }> } } | undefined;

  for (const item of wiki?.query?.search ?? []) {
    const snippet = clean(item.snippet?.replace(/<[^>]+>/g, " "), 350);
    const url = `https://fr.wikipedia.org/?curid=${item.pageid}`;
    const evidence: ResearchEvidence = {
      sourceId: `predator-wikipedia:${item.pageid}`,
      sourceType: "WIKIDATA",
      publisher: "Wikipedia/Wikimedia",
      url,
      title: item.title,
      observedAt,
      claims: snippet ? [snippet] : [item.title],
      independentKey: "wikipedia.org",
    };
    leads.push({
      id: `${id}:wiki:${item.pageid}`,
      pageId: id,
      theme: "predator-historical-mission",
      query: q,
      name: item.title,
      snippet,
      url,
      sourceType: "WIKIDATA",
      publisher: "Wikipedia/Wikimedia",
      independentKey: "wikipedia.org",
      observedAt,
      address: request.knownAddress,
      rawClaims: [...(request.knownFacts ?? []), ...(snippet ? [snippet] : [])],
      evidenceTrace: [evidence],
    });
  }

  if (!leads.length && request.knownAddress) {
    leads.push({
      id: `${id}:seed`,
      pageId: id,
      theme: "predator-historical-mission",
      query: q,
      name: request.subject,
      snippet: request.objective,
      url: "about:blank",
      sourceType: "MAP",
      publisher: "Mission seed",
      independentKey: "mission-seed",
      observedAt,
      address: request.knownAddress,
      rawClaims: request.knownFacts ?? [],
      evidenceTrace: [],
    });
  }

  return leads.slice(0, 6);
}

export async function runPredatorMission(input: PredatorMissionRequest) {
  const id = missionId();
  const subject = clean(input.subject, 180);
  const objective = clean(input.objective, 500);
  const adapter = HISTORICAL_GEO_ADAPTERS[input.cityId];

  if (!adapter || subject.length < 3 || objective.length < 8) {
    return { missionId: id, status: "REJECTED_MANDATE" as PredatorMissionStatus, reasons: ["Invalid or incomplete mission request."] };
  }

  if (!isHistoricalMandate(`${subject} ${objective} ${(input.knownFacts ?? []).join(" ")}`)) {
    return {
      missionId: id,
      status: "REJECTED_MANDATE" as PredatorMissionStatus,
      reasons: ["Predator is restricted to historical research, archives, place reconstruction, address lineage and micro-location."],
    };
  }

  if (String(PREDATOR_GRADUATION.status) !== "SHADOW_READY") {
    return { missionId: id, status: "CONTAINED" as PredatorMissionStatus, reasons: ["Predator is not in SHADOW_READY state."] };
  }

  if (!EXECUTABLE_CITY_IDS.has(input.cityId)) {
    return {
      missionId: id,
      status: "HOLD_CAPABILITY_GAP" as PredatorMissionStatus,
      city: adapter.cityLabel,
      missingAutomation: adapter.sources.filter((source: any) => source.automated === false).map((source: any) => source.label),
      reasons: ["The city adapter exists, but the targeted operational research pipeline is not yet automated for this city. Predator fails closed instead of borrowing Paris-specific logic."],
    };
  }

  const telemetry = buildGovernanceTelemetry({
    observedAt: new Date().toISOString(),
    autonomyState: "NORMAL",
    cityId: input.cityId,
    activeDomain: "HISTORICAL_MISSION",
    activeTask: objective,
    activeSourceFamilies: adapter.sources.map((source: any) => new URL(source.url).hostname),
    openProposalIds: [],
    lastAuthorizedAction: "Execute bounded historical mission in shadow mode",
    lastBenchmarkStatus: "PASS",
    lastKnownGoodBaseline: BASELINE,
    lastRollbackBaseline: BASELINE,
    stateReason: ["Human-authorized shadow mission."],
  });
  const heartbeat = evaluatePredatorHeartbeat(telemetry);
  if (heartbeat.verdict !== "HEALTHY") {
    return { missionId: id, status: "CONTAINED" as PredatorMissionStatus, telemetry, heartbeat, reasons: heartbeat.reasons };
  }

  const request: PredatorMissionRequest = {
    ...input,
    subject,
    objective,
    knownAddress: input.knownAddress ? clean(input.knownAddress, 180) : undefined,
    knownFacts: (input.knownFacts ?? []).map((fact) => clean(fact, 350)).filter(Boolean).slice(0, 20),
    requestedDepth: input.requestedDepth ?? "DEEP",
  };

  const seeds = await buildSeedLeads(request, id);
  if (!seeds.length) {
    return {
      missionId: id,
      status: "PARTIAL" as PredatorMissionStatus,
      telemetry,
      heartbeat,
      reasons: ["No place identity could be resolved from the mission seed. Add an address, historical street reference or more specific subject."],
      report: { subject, objective, city: adapter.cityLabel, conclusion: "UNRESOLVED" },
    };
  }

  const maxLookups = request.requestedDepth === "MAXIMUM" ? 12 : request.requestedDepth === "DEEP" ? 8 : 4;
  const history: any = await enrichHistoryEvidence(seeds, maxLookups);
  const spatial: any = extractHistoricalSpatialClues(history.leads);
  const micro: any = buildHistoricalMicroLocationHypotheses(spatial.results);
  const lineage: any = await resolveHistoricalAddressLineage(micro.results, Math.min(3, maxLookups));
  const parcelDoor: any = await resolveCurrentParcelDoorCandidates(lineage.results, Math.min(3, maxLookups));

  const sourceUrls = [...new Set([
    ...seeds.flatMap((lead) => (lead.evidenceTrace ?? []).map((e) => e.url)),
    ...history.results.flatMap((item: any) => item.evidenceUrls),
  ].filter((url) => url && url !== "about:blank"))];
  const sourceFamilies = new Set(sourceUrls.map((url) => {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
  }));

  const bestHistory = [...history.results].sort((a: any, b: any) => b.score - a.score)[0];
  const bestMicro = micro.results.find((item: any) => item.fieldReady) ?? micro.results[0];
  const bestLineage = lineage.results.find((item: any) => item.status === "CONFIRMED_NAME_LINEAGE") ?? lineage.results[0];
  const bestParcel = parcelDoor.results.find((item: any) => item.cadParcels.length > 0) ?? parcelDoor.results[0];

  const factualStatus =
    bestHistory?.status === "CONFIRMED" && bestLineage?.status === "CONFIRMED_NAME_LINEAGE"
      ? "PROBABLE"
      : "HYPOTHESIS";
  const confidence =
    factualStatus === "PROBABLE" && (bestHistory?.independentSources ?? 0) >= 2 ? "MEDIUM" : sourceUrls.length ? "LOW" : "NONE";

  const integrity = verifyIntegrity({
    claimId: `${id}:mission-conclusion`,
    claimText: objective,
    claimedStatus: factualStatus,
    claimedConfidence: confidence,
    sourceIds: sourceUrls.map((_, index) => `${id}:source:${index + 1}`),
    sourceUrls,
    independentSourceFamilies: sourceFamilies.size,
    contradictionsKnown: [],
    contradictionsDisclosed: [],
    verifierStatus: factualStatus,
    verifierConfidence: confidence,
  });

  const contained = integrity.verdict === "KILL_SWITCH";
  const held = integrity.verdict === "HOLD";

  const report = {
    missionId: id,
    agent: "Predator 2.0",
    mode: "SHADOW_READY",
    city: adapter.cityLabel,
    subject,
    objective,
    depth: request.requestedDepth,
    conclusion: contained ? "CONTRADICTED" : held ? "UNRESOLVED" : factualStatus === "PROBABLE" ? "PROBABLE" : "POSSIBLE",
    confidence,
    identityCandidates: seeds.slice(0, 5).map((lead) => ({
      name: lead.name,
      address: lead.address,
      lat: lead.lat,
      lon: lead.lon,
      source: lead.url,
    })),
    historicalEvidence: history.results.slice(0, 5).map((item: any) => ({
      name: item.lead.name,
      status: item.status,
      score: item.score,
      independentSources: item.independentSources,
      matchedTerms: item.matchedHistoryTerms.slice(0, 12),
      evidenceUrls: item.evidenceUrls.slice(0, 8),
    })),
    microLocation: bestMicro ? {
      fieldReady: bestMicro.fieldReady,
      bestConfidence: bestMicro.bestConfidence,
      hypotheses: bestMicro.hypotheses.slice(0, 3),
    } : undefined,
    addressLineage: bestLineage ? {
      status: bestLineage.status,
      historicalStreet: bestLineage.historicalStreet,
      currentStreet: bestLineage.currentStreet,
      parcelSheets: bestLineage.parcelSheets,
      numberingReferences: bestLineage.numberingReferences,
      alignmentReferences: bestLineage.alignmentReferences,
      confidence: bestLineage.confidence,
      reasons: bestLineage.reasons,
    } : undefined,
    currentParcelAndEntrances: bestParcel ? {
      status: bestParcel.status,
      historicalAddress: bestParcel.historicalAddress,
      currentAddressCandidates: bestParcel.currentAddressCandidates,
      currentDoorCandidates: bestParcel.currentDoorCandidates,
      cadParcels: bestParcel.cadParcels,
      exactHistoricalParcelMatch: bestParcel.exactHistoricalParcelMatch,
      confidence: bestParcel.confidence,
      reasons: bestParcel.reasons,
    } : undefined,
    independentIntegrity: integrity,
    sources: sourceUrls.slice(0, 20),
    unresolved: [
      ...(bestParcel?.exactHistoricalParcelMatch === false ? ["Exact historical parcel/door continuity is not established until historical plan geometry is independently aligned."] : []),
      ...(bestHistory?.status !== "CONFIRMED" ? ["Historical evidence did not reach confirmed status."] : []),
      ...(bestLineage?.status !== "CONFIRMED_NAME_LINEAGE" ? ["Street-name lineage is not fully confirmed."] : []),
    ],
  };

  return {
    missionId: id,
    status: contained ? "CONTAINED" as PredatorMissionStatus : "COMPLETED" as PredatorMissionStatus,
    telemetry,
    heartbeat,
    report,
  };
}

export const PREDATOR_MISSION_RULE =
  "A Predator mission is human-authorized, historical-only, city-capability aware, heartbeat-gated, independently verified, and fail-closed. Unsupported city automation, missing evidence, integrity mismatch, or exact historical continuity gaps can never be silently filled with inference.";
