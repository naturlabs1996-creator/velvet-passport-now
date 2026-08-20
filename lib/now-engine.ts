export type NowScenario = "route" | "rain" | "blocked" | "food" | "water" | "restroom" | "energy" | "guardian";

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

const validScenarios: NowScenario[] = ["route", "rain", "blocked", "food", "water", "restroom", "energy", "guardian"];

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
