import { getConfidentialRoutes, isUncoveredExclusive } from "./confidential-routes";

export type NowScenario = "route" | "rain" | "blocked" | "food" | "water" | "restroom" | "energy" | "pharmacy" | "sitdown" | "battery" | "medication" | "glucose" | "guardian";

export type NowStop = {
  time: string;
  duration: string;
  title: string;
  detail: string;
  state?: "current" | "next" | "done" | "warning" | "destination";
};

export type RoutePlan = {
  eyebrow: string;
  title: string;
  meta: string;
  note: string;
  stops: NowStop[];
  ticket: {
    venue: string;
    time: string;
    entrance: string;
    marginMinutes: number;
    protected: boolean;
  };
  calculation: {
    mode: "prepared";
    generatedAt: string;
    factors: string[];
  };
};

const validScenarios: NowScenario[] = ["route", "rain", "blocked", "food", "water", "restroom", "energy", "pharmacy", "sitdown", "battery", "medication", "glucose", "guardian"];

const definitions: Record<NowScenario, Omit<RoutePlan, "ticket" | "calculation"> & { totalMinutes: number; marginMinutes: number }> = {
  route: {
    eyebrow: "VELVET ROUTE · LOUVRE & OPÉRA",
    title: "A quieter Paris before your Louvre entry.",
    meta: "62 min · 1.1 km · arrival margin 24 min",
    note: "NOW works backward from your Louvre ticket and keeps the last 24 minutes protected.",
    totalMinutes: 62, marginMinutes: 24,
    stops: [
      { time: "NOW", duration: "14 min", title: "Galerie Vivienne", detail: "Enter by rue Vivienne · covered", state: "current" },
      { time: "+18", duration: "16 min", title: "Palais-Royal courtyard", detail: "Quiet crossing · Velvet Pick", state: "next" },
      { time: "+42", duration: "12 min", title: "Carrousel entrance", detail: "Correct entrance · crowd-aware", state: "next" },
      { time: "16:06", duration: "24 min", title: "Protected arrival window", detail: "Louvre ticket · no rush", state: "destination" },
    ],
  },
  rain: {
    eyebrow: "WEATHER ADAPTATION",
    title: "Rain changed the route—not the day.",
    meta: "58 min · 82% sheltered · arrival margin 27 min",
    note: "Covered passages replace exposed crossings. Your Louvre obligation remains protected.",
    totalMinutes: 58, marginMinutes: 27,
    stops: [
      { time: "NOW", duration: "17 min", title: "Passage des Panoramas", detail: "Covered · warm reset", state: "current" },
      { time: "+21", duration: "15 min", title: "Galerie Vivienne", detail: "Indoor route · 3 min exposed", state: "next" },
      { time: "+44", duration: "11 min", title: "Carrousel entrance", detail: "Underground approach", state: "next" },
      { time: "16:03", duration: "27 min", title: "Protected arrival window", detail: "Ticket remains safe", state: "destination" },
    ],
  },
  blocked: {
    eyebrow: "ROUTE PROTECTION",
    title: "Rue Saint-Honoré is blocked. Rebuilding calmly.",
    meta: "66 min · +6 min · arrival margin 18 min",
    note: "The blocked segment is removed. NOW reroutes through Palais-Royal without sacrificing the ticket.",
    totalMinutes: 66, marginMinutes: 18,
    stops: [
      { time: "NOW", duration: "2 min", title: "Pause at the safe corner", detail: "Route issue confirmed", state: "warning" },
      { time: "+02", duration: "19 min", title: "Reroute via rue de Valois", detail: "Clear pedestrian access", state: "current" },
      { time: "+29", duration: "14 min", title: "Palais-Royal arcades", detail: "Protected alternative", state: "next" },
      { time: "16:12", duration: "18 min", title: "Protected arrival window", detail: "Louvre ticket protected", state: "destination" },
    ],
  },
  food: {
    eyebrow: "HUMAN NEED · FOOD",
    title: "A proper meal that still fits the day.",
    meta: "77 min total · Chez Vong · arrival margin 17 min",
    note: "Selected for rating confidence, walking time and compatibility with your next obligation.",
    totalMinutes: 77, marginMinutes: 17,
    stops: [
      { time: "NOW", duration: "11 min", title: "Walk to Chez Vong", detail: "Cantonese · €€€ · 9.1/10", state: "current" },
      { time: "+11", duration: "48 min", title: "Seated meal", detail: "10 rue de la Grande Truanderie", state: "next" },
      { time: "+63", duration: "14 min", title: "Resume protected route", detail: "17 min margin remains", state: "destination" },
    ],
  },
  water: {
    eyebrow: "HUMAN NEED · WATER",
    title: "Water now. No unnecessary detour.",
    meta: "7 min pause · free · route preserved",
    note: "A prepared public drinking-water point is inserted in the natural direction of travel.",
    totalMinutes: 7, marginMinutes: 24,
    stops: [
      { time: "NOW", duration: "3 min", title: "Walk to drinking-water point", detail: "Prepared location · public access", state: "current" },
      { time: "+03", duration: "4 min", title: "Refill and reset", detail: "Free · on your route", state: "next" },
      { time: "+07", duration: "12 min", title: "Resume current route", detail: "Destination preserved", state: "destination" },
    ],
  },
  restroom: {
    eyebrow: "HUMAN NEED · RESTROOM",
    title: "The nearest practical restroom—not merely a pin.",
    meta: "13 min stop · indoor · route preserved",
    note: "NOW checks practical access and walking direction before adding the stop.",
    totalMinutes: 13, marginMinutes: 21,
    stops: [
      { time: "NOW", duration: "5 min", title: "Carrousel du Louvre facilities", detail: "Prepared access route", state: "current" },
      { time: "+05", duration: "8 min", title: "Restroom stop", detail: "Indoor · accessible facilities", state: "next" },
      { time: "+13", duration: "12 min", title: "Resume from Carrousel exit", detail: "Original destination preserved", state: "destination" },
    ],
  },
  energy: {
    eyebrow: "NOW CARE · LOW ENERGY",
    title: "Less walking. More of the Paris worth keeping.",
    meta: "49 min · 620 m · seated pause included",
    note: "The route contracts around your energy instead of asking you to push through it.",
    totalMinutes: 49, marginMinutes: 31,
    stops: [
      { time: "NOW", duration: "6 min", title: "Quiet seated pause", detail: "Warm café · low noise", state: "current" },
      { time: "+18", duration: "12 min", title: "Short Palais-Royal loop", detail: "Benches · level access", state: "next" },
      { time: "+37", duration: "12 min", title: "Carrousel entrance", detail: "Shortest protected approach", state: "destination" },
    ],
  },
  pharmacy: {
    eyebrow: "NOW CARE · PHARMACY",
    title: "A pharmacy on the way—not across the city.",
    meta: "9 min detour · route preserved · ticket margin 19 min",
    note: "NOW adds a prepared pharmacy stop in the direction of the Louvre and preserves your arrival margin.",
    totalMinutes: 9, marginMinutes: 19,
    stops: [
      { time: "NOW", duration: "4 min", title: "Walk to nearby pharmacy", detail: "Prepared location · along your route", state: "current" },
      { time: "+04", duration: "5 min", title: "Pharmacy stop", detail: "Ask the pharmacist for professional advice", state: "next" },
      { time: "+09", duration: "12 min", title: "Resume protected route", detail: "Louvre ticket margin remains safe", state: "destination" },
    ],
  },
  sitdown: {
    eyebrow: "NOW CARE · SEATED PAUSE",
    title: "Sit down first. Paris will still be here.",
    meta: "11 min pause · nearby bench · route preserved",
    note: "NOW chooses a short seated stop before rebuilding the rest of the route around your energy.",
    totalMinutes: 11, marginMinutes: 20,
    stops: [
      { time: "NOW", duration: "3 min", title: "Palais-Royal garden bench", detail: "Prepared location · level access", state: "current" },
      { time: "+03", duration: "8 min", title: "Quiet seated pause", detail: "Shade and low walking effort", state: "next" },
      { time: "+11", duration: "12 min", title: "Resume gently", detail: "Original destination preserved", state: "destination" },
    ],
  },
  battery: {
    eyebrow: "NOW CARE · PHONE BATTERY",
    title: "A charging stop before your phone becomes the problem.",
    meta: "14 min pause · café charging point · route protected",
    note: "NOW adds a practical charging pause without losing the protected Louvre arrival window.",
    totalMinutes: 14, marginMinutes: 18,
    stops: [
      { time: "NOW", duration: "4 min", title: "Walk to a quiet café", detail: "Prepared venue · charging possible", state: "current" },
      { time: "+04", duration: "10 min", title: "Short phone recharge", detail: "Ask staff before using an outlet", state: "next" },
      { time: "+14", duration: "12 min", title: "Resume protected route", detail: "18 min ticket margin remains", state: "destination" },
    ],
  },
  medication: {
    eyebrow: "NOW CARE · MEDICATION REMINDER",
    title: "Take the pause you planned. We will protect the rest.",
    meta: "8 min pause · private reminder · route preserved",
    note: "NOW makes space for a user-created reminder. It does not provide medication instructions or medical advice.",
    totalMinutes: 8, marginMinutes: 22,
    stops: [
      { time: "NOW", duration: "3 min", title: "Move to a calm seated place", detail: "Privacy and water nearby", state: "current" },
      { time: "+03", duration: "5 min", title: "Personal reminder pause", detail: "Follow your own prescribed instructions", state: "next" },
      { time: "+08", duration: "12 min", title: "Resume protected route", detail: "Destination and ticket preserved", state: "destination" },
    ],
  },
  glucose: {
    eyebrow: "NOW CARE · PERSONAL HEALTH REMINDER",
    title: "A calm moment for the check you scheduled.",
    meta: "10 min pause · seated setting · route preserved",
    note: "NOW only provides a private reminder and time to pause. It does not interpret glucose readings or replace medical care.",
    totalMinutes: 10, marginMinutes: 20,
    stops: [
      { time: "NOW", duration: "3 min", title: "Find a calm seated place", detail: "Quiet café or prepared bench", state: "current" },
      { time: "+03", duration: "7 min", title: "Personal health check", detail: "Follow your own clinician-approved routine", state: "next" },
      { time: "+10", duration: "12 min", title: "Resume when ready", detail: "Route recalculated around your pause", state: "destination" },
    ],
  },
  guardian: {
    eyebrow: "NOW GUARDIAN",
    title: "Your route is paused. Help comes first.",
    meta: "Location ready · official help identified",
    note: "Guardian separates a travel disruption from a true emergency and keeps official services understandable.",
    totalMinutes: 0, marginMinutes: 0,
    stops: [
      { time: "NOW", duration: "Paused", title: "Stay where you feel safe", detail: "Paris NOW stops the itinerary", state: "warning" },
      { time: "01", duration: "Ready", title: "Medical emergency — SAMU", detail: "Call 15 · urgent medical help", state: "current" },
      { time: "02", duration: "Ready", title: "European emergency", detail: "Call 112 · police, fire or medical", state: "next" },
      { time: "03", duration: "Optional", title: "Contact your hotel", detail: "Only with your permission", state: "destination" },
    ],
  },
};

export function isNowScenario(value: unknown): value is NowScenario {
  return typeof value === "string" && validScenarios.includes(value as NowScenario);
}

export function buildRoutePlan(scenario: NowScenario, ticketTime = "16:30"): RoutePlan {
  const definition = definitions[scenario];
  const protectedTicket = scenario !== "guardian" && definition.marginMinutes >= 15;

  return {
    eyebrow: definition.eyebrow,
    title: definition.title,
    meta: definition.meta.replace(/16:30/g, ticketTime),
    note: definition.note,
    stops: definition.stops.map((stop) => ({
      ...stop,
      detail: stop.detail.replace(/16:30/g, ticketTime),
    })),
    ticket: {
      venue: "Musée du Louvre",
      time: ticketTime,
      entrance: "Carrousel du Louvre",
      marginMinutes: definition.marginMinutes,
      protected: protectedTicket,
    },
    calculation: {
      mode: "prepared",
      generatedAt: new Date().toISOString(),
      factors: ["walking time", "weather", "human need", "ticket margin", "entrance"],
    },
  };
}

export function buildConfidentialRoutePlan(routeId: string, ticketTime = "16:30", blockedStop?: string): RoutePlan | null {
  const route = getConfidentialRoutes().find((item) => item.id === routeId);
  if (!route) return null;
  const stops = route.stops.filter((stop) => !isUncoveredExclusive(stop.name)).map((stop, index) => {
    const impacted = Boolean(blockedStop && (stop.name === blockedStop || index === 1 && blockedStop === "__next__"));
    return {
      time: index === 0 ? "NOW" : "+" + String(Math.round(route.durationMinutes * index / route.stops.length)).padStart(2, "0"),
      duration: Math.round(route.durationMinutes / route.stops.length) + " min",
      title: impacted ? stop.alternative : stop.name,
      detail: impacted ? "Alternative selected · original stop unavailable" : stop.access === "opening-hours" ? "Check opening hours · alternative prepared" : "Confidential local address · public access",
      state: (index === route.stops.length - 1 ? "destination" : impacted ? "warning" : index === 0 ? "current" : "next") as "current" | "next" | "warning" | "destination",
    };
  });
  return {
    eyebrow: "CONFIDENTIAL ROUTE · " + route.zone.toUpperCase(),
    title: route.title,
    meta: route.durationMinutes + " min · " + stops.length + " confidential stops · protected arrival",
    note: blockedStop ? "An unavailable stop was replaced while preserving your protected arrival." : "A discreet, carefully prepared route with alternatives for closures and blocked streets.",
    stops,
    ticket: { venue: "Musée du Louvre", time: ticketTime, entrance: "Carrousel du Louvre", marginMinutes: 20, protected: true },
    calculation: { mode: "prepared", generatedAt: new Date().toISOString(), factors: ["confidential neighbourhood", "walking time", "opening hours", "alternative access", "ticket margin"] },
  };
}
