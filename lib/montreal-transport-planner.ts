import { getNowCityConfig, pointIsInsideCity } from "./city-config";
import { getMontrealTransitHealth, type MontrealTransitMode } from "./montreal-transit";

export type MontrealCoordinates = { lat: number; lon: number };

export type MontrealTransportOption = {
  id: MontrealTransitMode;
  label: string;
  minutes: number | null;
  source: "official" | "estimated" | "status-only";
  available: boolean;
  detail: string;
};

function haversineKm(a: MontrealCoordinates, b: MontrealCoordinates) {
  const toRad = (value: number) => value * Math.PI / 180;
  const earthKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function estimatedWalkMinutes(distanceKm: number) {
  return Math.max(3, Math.round((distanceKm / 4.7) * 60));
}

function estimatedTaxiMinutes(distanceKm: number) {
  // Deliberately conservative before a traffic provider is connected.
  return Math.max(6, Math.round(5 + (distanceKm / 22) * 60));
}

export async function planMontrealTransport(origin: MontrealCoordinates, destination: MontrealCoordinates) {
  const city = getNowCityConfig("montreal");
  if (!pointIsInsideCity("montreal", origin) || !pointIsInsideCity("montreal", destination)) {
    return {
      ok: false as const,
      error: "Journey is outside the Montréal NOW operating area.",
    };
  }

  const distanceKm = haversineKm(origin, destination);
  if (distanceKm > 42) {
    return {
      ok: false as const,
      error: "Journey is outside the Montréal NOW local planning envelope.",
    };
  }

  const health = await getMontrealTransitHealth();
  const remUsable = health.rem.officialStatusReachable && health.rem.service !== "degraded";
  const stmRealtime = health.stm.realtimeConfigured;

  const options: MontrealTransportOption[] = [
    {
      id: "walk",
      label: "Walk",
      minutes: estimatedWalkMinutes(distanceKm),
      source: "estimated",
      available: distanceKm <= 8,
      detail: `${distanceKm.toFixed(1)} km · pedestrian estimate`,
    },
    {
      id: "taxi",
      label: "Taxi",
      minutes: estimatedTaxiMinutes(distanceKm),
      source: "estimated",
      available: true,
      detail: `${distanceKm.toFixed(1)} km · road estimate before live traffic`,
    },
    {
      id: "metro",
      label: "Métro STM",
      minutes: null,
      source: "status-only",
      available: true,
      detail: stmRealtime
        ? "STM realtime is configured; exact journey timing will be attached only after official route calculation."
        : "STM network available. NOW will not invent an ETA until the official realtime route calculation is connected.",
    },
    {
      id: "bus",
      label: "Bus STM",
      minutes: null,
      source: "status-only",
      available: true,
      detail: stmRealtime
        ? "STM realtime is configured; exact journey timing will be attached only after official route calculation."
        : "STM network available. NOW will not invent an ETA until the official realtime route calculation is connected.",
    },
    {
      id: "rem",
      label: "REM",
      minutes: null,
      source: health.rem.officialStatusReachable ? "official" : "status-only",
      available: remUsable,
      detail: health.rem.service === "normal"
        ? "Official REM status: service normal. Exact journey timing is added only after station routing is confirmed."
        : health.rem.service === "degraded"
          ? "Official REM status indicates a disruption. NOW will prefer a fallback."
          : "REM status could not be confirmed. NOW will not present it as a live option.",
    },
  ];

  return {
    ok: true as const,
    city: city.id,
    distanceKm,
    origin,
    destination,
    options,
    provider: {
      stm: health.stm,
      rem: health.rem,
      travelerSafe: health.travelerSafe,
      degraded: health.degraded,
    },
    disclaimer: "Public transport ETAs are never estimated as live data. STM/REM times become official only when returned by an official routing or realtime source.",
  };
}
