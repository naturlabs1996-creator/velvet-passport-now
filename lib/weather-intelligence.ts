import { fetchOfficialWeatherModel } from "./weather-model-gateway";

export type Coordinates = { lat: number; lon: number };
export type WeatherScenario = "route" | "rain" | "snow" | "heat" | "cold";
export type WeatherRegion = "europe" | "north-america" | "asia" | "global";
export type WeatherModelId = "icon-eu" | "icon-global" | "gfs" | "ecmwf-ifs" | "met";

export type WeatherReading = {
  model: WeatherModelId;
  available: boolean;
  temperature?: number;
  wind?: number;
  precipitation?: number;
  symbol?: string;
  scenario: WeatherScenario;
  source: string;
  observedAt?: string;
};

export type WeatherIntelligence = {
  available: boolean;
  temperature?: number;
  wind?: number;
  precipitation?: number;
  symbol?: string;
  scenario: WeatherScenario;
  source: string;
  region: WeatherRegion;
  primaryModel: WeatherModelId | null;
  modelsUsed: WeatherModelId[];
  modelsAttempted: WeatherModelId[];
  agreement: "high" | "mixed" | "single-source" | "none";
  readings: WeatherReading[];
};

const MODEL_PRIORITY: Record<WeatherRegion, WeatherModelId[]> = {
  europe: ["icon-eu", "ecmwf-ifs", "icon-global", "met"],
  "north-america": ["gfs", "ecmwf-ifs", "icon-global", "met"],
  asia: ["gfs", "icon-global", "ecmwf-ifs", "met"],
  global: ["gfs", "icon-global", "ecmwf-ifs", "met"],
};

function finite(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function classifyWeatherRegion(point: Coordinates): WeatherRegion {
  const { lat, lon } = point;
  if (lat >= 34 && lat <= 72 && lon >= -25 && lon <= 45) return "europe";
  if (lat >= 5 && lat <= 84 && lon >= -170 && lon <= -50) return "north-america";
  if (lat >= -12 && lat <= 82 && lon >= 45 && lon <= 180) return "asia";
  return "global";
}

function scenarioFromValues(temperature?: number, precipitation?: number, symbol = ""): WeatherScenario {
  const normalized = symbol.toLowerCase();
  if (/snow|blizzard|snowfall/.test(normalized)) return "snow";
  if ((precipitation ?? 0) > 0.2 || /rain|sleet|shower|drizzle|thunder/.test(normalized)) return "rain";
  if (typeof temperature === "number" && temperature >= 28) return "heat";
  if (typeof temperature === "number" && temperature <= 4) return "cold";
  return "route";
}

async function fetchMet(point: Coordinates): Promise<WeatherReading> {
  try {
    const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${point.lat.toFixed(4)}&lon=${point.lon.toFixed(4)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "VelvetPassportNOW/1.0 https://github.com/naturlabs1996-creator/velvet-passport-now",
        Accept: "application/json",
      },
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error("MET unavailable");
    const payload = await response.json() as {
      properties?: { timeseries?: Array<{ time?: string; data?: {
        instant?: { details?: { air_temperature?: number; wind_speed?: number } };
        next_1_hours?: { summary?: { symbol_code?: string }; details?: { precipitation_amount?: number } };
        next_6_hours?: { summary?: { symbol_code?: string }; details?: { precipitation_amount?: number } };
      } }> };
    };
    const firstSeries = payload.properties?.timeseries?.[0];
    const first = firstSeries?.data;
    const details = first?.instant?.details;
    const period = first?.next_1_hours ?? first?.next_6_hours;
    const temperature = finite(details?.air_temperature);
    const wind = finite(details?.wind_speed);
    const precipitation = finite(period?.details?.precipitation_amount) ?? 0;
    const symbol = period?.summary?.symbol_code ?? "unknown";
    return {
      model: "met",
      available: temperature !== undefined,
      temperature,
      wind,
      precipitation,
      symbol,
      scenario: scenarioFromValues(temperature, precipitation, symbol),
      source: "MET Norway",
      observedAt: firstSeries?.time,
    };
  } catch {
    return { model: "met", available: false, scenario: "route", source: "MET Norway" };
  }
}

function median(values: number[]) {
  if (!values.length) return undefined;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function chooseScenario(readings: WeatherReading[], priority: WeatherModelId[]): { scenario: WeatherScenario; agreement: WeatherIntelligence["agreement"] } {
  if (!readings.length) return { scenario: "route", agreement: "none" };
  if (readings.length === 1) return { scenario: readings[0].scenario, agreement: "single-source" };
  const counts = new Map<WeatherScenario, number>();
  for (const reading of readings) counts.set(reading.scenario, (counts.get(reading.scenario) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked[0][1] > readings.length / 2) return { scenario: ranked[0][0], agreement: "high" };
  const firstPriority = priority.find((model) => readings.some((reading) => reading.model === model));
  const chosen = readings.find((reading) => reading.model === firstPriority)?.scenario ?? readings[0].scenario;
  return { scenario: chosen, agreement: "mixed" };
}

export async function getWeatherIntelligence(point: Coordinates): Promise<WeatherIntelligence> {
  const region = classifyWeatherRegion(point);
  const priority = MODEL_PRIORITY[region];

  const readings = await Promise.all(priority.map((model) => model === "met" ? fetchMet(point) : fetchOfficialWeatherModel(model, point)));
  const available = readings.filter((reading) => reading.available);
  const decision = chooseScenario(available, priority);
  const primaryModel = priority.find((model) => available.some((reading) => reading.model === model)) ?? null;
  const primary = available.find((reading) => reading.model === primaryModel) ?? available[0];
  const temperatures = available.map((reading) => reading.temperature).filter((value): value is number => typeof value === "number");
  const winds = available.map((reading) => reading.wind).filter((value): value is number => typeof value === "number");
  const precipitations = available.map((reading) => reading.precipitation).filter((value): value is number => typeof value === "number");

  return {
    available: available.length > 0,
    temperature: median(temperatures),
    wind: median(winds),
    precipitation: median(precipitations),
    symbol: primary?.symbol,
    scenario: decision.scenario,
    source: available.length > 1 ? `NOW weather consensus · ${available.map((reading) => reading.source).join(" + ")}` : primary?.source ?? "NOW Weather Intelligence",
    region,
    primaryModel,
    modelsUsed: available.map((reading) => reading.model),
    modelsAttempted: priority,
    agreement: decision.agreement,
    readings,
  };
}
