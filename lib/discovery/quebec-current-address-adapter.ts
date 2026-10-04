import type { ForeuseDocument, ForeuseTarget } from "./foreuse-core";
import { evaluateStrongIdentity } from "./foreuse-identity-gate";

const QUEBEC_ADDRESS_CSV = "https://www.donneesquebec.ca/recherche/dataset/2567eac8-a3ce-423a-a43d-6b8e74708c1d/resource/cef2c0b7-8eac-4466-9a0b-6987501edace/download/vdq-adresse.csv";
const DATASET_PAGE = "https://www.donneesquebec.ca/recherche/dataset/adresses-de-la-ville-de-quebec";

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function streetTokens(location: string) {
  const generic = new Set(["rue","avenue","boulevard","chemin","cote","place","quai","quebec","canada","saint","est","ouest"]);
  return normalize(location).split(/[^a-z0-9]+/).filter((x) => x.length >= 3 && !generic.has(x) && !/^\d+$/.test(x));
}

async function fetchAddressCsv() {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 12000);
  try {
    const r = await fetch(QUEBEC_ADDRESS_CSV, {
      headers: { "user-agent": "VelvetPassportForeuse/0.4", accept: "text/csv,text/plain,*/*" },
      signal: c.signal,
      redirect: "follow",
      next: { revalidate: 21600 },
    });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function collectQuebecCurrentAddressAnchors(target: ForeuseTarget): Promise<ForeuseDocument[]> {
  const location = target.location ?? "";
  const civic = location.match(/\b\d{1,5}\b/)?.[0];
  const streets = streetTokens(location);
  if (!civic || streets.length === 0) return [];

  const csv = await fetchAddressCsv();
  if (!csv) return [];

  const lines = csv.split(/\r?\n/);
  const matches: string[] = [];
  for (const line of lines) {
    const n = normalize(line);
    if (!new RegExp(`(?:^|[^0-9])${civic}(?:[^0-9]|$)`).test(n)) continue;
    if (!streets.some((s) => n.includes(s))) continue;
    matches.push(line.slice(0, 1200));
    if (matches.length >= 8) break;
  }
  if (!matches.length) return [];

  const text = [`CURRENT_ADDRESS_LAYER_ONLY`, `Target: ${location}`, ...matches].join("\n");
  const identity = evaluateStrongIdentity(target, `${location}\n${text}`);
  if (!identity.pass) return [];

  return [{
    url: DATASET_PAGE,
    host: "donneesquebec.ca",
    title: `Current Québec address anchor: ${location}`,
    text,
    links: [QUEBEC_ADDRESS_CSV],
    familyId: "RQA",
    query: "DIRECT_CURRENT_ADDRESS",
    relevance: 88,
    evidenceSignals: ["CURRENT_ADDRESS", "ADDRESS", "GEOMETRY_LAYER"],
    fetched: true,
  }];
}

export const QUEBEC_CURRENT_ADDRESS_RULE = "Current municipal address points may corroborate a present-day anchor only. They never prove historical numbering, parcel continuity, building survival or event location.";
