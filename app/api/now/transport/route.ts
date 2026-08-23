import { getPassAccess } from "../../../../lib/pass-access";

export const runtime = "nodejs";

type Mode = "metro" | "rer" | "bus" | "tram" | "taxi" | "walk";

const modes: Record<Mode, { label: string; minutes: number; detail: string }> = {
  metro: { label: "Métro", minutes: 18, detail: "Frequent connections · short final walk" },
  rer: { label: "RER", minutes: 22, detail: "Useful for longer cross-city connections" },
  bus: { label: "Bus", minutes: 27, detail: "Street-level journey · less station walking" },
  tram: { label: "Tramway", minutes: 31, detail: "Comfortable where the tram network connects" },
  taxi: { label: "Taxi", minutes: 19, detail: "Door-to-door · road traffic may vary" },
  walk: { label: "Walk", minutes: 35, detail: "A direct pedestrian connection when practical" },
};

type PrimPlace = { id?: string; name?: string };
type PrimSection = { type?: string; duration?: number; display_informations?: { commercial_mode?: string; code?: string; direction?: string }; from?: { name?: string }; to?: { name?: string } };
type PrimJourney = { duration?: number; nb_transfers?: number; sections?: PrimSection[] };

async function primRequest(path: string, token: string): Promise<unknown> {
  const response = await fetch("https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/" + path, {
    headers: { apikey: token, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error("Official transport provider unavailable");
  return response.json();
}

export async function POST(request: Request) {
  const access = await getPassAccess();
  if (!access.allowed) return Response.json({ error: "A valid Paris NOW Pass is required" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ error: "A starting point is required" }, { status: 400 });

  const input = body as Record<string, unknown>;
  const origin = typeof input.origin === "string" ? input.origin.trim().slice(0, 140) : "";
  const destination = typeof input.destination === "string" ? input.destination.trim().slice(0, 140) : "";
  const preferredMode = typeof input.mode === "string" && input.mode in modes ? input.mode as Mode : null;
  if (origin.length < 3 || destination.length < 2) return Response.json({ error: "Enter your starting point and choose a destination." }, { status: 400 });

  const token = process.env.IDFM_PRIM_API_KEY || process.env.PRIM_API_KEY;
  let liveJourney: { minutes: number; transfers: number; lines: string[]; departure: string; arrival: string } | null = null;
  let providerIssue = false;

  if (token && preferredMode !== "taxi" && preferredMode !== "walk") {
    try {
      const [fromResult, toResult] = await Promise.all([
        primRequest("places?q=" + encodeURIComponent(origin + ", Paris") + "&count=1", token),
        primRequest("places?q=" + encodeURIComponent(destination + ", Paris") + "&count=1", token),
      ]);
      const from = (fromResult as { places?: PrimPlace[] }).places?.[0];
      const to = (toResult as { places?: PrimPlace[] }).places?.[0];
      if (from?.id && to?.id) {
        const data = await primRequest("journeys?from=" + encodeURIComponent(from.id) + "&to=" + encodeURIComponent(to.id) + "&count=3", token);
        const journey = (data as { journeys?: PrimJourney[] }).journeys?.[0];
        if (journey?.duration) {
          const publicSections = (journey.sections ?? []).filter((section) => section.type === "public_transport");
          liveJourney = {
            minutes: Math.max(1, Math.round(journey.duration / 60)),
            transfers: journey.nb_transfers ?? 0,
            lines: publicSections.map((section) => [section.display_informations?.commercial_mode, section.display_informations?.code].filter(Boolean).join(" ")),
            departure: from.name ?? origin,
            arrival: to.name ?? destination,
          };
        }
      }
    } catch { providerIssue = true; }
  }

  const options = (Object.entries(modes) as [Mode, typeof modes[Mode]][]).map(([id, mode]) => {
    const live = Boolean(liveJourney && id !== "taxi" && id !== "walk" && (!preferredMode || preferredMode === id));
    return {
      id,
      label: mode.label,
      minutes: live && liveJourney ? liveJourney.minutes : mode.minutes,
      detail: live && liveJourney ? (liveJourney.lines.join(" · ") || "Official Île-de-France Mobilités journey") : mode.detail,
      source: live ? "official" : "estimated",
      transfers: live && liveJourney ? liveJourney.transfers : null,
    };
  }).sort((a, b) => a.minutes - b.minutes);

  return Response.json({
    origin,
    destination,
    options,
    provider: { name: "Île-de-France Mobilités · PRIM", connected: Boolean(token), live: Boolean(liveJourney), issue: providerIssue },
    disclaimer: liveJourney ? "Public transport data supplied by Île-de-France Mobilités. Taxi estimates are not live." : "Indicative planning only. Official live departures and disruption checks require a PRIM API key.",
  }, { headers: { "Cache-Control": "no-store" } });
}
