// @ts-nocheck
import type { ResearchEvidence } from "./research-verification";
import type { ResearchLead } from "./research-collectors";
import { enrichHistoryEvidence } from "./history-evidence-layer";
import { enrichQuebecHistoryEvidence } from "./quebec-history-evidence";
import { QUEBEC_CITY_HISTORY_ERAS, QUEBEC_CITY_AUTHORITY_SOURCES } from "./quebec-history-context";
import { extractHistoricalSpatialClues } from "./historical-spatial-clue-extractor";
import { buildHistoricalMicroLocationHypotheses } from "./historical-micro-location-hypotheses";
import { resolveHistoricalStreetLineageFromLeads } from "./historical-address-lineage";
import { resolveCurrentParcelDoorCandidates } from "./current-parcel-door-candidates";
import { HISTORICAL_GEO_ADAPTERS } from "./historical-geo-adapters";
import { buildGovernanceTelemetry } from "./predator-governance-telemetry";
import { evaluatePredatorHeartbeat } from "./predator-heartbeat-watchdog";
import { verifyIntegrity } from "./independent-integrity-verifier";
import { PREDATOR_GRADUATION } from "./predator-graduation";
import { evaluatePredatorCandidateRubric, PREDATOR_CANONICAL_CANDIDATE_RUBRIC } from "./predator-candidate-rubric";

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

const EXECUTABLE_CITY_IDS = new Set(["paris-fr", "quebec-city-ca"]);
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

  // Bind every mission to the explicit human target before discovery.
  // This seed is NOT evidence; it simply prevents discovery drift.
  if (request.knownAddress || /\\b(?:rue|quai|boulevard|avenue|place|passage|impasse|cour|all[eé]e|square|chemin|route)\\b/i.test(request.subject)) {
    leads.push({
      id: `${id}:target`,
      pageId: id,
      theme: "predator-historical-mission",
      query: q,
      name: request.subject,
      snippet: request.objective,
      url: "about:blank",
      sourceType: "MAP",
      publisher: "Mission target",
      independentKey: "mission-target",
      observedAt,
      address: request.knownAddress,
      rawClaims: request.knownFacts ?? [],
      evidenceTrace: [],
    });
  }

  const normalizedTarget = `${request.subject} ${request.knownAddress ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "");
  const generic = new Set(["rue","quai","boulevard","avenue","place","passage","impasse","cour","allee","square","chemin","route","paris","france"]);
  const targetTokens = normalizedTarget.split(/[^a-z0-9]+/).filter((token) => token.length >= 4 && !generic.has(token) && !/^\\d+$/.test(token));
  const targetMatch = (text: string) => {
    const normalized = text.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");
    return targetTokens.length === 0 || targetTokens.some((token) => normalized.includes(token));
  };

  const osm = await fetchJson(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&q=${encodeURIComponent(q)}`) as
    | Array<{ place_id?: number; display_name?: string; lat?: string; lon?: string; name?: string }>
    | undefined;

  for (const item of osm ?? []) {
    if (!targetMatch(`${item.name ?? ""} ${item.display_name ?? ""}`)) continue;
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
    if (!targetMatch(`${item.title} ${snippet}`)) continue;
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

  return leads.filter((lead, index, all) => all.findIndex((other) => other.name === lead.name && other.address === lead.address) === index).slice(0, 6);
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
  const isQuebecCity = request.cityId === "quebec-city-ca";
  const history: any = isQuebecCity
    ? await enrichQuebecHistoryEvidence(seeds, maxLookups)
    : await enrichHistoryEvidence(seeds, maxLookups);

  const spatial: any = extractHistoricalSpatialClues(history.leads);
  const micro: any = buildHistoricalMicroLocationHypotheses(spatial.results);

  // Paris has a fully automated street-lineage/current parcel narrowing stack.
  // Quebec City is operational for historical reconnaissance and place anchoring,
  // but exact lot/parcel continuity remains fail-closed until the municipal/RQA
  // parcel services are bound to a stable machine interface.
  const streetLineage: any = isQuebecCity
    ? {
        results: history.leads.map((lead: any) => ({
          lead,
          status: "UNRESOLVED",
          parcelSheets: [],
          numberingReferences: [],
          alignmentReferences: [],
          requiresParcelReconstruction: true,
          confidence: "NONE",
          reasons: [
            "Quebec City mission uses official/local historical sources and current place identity, but automated historical street-lineage/lot continuity is not yet granted.",
            "Use RQA odonym renvois, Ville de Québec matrice graphique, archives maps/plans and independent geometry before exact parcel continuity.",
          ],
        })),
      }
    : await resolveHistoricalStreetLineageFromLeads(history.leads, Math.min(3, maxLookups));

  const parcelDoor: any = isQuebecCity
    ? {
        results: history.leads.map((lead: any) => ({
          lead,
          currentAddressCandidates: seeds
            .filter((seed: any) => seed.address || (typeof seed.lat === "number" && typeof seed.lon === "number"))
            .slice(0, 3)
            .map((seed: any) => ({
              label: seed.address || seed.name,
              lat: seed.lat,
              lon: seed.lon,
              truthStatus: "CURRENT_ADDRESS_CANDIDATE_ONLY",
              numberContinuity: "UNVERIFIED",
            })),
          currentDoorCandidates: [],
          cadParcels: [],
          status: "CURRENT_ADDRESS_CANDIDATES_FOUND",
          exactHistoricalParcelMatch: false,
          confidence: "LOW",
          reasons: [
            "Current Quebec City place/address identity is an anchor candidate only.",
            "No current lot or historical parcel continuity is asserted without RQA/matrice/archival geometry reconciliation.",
          ],
        })),
      }
    : await resolveCurrentParcelDoorCandidates(streetLineage.results, Math.min(3, maxLookups));

  const bestHistory = [...history.results].sort((a: any, b: any) => b.score - a.score)[0];
  const bestMicro = micro.results.find((item: any) => item.fieldReady) ?? micro.results[0];
  const bestLineage = streetLineage.results.find((item: any) => item.status === "CONFIRMED_NAME_LINEAGE") ?? streetLineage.results[0];
  const bestParcel = parcelDoor.results.find((item: any) => item.cadParcels.length > 0) ?? parcelDoor.results[0];

  const operationalSources: string[] = [];
  if (isQuebecCity) {
    operationalSources.push(
      ...QUEBEC_CITY_AUTHORITY_SOURCES.map((source) => source.url),
      "https://www.donneesquebec.ca/recherche/dataset/adresses-de-la-ville-de-quebec",
      "https://www.donneesquebec.ca/recherche/dataset/vque_14",
      "https://www.donneesquebec.ca/recherche/dataset/empreintes-des-batiments",
      "https://mrnf.gouv.qc.ca/repertoire-geographique/adresses-referentiel-quebecois-adresses/",
      "https://www.ville.quebec.qc.ca/carteinteractive/"
    );
  }
  if (!isQuebecCity && bestLineage?.status && bestLineage.status !== "UNRESOLVED") {
    operationalSources.push(
      "https://opendata.paris.fr/explore/dataset/denominations-des-voies-caduques/",
      "https://opendata.paris.fr/explore/dataset/denominations-emprises-voies-actuelles/",
    );
  }
  if (!isQuebecCity && (bestParcel?.cadParcels ?? []).length > 0) {
    operationalSources.push("https://opendata.paris.fr/explore/dataset/adresses-ban/");
  }
  if (!isQuebecCity && (bestParcel?.currentDoorCandidates ?? []).length > 0) {
    operationalSources.push("https://opendata.paris.fr/explore/dataset/plan-de-voirie-portes-cocheres/");
  }

  const sourceUrls = [...new Set([
    ...seeds.flatMap((lead) => (lead.evidenceTrace ?? []).map((e) => e.url)),
    ...history.results.flatMap((item: any) => item.evidenceUrls),
    ...operationalSources,
  ].filter((url) => url && url !== "about:blank"))];
  const sourceFamilies = new Set(sourceUrls.map((url) => {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
  }));

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

  // Canonical candidate evaluation is deliberately conservative.
  // Unknown dimensions remain unscored and force HOLD instead of fabricated precision.
  const candidateRubric = evaluatePredatorCandidateRubric({
    qualityExperience: {
      score: null,
      justification: "Requires explicit assessment of whether the on-site experience is singular and worth the detour.",
    },
    access: {
      score: null,
      gate: "UNKNOWN",
      justification: "Current address/door candidates do not by themselves establish traveler access, visibility, opening conditions or understandability on site.",
    },
    trust: {
      score: bestHistory?.status === "CONFIRMED"
        ? Math.max(7, Math.min(10, Math.round((bestHistory.score / 10) * 10) / 10))
        : bestHistory?.status === "PARTIAL"
          ? Math.max(4, Math.min(6.9, Math.round((bestHistory.score / 10) * 10) / 10))
          : null,
      justification: bestHistory?.status === "CONFIRMED"
        ? "Historical evidence reached confirmed status with independent source support."
        : bestHistory?.status === "PARTIAL"
          ? "Historical evidence is partial; corroboration remains incomplete."
          : "Historical evidence has not yet reached a defensible scored state.",
    },
    microLocalization: {
      score: bestParcel?.exactHistoricalParcelMatch === true
        ? 10
        : bestLineage?.status === "CONFIRMED_NAME_LINEAGE" && (bestParcel?.cadParcels ?? []).length
          ? 6
          : bestLineage?.status === "CONFIRMED_NAME_LINEAGE"
            ? 4.5
            : null,
      justification: bestParcel?.exactHistoricalParcelMatch === true
        ? "Historical-to-current parcel continuity is independently established."
        : (bestParcel?.cadParcels ?? []).length
          ? "Street lineage and current parcel candidates are known, but historical parcel/door continuity remains unproved."
          : bestLineage?.status === "CONFIRMED_NAME_LINEAGE"
            ? "Street-name lineage is confirmed, but parcel/entrance continuity remains unresolved."
            : "Micro-location remains unresolved.",
    },
    narrative: {
      score: null,
      justification: "Requires explicit assessment of character, tension, causality, surprise, progression and consequence.",
    },
    visualAudiovisualPayoff: {
      score: null,
      justification: "Requires explicit inspection for an authentic look-for, archival visual, plan, photograph, engraving, object or physical trace.",
    },
    exposureDegree: {
      score: null,
      justification: "Exposure audit is not complete until official tourism plus mainstream tourist-facing sources are confronted under the exact angle.",
    },
    singularity: "Must be stated explicitly in the final candidate report.",
    placeContinuity: bestParcel?.exactHistoricalParcelMatch === true
      ? "Historical/current continuity established."
      : "Continuity not yet established at historical parcel/entrance level.",
    exposureSourceQuality: "Must list the exact tourism-facing source families checked, including the official destination tourism office and mainstream traveler channels.",
  });

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
    cityHistoricalContext: isQuebecCity ? {
      eras: QUEBEC_CITY_HISTORY_ERAS,
      rule: "Historical context guides queries and contradiction checks only; it is never publishable evidence by itself.",
    } : undefined,
    candidateEvaluation: candidateRubric,
    candidateRubricDefinition: PREDATOR_CANONICAL_CANDIDATE_RUBRIC,
    sources: sourceUrls.slice(0, 20),
    unresolved: [
      ...(bestParcel?.exactHistoricalParcelMatch === false ? ["Exact historical parcel/door continuity is not established until historical plan geometry is independently aligned."] : []),
      ...(bestHistory?.status !== "CONFIRMED" ? ["Historical evidence did not reach confirmed status."] : []),
      ...(bestLineage?.status !== "CONFIRMED_NAME_LINEAGE" ? ["Street-name lineage is not fully confirmed."] : []),
    ],
  };

  return {
    missionId: id,
    status: contained ? "CONTAINED" as PredatorMissionStatus : held ? "PARTIAL" as PredatorMissionStatus : "COMPLETED" as PredatorMissionStatus,
    telemetry,
    heartbeat,
    report,
  };
}

export const PREDATOR_MISSION_RULE =
  "A Predator mission is human-authorized, historical-only, city-capability aware, heartbeat-gated, independently verified, and fail-closed. Every candidate report uses the canonical seven-criterion /10 rubric with Access and Exposure as absolute gates. Unknown Access or Exposure forces HOLD. Unsupported city automation, missing evidence, integrity mismatch, or exact historical continuity gaps can never be silently filled with inference.";
