import { getPassAccess } from "../../../../../lib/pass-access";
import { getNowFilm } from "../../../../../lib/now-films";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ routeId: string }> },
) {
  const access = await getPassAccess();
  if (!access.allowed) {
    return Response.json({ error: "Active NOW Pass required" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  }
  const { routeId } = await context.params;
  const film = getNowFilm(routeId);
  if (!film) {
    return Response.json({ error: "Unknown film" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
  if (!film.ready) {
    return Response.json(
      { routeId: film.id, state: "PRODUCTION_HOLD", playable: false },
      { status: 423, headers: { "Cache-Control": "private, no-store", "X-NOW-Film": "hold" } },
    );
  }
  return Response.json(
    { routeId: film.id, state: film.state, playable: true, chapters: film.chapters, durationSeconds: film.durationSeconds, media: film.media, subtitles: film.subtitles },
    { headers: { "Cache-Control": "private, no-store", "X-NOW-Film": "ready" } },
  );
}
