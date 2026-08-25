import { getPassAccess } from "../../../../lib/pass-access";
import { PARIS_TICKET_SEEDS, rankTicketCandidates } from "../../../../lib/ticket-intelligence";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const access = await getPassAccess();
  if (!access.allowed) {
    return Response.json({ error: "A valid Paris NOW Pass is required" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const availableMinutes = Math.max(15, Math.min(480, Number(body.availableMinutes) || 90));
  const elapsedMinutes = Math.max(0, Math.min(480, Number(body.elapsedMinutes) || 0));
  const protectedMarginMinutes = Math.max(10, Math.min(90, Number(body.protectedMarginMinutes) || 15));
  const nextObligationRaw = Number(body.nextObligationInMinutes);
  const nextObligationInMinutes = Number.isFinite(nextObligationRaw)
    ? Math.max(0, Math.min(480, nextObligationRaw))
    : undefined;

  const recommendations = rankTicketCandidates(PARIS_TICKET_SEEDS, {
    availableMinutes,
    elapsedMinutes,
    protectedMarginMinutes,
    nextObligationInMinutes,
    maxSuggestions: 3,
  });

  const bookingReady = recommendations.length === 3;

  return Response.json({
    status: bookingReady ? "ready" : "degraded",
    bookingReady,
    requiredRecommendationCount: 3,
    recommendations,
    decision: bookingReady
      ? "NOW found three live-verified ticketed experiences that fit without sacrificing the protected schedule margin."
      : "NOW does not have three live-verified offers that fit safely right now, so it is not presenting a partial booking selection.",
    fallback: bookingReady
      ? null
      : "Keep the current route and use a no-ticket alternative until three bookable offers can be revalidated.",
    commercialModel: "Book only what fits; no bundle required.",
    availabilityMode: "Every recommendation must have availability verified within the last 15 minutes before it is shown as bookable.",
    priceMode: "A promotion is shown only when a current price and original price were recently verified from an approved Viator data source.",
    linkMode: "Exact Viator product deep links only; generic provider pages are rejected.",
    provider: "Viator affiliate deep links",
    generatedAt: new Date().toISOString(),
  }, {
    headers: {
      "Cache-Control": "private, no-store",
      "X-NOW-Ticket-Mode": bookingReady ? "live-verified-three" : "degraded-no-partial-offers",
    },
  });
}
