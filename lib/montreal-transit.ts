import { getNowCityConfig } from "./city-config";

export type MontrealTransitMode = "metro" | "bus" | "rem" | "walk" | "taxi";

export const MONTREAL_TRANSIT_MODES: MontrealTransitMode[] = ["metro", "bus", "rem", "walk", "taxi"];

function classifyRemService(html: string): "normal" | "degraded" | "unknown" {
  const normalized = html.toLowerCase().replace(/\s+/g, " ");

  // Prefer an explicit active normal-state marker over generic text elsewhere on the page
  // (for example planned/future interruption notices).
  if (/service\s*-?\s*normal/.test(normalized)) return "normal";

  if (
    /ralentissement\s+de\s+service/.test(normalized)
    || /interruption\s+de\s+service/.test(normalized)
    || /service\s+(?:est\s+)?interrompu/.test(normalized)
    || /service\s+(?:est\s+)?ralenti/.test(normalized)
  ) return "degraded";

  return "unknown";
}

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
      remService = classifyRemService(await response.text());
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
