import type { NowScenario } from "./now-engine";

export type NowNeedType = "food" | "pharmacy" | "water" | "restroom" | "sitdown" | "battery" | "medication" | "glucose";
export type NowWeatherScenario = "route" | "rain" | "snow" | "heat" | "cold";

export type NowNeedConstraint = {
  type: NowNeedType;
  withinMinutes?: number;
  cuisine?: string;
  after?: NowNeedType | "route-start" | "transport";
  selectedPoi?: { name?: string; lat?: number; lon?: number };
};

export type NowComposableRequest = {
  routeId?: string;
  location?: { lat: number; lon: number };
  availableMinutes: number;
  ticket?: {
    time?: string;
    venue?: string;
    protectedMarginMinutes?: number;
  };
  transport?: {
    minutes: number;
    mode?: string;
    label: string;
    origin: string;
    detail?: string;
    source?: "official" | "estimated";
  };
  weather?: {
    scenario?: NowWeatherScenario;
    automatic?: boolean;
  };
  disruptions?: {
    automatic?: boolean;
    blockedStop?: string;
  };
  needs: NowNeedConstraint[];
  legacyScenario?: NowScenario;
};

function validLocation(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const lat = Number(raw.lat);
  const lon = Number(raw.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
  if (lat < 48.80 || lat > 48.92 || lon < 2.20 || lon > 2.50) return undefined;
  return { lat, lon };
}

function parseNeed(value: unknown): NowNeedConstraint | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const type = raw.type;
  if (!["food", "pharmacy", "water", "restroom", "sitdown", "battery", "medication", "glucose"].includes(String(type))) return null;
  const within = Number(raw.withinMinutes);
  const selectedPoi = raw.selectedPoi && typeof raw.selectedPoi === "object" ? raw.selectedPoi as Record<string, unknown> : null;
  return {
    type: type as NowNeedType,
    withinMinutes: Number.isFinite(within) ? Math.max(1, Math.min(240, within)) : undefined,
    cuisine: typeof raw.cuisine === "string" && raw.cuisine.trim() ? raw.cuisine.trim().slice(0, 80) : undefined,
    after: typeof raw.after === "string" ? raw.after as NowNeedConstraint["after"] : undefined,
    selectedPoi: selectedPoi ? {
      name: typeof selectedPoi.name === "string" ? selectedPoi.name.slice(0, 180) : undefined,
      lat: Number.isFinite(Number(selectedPoi.lat)) ? Number(selectedPoi.lat) : undefined,
      lon: Number.isFinite(Number(selectedPoi.lon)) ? Number(selectedPoi.lon) : undefined,
    } : undefined,
  };
}

export function normalizeNowRequest(input: Record<string, unknown>, legacyScenario?: NowScenario): NowComposableRequest {
  // Reservation rescue must preserve the real remaining time. Never inflate a
  // critical 6-minute window into the previous 15-minute minimum.
  const availableMinutes = typeof input.availableMinutes === "number" && Number.isFinite(input.availableMinutes)
    ? Math.max(1, Math.min(480, input.availableMinutes))
    : 90;
  const ticketTime = typeof input.ticketTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(input.ticketTime) ? input.ticketTime : undefined;
  const rawTicket = input.ticket && typeof input.ticket === "object" ? input.ticket as Record<string, unknown> : null;
  const rawTransport = input.transport && typeof input.transport === "object" ? input.transport as Record<string, unknown> : null;
  const rawWeather = input.weather && typeof input.weather === "object" ? input.weather as Record<string, unknown> : null;
  const rawDisruptions = input.disruptions && typeof input.disruptions === "object" ? input.disruptions as Record<string, unknown> : null;
  const rawNeeds = Array.isArray(input.needs) ? input.needs : [];
  const needs = rawNeeds.map(parseNeed).filter((need): need is NowNeedConstraint => Boolean(need));

  if (!needs.length && legacyScenario && ["food", "pharmacy", "water", "restroom", "sitdown", "battery", "medication", "glucose"].includes(legacyScenario)) {
    needs.push({
      type: legacyScenario as NowNeedType,
      selectedPoi: input.selectedPoi && typeof input.selectedPoi === "object" ? input.selectedPoi as NowNeedConstraint["selectedPoi"] : undefined,
    });
  }

  const transport = rawTransport && typeof rawTransport.origin === "string" && typeof rawTransport.label === "string" && Number.isFinite(Number(rawTransport.minutes))
    ? {
        minutes: Math.max(1, Math.min(180, Math.round(Number(rawTransport.minutes)))),
        mode: typeof rawTransport.mode === "string" ? rawTransport.mode : undefined,
        label: rawTransport.label.slice(0, 120),
        origin: rawTransport.origin.slice(0, 180),
        detail: typeof rawTransport.detail === "string" ? rawTransport.detail.slice(0, 240) : undefined,
        source: rawTransport.source === "official" ? "official" as const : "estimated" as const,
      }
    : undefined;

  return {
    routeId: typeof input.routeId === "string" ? input.routeId : undefined,
    location: validLocation(input.location),
    availableMinutes,
    ticket: {
      time: typeof rawTicket?.time === "string" ? rawTicket.time : ticketTime,
      venue: typeof rawTicket?.venue === "string" ? rawTicket.venue.slice(0, 160) : undefined,
      protectedMarginMinutes: Number.isFinite(Number(rawTicket?.protectedMarginMinutes)) ? Math.max(3, Math.min(90, Number(rawTicket?.protectedMarginMinutes))) : 15,
    },
    transport,
    weather: {
      scenario: rawWeather && ["route", "rain", "snow", "heat", "cold"].includes(String(rawWeather.scenario)) ? rawWeather.scenario as NowWeatherScenario : undefined,
      automatic: rawWeather?.automatic !== false,
    },
    disruptions: {
      automatic: rawDisruptions?.automatic !== false,
      blockedStop: typeof rawDisruptions?.blockedStop === "string" ? rawDisruptions.blockedStop.slice(0, 180) : typeof input.blockedStop === "string" ? input.blockedStop.slice(0, 180) : undefined,
    },
    needs,
    legacyScenario,
  };
}
