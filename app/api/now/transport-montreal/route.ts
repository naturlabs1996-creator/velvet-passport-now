import { getPassAccess } from "../../../../lib/pass-access";
import { planMontrealTransport, type MontrealCoordinates } from "../../../../lib/montreal-transport-planner";

export const runtime = "nodejs";

function coordinates(value: unknown): MontrealCoordinates | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const lat = Number(raw.lat);
  const lon = Number(raw.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

export async function POST(request: Request) {
  const access = await getPassAccess();
  if (!access.allowed) {
    return Response.json({ error: "A valid NOW Pass is required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ error: "Origin and destination coordinates are required" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const origin = coordinates(input.originCoordinates ?? input.origin);
  const destination = coordinates(input.destinationCoordinates ?? input.destination);

  if (!origin || !destination) {
    return Response.json({ error: "Valid Montréal origin and destination coordinates are required" }, { status: 400 });
  }

  const result = await planMontrealTransport(origin, destination);
  if (!result.ok) {
    return Response.json(result, { status: 422, headers: { "Cache-Control": "no-store" } });
  }

  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
