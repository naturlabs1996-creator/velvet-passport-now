import { getNowCityConfig } from "./city-config";

export type MontrealTransitMode = "metro" | "bus" | "rem" | "walk" | "taxi";

export const MONTREAL_TRANSIT_MODES: MontrealTransitMode[] = ["metro", "bus", "rem", "walk", "taxi"];

export async function getMontrealTransitHealth() {
  const city = getNowCityConfig("montreal");
  const realtimeConfigured = Boolean(process.env.STM_API_KEY);
  let remStatusReachable = false;
  let remService: "normal" | "degraded" | "unknown" = "unknown";

  try {
    const response = await fetch("https://rem.info/fr/se-deplacer/etat-du-service", {
      headers: { Accept: "text/html" },
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
    if (response.ok) {
      remStatusReachable = true;
      const html = (await response.text()).toLowerCase();
      remService = html.includes("ralentissement de service") || html.includes("interruption de service")
        ? "degraded"
        : html.includes("service - normal") || html.includes("service normal")
          ? "normal"
          : "unknown";
    }
  } catch {}

  return {
    checkedAt: new Date().toISOString(),
    city: city.id,
    provider: "montreal-regional" as const,
    modes: MONTREAL_TRANSIT_MODES,
    stm: {
      staticGtfsAvailable: true,
      realtimeConfigured,
      serviceStatusConfigured: realtimeConfigured,
      source: "STM" as const,
    },
    rem: {
      officialStatusReachable: remStatusReachable,
      service: remService,
      yulBranch: "testing" as const,
      source: "REM" as const,
    },
    travelerSafe: true,
    degraded: !realtimeConfigured || !remStatusReachable || remService !== "normal",
  };
}
