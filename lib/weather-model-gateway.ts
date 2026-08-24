import { createRequire } from "node:module";
import type { Coordinates, WeatherModelId, WeatherReading } from "./weather-intelligence";

const require = createRequire(import.meta.url);
const Bunzip = require("seek-bzip") as { decode(input: Buffer): Buffer };

let gribReady: Promise<typeof import("@trkbt10/grib2-wasm")> | null = null;

async function grib() {
  if (!gribReady) {
    gribReady = import("@trkbt10/grib2-wasm").then(async (module) => {
      await module.init();
      return module;
    });
  }
  return gribReady;
}

function scenarioFromValues(temperature?: number, precipitation?: number): WeatherReading["scenario"] {
  if ((precipitation ?? 0) > 0.2) return "rain";
  if (typeof temperature === "number" && temperature >= 28) return "heat";
  if (typeof temperature === "number" && temperature <= 4) return "cold";
  return "route";
}

function normalizeTemperature(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return value > 170 ? value - 273.15 : value;
}

function nearestValue(bytes: Uint8Array, point: Coordinates): number | undefined {
  try {
    const wasmPromise = grib();
    throw wasmPromise;
  } catch (promise) {
    if (promise instanceof Promise) throw promise;
    return undefined;
  }
}

async function decodeNearest(bytes: Uint8Array, point: Coordinates): Promise<number | undefined> {
  const module = await grib();
  const handle = module.parseGrib2(bytes);
  const count = module.getRecordCount(handle);
  if (!count) return undefined;

  for (let record = 1; record <= count; record += 1) {
    try {
      const values = module.getGridData(handle, record);
      const lats = module.getLatitudes(handle, record);
      const lons = module.getLongitudes(handle, record);
      let best = Number.POSITIVE_INFINITY;
      let selected: number | undefined;
      for (let index = 0; index < values.length; index += 1) {
        const value = Number(values[index]);
        const lat = Number(lats[index]);
        let lon = Number(lons[index]);
        if (lon > 180) lon -= 360;
        if (!Number.isFinite(value) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const dx = (lon - point.lon) * Math.cos(point.lat * Math.PI / 180);
        const dy = lat - point.lat;
        const distance = dx * dx + dy * dy;
        if (distance < best) {
          best = distance;
          selected = value;
        }
      }
      if (selected !== undefined) return selected;
    } catch {
      continue;
    }
  }
  return undefined;
}

function utcRun(hoursBack: number, cycleHours: number) {
  const date = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  const hour = Math.floor(date.getUTCHours() / cycleHours) * cycleHours;
  date.setUTCHours(hour, 0, 0, 0);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  return { date, ymd: `${yyyy}${mm}${dd}`, hh, stamp: `${yyyy}${mm}${dd}${hh}` };
}

async function fetchBytes(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { Accept: "application/octet-stream", "User-Agent": "VelvetPassportNOW/1.0", ...(init?.headers ?? {}) },
    next: { revalidate: 1800 },
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`Weather source ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function fetchDwdField(modelPath: "icon-eu" | "icon", cycle: string, stamp: string, field: string, step: number, regular = true) {
  const domain = modelPath === "icon-eu" ? "europe" : "global";
  const grid = regular && modelPath === "icon-eu" ? "regular-lat-lon" : "icosahedral";
  const filenamePrefix = modelPath === "icon-eu" ? "icon-eu" : "icon";
  const file = `${filenamePrefix}_${domain}_${grid}_single-level_${stamp}_${String(step).padStart(3, "0")}_${field}.grib2.bz2`;
  const url = `https://opendata.dwd.de/weather/nwp/${modelPath}/grib/${cycle}/${field.toLowerCase()}/${file}`;
  const compressed = await fetchBytes(url);
  return new Uint8Array(Bunzip.decode(Buffer.from(compressed)));
}

async function fetchIcon(point: Coordinates, global: boolean): Promise<WeatherReading> {
  const model: WeatherModelId = global ? "icon-global" : "icon-eu";
  const source = global ? "DWD ICON Global" : "DWD ICON-EU";
  try {
    const run = utcRun(4, 3);
    const path = global ? "icon" : "icon-eu";
    const [tempBytes, uBytes, vBytes, precipBytes] = await Promise.all([
      fetchDwdField(path, run.hh, run.stamp, "T_2M", 0, !global),
      fetchDwdField(path, run.hh, run.stamp, "U_10M", 0, !global),
      fetchDwdField(path, run.hh, run.stamp, "V_10M", 0, !global),
      fetchDwdField(path, run.hh, run.stamp, "TOT_PREC", 1, !global),
    ]);
    const [rawTemperature, u, v, precipitation] = await Promise.all([
      decodeNearest(tempBytes, point),
      decodeNearest(uBytes, point),
      decodeNearest(vBytes, point),
      decodeNearest(precipBytes, point),
    ]);
    const temperature = normalizeTemperature(rawTemperature);
    const wind = u !== undefined && v !== undefined ? Math.hypot(u, v) : undefined;
    return {
      model,
      available: temperature !== undefined,
      temperature,
      wind,
      precipitation: precipitation !== undefined ? Math.max(0, precipitation) : undefined,
      symbol: "model",
      scenario: scenarioFromValues(temperature, precipitation),
      source,
      observedAt: run.date.toISOString(),
    };
  } catch {
    return { model, available: false, scenario: "route", source };
  }
}

async function fetchGfs(point: Coordinates): Promise<WeatherReading> {
  const model: WeatherModelId = "gfs";
  const source = "NOAA GFS";
  try {
    const run = utcRun(4, 6);
    const pad = 0.35;
    const params = new URLSearchParams({
      file: `gfs.t${run.hh}z.pgrb2.0p25.f001`,
      var_TMP: "on",
      var_UGRD: "on",
      var_VGRD: "on",
      var_APCP: "on",
      lev_2_m_above_ground: "on",
      lev_10_m_above_ground: "on",
      lev_surface: "on",
      subregion: "",
      leftlon: String(point.lon - pad),
      rightlon: String(point.lon + pad),
      toplat: String(point.lat + pad),
      bottomlat: String(point.lat - pad),
      dir: `/gfs.${run.ymd}/${run.hh}/atmos`,
    });
    const bytes = await fetchBytes(`https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl?${params.toString()}`);
    const module = await grib();
    const handle = module.parseGrib2(bytes);
    const count = module.getRecordCount(handle);
    let temperature: number | undefined;
    let u: number | undefined;
    let v: number | undefined;
    let precipitation: number | undefined;
    for (let record = 1; record <= count; record += 1) {
      const section = module.getSection4(handle, record);
      const category = section.parameterCategory;
      const number = section.parameterNumber;
      const value = await decodeNearestRecord(module, handle, record, point);
      if (value === undefined) continue;
      if (category === 0 && number === 0 && temperature === undefined) temperature = normalizeTemperature(value);
      else if (category === 2 && number === 2 && u === undefined) u = value;
      else if (category === 2 && number === 3 && v === undefined) v = value;
      else if (category === 1 && number === 8) precipitation = Math.max(0, value);
    }
    const wind = u !== undefined && v !== undefined ? Math.hypot(u, v) : undefined;
    return { model, available: temperature !== undefined, temperature, wind, precipitation, symbol: "model", scenario: scenarioFromValues(temperature, precipitation), source, observedAt: run.date.toISOString() };
  } catch {
    return { model, available: false, scenario: "route", source };
  }
}

async function decodeNearestRecord(module: typeof import("@trkbt10/grib2-wasm"), handle: number, record: number, point: Coordinates) {
  try {
    const values = module.getGridData(handle, record);
    const lats = module.getLatitudes(handle, record);
    const lons = module.getLongitudes(handle, record);
    let best = Number.POSITIVE_INFINITY;
    let selected: number | undefined;
    for (let index = 0; index < values.length; index += 1) {
      const value = Number(values[index]);
      const lat = Number(lats[index]);
      let lon = Number(lons[index]);
      if (lon > 180) lon -= 360;
      if (!Number.isFinite(value) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const dx = (lon - point.lon) * Math.cos(point.lat * Math.PI / 180);
      const dy = lat - point.lat;
      const distance = dx * dx + dy * dy;
      if (distance < best) { best = distance; selected = value; }
    }
    return selected;
  } catch { return undefined; }
}

type EcmwfIndexLine = { param?: string; _offset?: number; _length?: number };

async function fetchEcmwf(point: Coordinates): Promise<WeatherReading> {
  const model: WeatherModelId = "ecmwf-ifs";
  const source = "ECMWF IFS Open Data";
  try {
    const run = utcRun(8, 6);
    const step = 3;
    const root = `https://data.ecmwf.int/forecasts/${run.ymd}/${run.hh}z/ifs/0p25/oper/${run.stamp}0000-${step}h-oper-fc`;
    const indexResponse = await fetch(`${root}.index`, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(8000) });
    if (!indexResponse.ok) throw new Error("ECMWF index unavailable");
    const lines = (await indexResponse.text()).split("\n").filter(Boolean).map((line) => JSON.parse(line) as EcmwfIndexLine);
    const wanted = ["2t", "10u", "10v", "tp"];
    const selected = Object.fromEntries(wanted.map((param) => [param, lines.find((line) => line.param === param)]));
    const values: Record<string, number | undefined> = {};
    await Promise.all(wanted.map(async (param) => {
      const entry = selected[param] as EcmwfIndexLine | undefined;
      if (!entry || entry._offset === undefined || entry._length === undefined) return;
      const bytes = await fetchBytes(`${root}.grib2`, { headers: { Range: `bytes=${entry._offset}-${entry._offset + entry._length - 1}` } });
      values[param] = await decodeNearest(bytes, point);
    }));
    const temperature = normalizeTemperature(values["2t"]);
    const u = values["10u"];
    const v = values["10v"];
    const wind = u !== undefined && v !== undefined ? Math.hypot(u, v) : undefined;
    const precipitation = values.tp !== undefined ? Math.max(0, values.tp * 1000) : undefined;
    return { model, available: temperature !== undefined, temperature, wind, precipitation, symbol: "model", scenario: scenarioFromValues(temperature, precipitation), source, observedAt: run.date.toISOString() };
  } catch {
    return { model, available: false, scenario: "route", source };
  }
}

export async function fetchOfficialWeatherModel(model: Exclude<WeatherModelId, "met">, point: Coordinates): Promise<WeatherReading> {
  if (model === "icon-eu") return fetchIcon(point, false);
  if (model === "icon-global") return fetchIcon(point, true);
  if (model === "gfs") return fetchGfs(point);
  return fetchEcmwf(point);
}
