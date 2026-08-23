import { getPassAccess } from "../../../../lib/pass-access";

export const runtime = "nodejs";

type Mode = "metro" | "rer" | "bus" | "tram" | "taxi" | "walk";
type Coordinates = { lat: number; lon: number };

type ResolvedPlace = {
  label: string;
  coordinates: Coordinates | null;
  inParis: boolean;
};

const modes: Record<Mode, { label: string; minutes: number; detail: string }> = {
  metro: { label: "Métro", minutes: 18, detail: "Frequent connections · short final walk" },
  rer: { label: "RER", minutes: 22, detail: "Useful for longer cross-city connections" },
  bus: { label: "Bus", minutes: 27, detail: "Street-level journey · less station walking" },
  tram: { label: "Tramway", minutes: 31, detail: "Comfortable where the tram network connects" },
  taxi: { label: "Taxi", minutes: 19, detail: "Door-to-door · road traffic may vary" },
  walk: { label: "Walk", minutes: 35, detail: "A direct pedestrian connection when practical" },
};

const PARIS_BOUNDS = {
  minLat: 48.815,
  maxLat: 48.905,
  minLon: 2.224,
  maxLon: 2.470,
};

const PARIS_CENTRE: Coordinates = { lat: 48.8566, lon: 2.3522 };
const MAX_LOCAL_DISTANCE_KM = 18;

type PrimPlace = {
  id?: string;
  name?: string;
  embedded_type?: string;
  address?: {
    name?: string;
    label?: string;
    coord?: { lat?: string; lon?: string };
  };
  stop_area?: { name?: string; label?: string; coord?: { lat?: string; lon?: string } };
};
type PrimSection = {
  type?: string;
  duration?: number;
  display_informations?: { commercial_mode?: string; code?: string; direction?: string };
  from?: { name?: string };
  to?: { name?: string };
};
type PrimJourney = { duration?: number; nb_transfers?: number; sections?: PrimSection[] };

type BanFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    label?: string;
    city?: string;
    postcode?: string;
    context?: string;
  };
};

async function primRequest(path: string, token: string): Promise<unknown> {
  const response = await fetch("https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/" + path, {
    headers: { apikey: token, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error("Official transport provider unavailable");
  return response.json();
}

function parseCoordinates(value: string): Coordinates | null {
  const match = value.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lon = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

function isInsideParis(coords: Coordinates): boolean {
  return coords.lat >= PARIS_BOUNDS.minLat && coords.lat <= PARIS_BOUNDS.maxLat && coords.lon >= PARIS_BOUNDS.minLon && coords.lon <= PARIS_BOUNDS.maxLon;
}

function haversineKm(a: Coordinates, b: Coordinates): number {
  const toRad = (value: number) => value * Math.PI / 180;
  const earthKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function reverseGeocode(coords: Coordinates): Promise<ResolvedPlace> {
  try {
    const url = new URL("https://api-adresse.data.gouv.fr/reverse/");
    url.searchParams.set("lat", String(coords.lat));
    url.searchParams.set("lon", String(coords.lon));
    url.searchParams.set("limit", "1");
    const response = await fetch(url, { cache: "force-cache", signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("Reverse geocoding unavailable");
    const data = await response.json() as { features?: BanFeature[] };
    const feature = data.features?.[0];
    const label = feature?.properties?.label?.trim();
    const city = feature?.properties?.city?.toLowerCase() ?? "";
    const postcode = feature?.properties?.postcode ?? "";
    const inParis = city === "paris" || /^75\d{3}$/.test(postcode) || isInsideParis(coords);
    return { label: label || "Current location", coordinates: coords, inParis };
  } catch {
    return { label: "Current location", coordinates: coords, inParis: isInsideParis(coords) };
  }
}

async function forwardGeocode(query: string): Promise<ResolvedPlace | null> {
  try {
    const url = new URL("https://api-adresse.data.gouv.fr/search/");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "3");
    url.searchParams.set("lat", String(PARIS_CENTRE.lat));
    url.searchParams.set("lon", String(PARIS_CENTRE.lon));
    const response = await fetch(url, { cache: "force-cache", signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const data = await response.json() as { features?: BanFeature[] };
    const candidates = data.features ?? [];
    for (const feature of candidates) {
      const pair = feature.geometry?.coordinates;
      if (!pair) continue;
      const coordinates = { lon: Number(pair[0]), lat: Number(pair[1]) };
      if (!Number.isFinite(coordinates.lat) || !Number.isFinite(coordinates.lon)) continue;
      const city = feature.properties?.city?.toLowerCase() ?? "";
      const postcode = feature.properties?.postcode ?? "";
      const inParis = city === "paris" || /^75\d{3}$/.test(postcode) || isInsideParis(coordinates);
      if (inParis) return { label: feature.properties?.label || query, coordinates, inParis: true };
    }
    const first = candidates[0];
    const pair = first?.geometry?.coordinates;
    if (pair) {
      const coordinates = { lon: Number(pair[0]), lat: Number(pair[1]) };
      return { label: first.properties?.label || query, coordinates, inParis: isInsideParis(coordinates) };
    }
    return null;
  } catch {
    return null;
  }
}

async function resolveInput(value: string): Promise<ResolvedPlace | null> {
  const coords = parseCoordinates(value);
  if (coords) return reverseGeocode(coords);
  return forwardGeocode(value);
}

function primCoordinates(place: PrimPlace | undefined): Coordinates | null {
  const coord = place?.address?.coord ?? place?.stop_area?.coord;
  if (!coord?.lat || !coord?.lon) return null;
  const lat = Number(coord.lat);
  const lon = Number(coord.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

function primLabel(place: PrimPlace | undefined, fallback: string): string {
  return place?.address?.label || place?.stop_area?.label || place?.name || fallback;
}

function estimatedWalkMinutes(distanceKm: number): number {
  return Math.max(4, Math.round((distanceKm / 4.7) * 60));
}

function estimatedTaxiMinutes(distanceKm: number): number {
  return Math.max(6, Math.round(5 + (distanceKm / 18) * 60));
}

export async function POST(request: Request) {
  const access = await getPassAccess();
  if (!access.allowed) return Response.json({ error: "A valid Paris NOW Pass is required" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ error: "A starting point is required" }, { status: 400 });

  const input = body as Record<string, unknown>;
  const originInput = typeof input.origin === "string" ? input.origin.trim().slice(0, 160) : "";
  const destinationInput = typeof input.destination === "string" ? input.destination.trim().slice(0, 160) : "";
  const preferredMode = typeof input.mode === "string" && input.mode in modes ? input.mode as Mode : null;
  if (originInput.length < 3 || destinationInput.length < 2) {
    return Response.json({ error: "Enter your starting point and choose a destination." }, { status: 400 });
  }

  const [resolvedOrigin, resolvedDestination] = await Promise.all([
    resolveInput(originInput),
    resolveInput(destinationInput),
  ]);

  if (resolvedOrigin && !resolvedOrigin.inParis) {
    return Response.json({ error: "Your starting point appears to be outside Paris. Paris NOW currently prepares local Paris journeys only." }, { status: 422 });
  }
  if (resolvedDestination && !resolvedDestination.inParis) {
    return Response.json({ error: "That destination appears to be outside Paris. Choose a Paris destination for this route." }, { status: 422 });
  }

  if (resolvedOrigin?.coordinates && resolvedDestination?.coordinates) {
    const straightLineKm = haversineKm(resolvedOrigin.coordinates, resolvedDestination.coordinates);
    if (straightLineKm > MAX_LOCAL_DISTANCE_KM) {
      return Response.json({ error: "This journey is outside the local Paris NOW operating area." }, { status: 422 });
    }
  }

  const origin = resolvedOrigin?.label || originInput;
  const destination = resolvedDestination?.label || destinationInput;
  const token = process.env.IDFM_PRIM_API_KEY || process.env.PRIM_API_KEY;
  let liveJourney: { minutes: number; transfers: number; lines: string[]; departure: string; arrival: string } | null = null;
  let providerIssue = false;

  if (token && preferredMode !== "taxi" && preferredMode !== "walk") {
    try {
      const [fromResult, toResult] = await Promise.all([
        primRequest("places?q=" + encodeURIComponent(originInput + ", Paris") + "&count=3", token),
        primRequest("places?q=" + encodeURIComponent(destinationInput + ", Paris") + "&count=3", token),
      ]);
      const fromCandidates = (fromResult as { places?: PrimPlace[] }).places ?? [];
      const toCandidates = (toResult as { places?: PrimPlace[] }).places ?? [];
      const from = fromCandidates.find((place) => {
        const coords = primCoordinates(place);
        return !coords || isInsideParis(coords);
      });
      const to = toCandidates.find((place) => {
        const coords = primCoordinates(place);
        return !coords || isInsideParis(coords);
      });

      if (from?.id && to?.id) {
        const fromCoords = primCoordinates(from);
        const toCoords = primCoordinates(to);
        if (fromCoords && toCoords && haversineKm(fromCoords, toCoords) > MAX_LOCAL_DISTANCE_KM) {
          throw new Error("Journey outside Paris NOW area");
        }

        const data = await primRequest("journeys?from=" + encodeURIComponent(from.id) + "&to=" + encodeURIComponent(to.id) + "&count=3", token);
        const journeys = (data as { journeys?: PrimJourney[] }).journeys ?? [];
        const journey = journeys.find((candidate) => (candidate.duration ?? 0) > 0 && (candidate.duration ?? 0) <= 7200) ?? journeys[0];
        if (journey?.duration) {
          const publicSections = (journey.sections ?? []).filter((section) => section.type === "public_transport");
          liveJourney = {
            minutes: Math.max(1, Math.round(journey.duration / 60)),
            transfers: journey.nb_transfers ?? 0,
            lines: publicSections.map((section) => [section.display_informations?.commercial_mode, section.display_informations?.code].filter(Boolean).join(" ")).filter(Boolean),
            departure: primLabel(from, origin),
            arrival: primLabel(to, destination),
          };
        }
      }
    } catch {
      providerIssue = true;
    }
  }

  const distanceKm = resolvedOrigin?.coordinates && resolvedDestination?.coordinates
    ? haversineKm(resolvedOrigin.coordinates, resolvedDestination.coordinates)
    : null;

  const options = (Object.entries(modes) as [Mode, typeof modes[Mode]][]).map(([id, mode]) => {
    const live = Boolean(liveJourney && id !== "taxi" && id !== "walk" && (!preferredMode || preferredMode === id));
    let minutes = mode.minutes;
    let detail = mode.detail;
    let source: "official" | "estimated" = "estimated";
    let transfers: number | null = null;

    if (live && liveJourney) {
      minutes = liveJourney.minutes;
      detail = liveJourney.lines.join(" · ") || "Official Île-de-France Mobilités journey";
      source = "official";
      transfers = liveJourney.transfers;
    } else if (distanceKm !== null && id === "walk") {
      minutes = estimatedWalkMinutes(distanceKm);
      detail = distanceKm <= 3 ? `${distanceKm.toFixed(1)} km · direct pedestrian estimate` : `${distanceKm.toFixed(1)} km · walking is possible but not recommended for this connection`;
    } else if (distanceKm !== null && id === "taxi") {
      minutes = estimatedTaxiMinutes(distanceKm);
      detail = `${distanceKm.toFixed(1)} km · road estimate before live traffic`;
    }

    return { id, label: mode.label, minutes, detail, source, transfers };
  }).sort((a, b) => a.minutes - b.minutes);

  return Response.json({
    origin,
    destination,
    originCoordinates: resolvedOrigin?.coordinates ?? null,
    destinationCoordinates: resolvedDestination?.coordinates ?? null,
    options,
    provider: {
      name: "Île-de-France Mobilités · PRIM",
      connected: Boolean(token),
      live: Boolean(liveJourney),
      issue: providerIssue,
    },
    geocoding: { source: "Base Adresse Nationale", originResolved: Boolean(resolvedOrigin), destinationResolved: Boolean(resolvedDestination) },
    disclaimer: liveJourney
      ? "Public transport data supplied by Île-de-France Mobilités. Walking and taxi times remain estimates."
      : "Paris-local planning only. Walking and taxi times are estimated; live public transport requires an available PRIM response.",
  }, { headers: { "Cache-Control": "no-store" } });
}
