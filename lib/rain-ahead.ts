import type { Coordinates } from "./weather-intelligence";

export type RainAhead = {
  available: boolean;
  alert: boolean;
  minutesUntil?: number;
  precipitationMm?: number;
  confidence: "high" | "moderate" | "low" | "none";
  source: string;
  message?: string;
  action?: "offer-route-adjustment";
};

type MetSeries = {
  time?: string;
  data?: {
    next_1_hours?: {
      summary?: { symbol_code?: string };
      details?: { precipitation_amount?: number };
    };
  };
};

function isRain(symbol: string, precipitationMm: number) {
  const normalized = symbol.toLowerCase();
  if (/snow|sleet/.test(normalized)) return false;
  return precipitationMm >= 0.2 || /rain|drizzle|shower|thunder/.test(normalized);
}

function roundedMinutes(value: number) {
  if (value <= 2) return 0;
  if (value <= 10) return 5;
  return Math.max(10, Math.round(value / 5) * 5);
}

export async function getRainAhead(point: Coordinates): Promise<RainAhead> {
  try {
    const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${point.lat.toFixed(4)}&lon=${point.lon.toFixed(4)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "VelvetPassportNOW/1.0 https://github.com/naturlabs1996-creator/velvet-passport-now",
        Accept: "application/json",
      },
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error("MET unavailable");

    const payload = await response.json() as { properties?: { timeseries?: MetSeries[] } };
    const now = Date.now();
    const horizonMs = 75 * 60 * 1000;
    const candidates = (payload.properties?.timeseries ?? [])
      .map((series) => {
        const at = series.time ? Date.parse(series.time) : NaN;
        const period = series.data?.next_1_hours;
        const precipitationMm = Number(period?.details?.precipitation_amount ?? 0);
        const symbol = period?.summary?.symbol_code ?? "";
        return { at, precipitationMm, symbol };
      })
      .filter((item) => Number.isFinite(item.at) && item.at >= now - 10 * 60 * 1000 && item.at <= now + horizonMs)
      .sort((a, b) => a.at - b.at);

    if (!candidates.length) {
      return { available: false, alert: false, confidence: "none", source: "MET Norway" };
    }

    const rainy = candidates.find((item) => isRain(item.symbol, item.precipitationMm));
    if (!rainy) {
      return { available: true, alert: false, confidence: "high", source: "MET Norway" };
    }

    const minutesUntilRaw = Math.max(0, (rainy.at - now) / 60000);
    const minutesUntil = roundedMinutes(minutesUntilRaw);
    const strongSignal = rainy.precipitationMm >= 0.5 || /heavyrain|thunder/.test(rainy.symbol.toLowerCase());
    const confidence: RainAhead["confidence"] = strongSignal ? "high" : rainy.precipitationMm >= 0.2 ? "moderate" : "low";
    const alert = minutesUntilRaw <= 60 && confidence !== "low";

    return {
      available: true,
      alert,
      minutesUntil,
      precipitationMm: rainy.precipitationMm,
      confidence,
      source: "MET Norway",
      message: alert ? (minutesUntil === 0 ? "Rain is likely now." : `Rain is likely in about ${minutesUntil} minutes.`) : undefined,
      action: alert ? "offer-route-adjustment" : undefined,
    };
  } catch {
    return { available: false, alert: false, confidence: "none", source: "MET Norway" };
  }
}
