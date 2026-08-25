import { getPassAccess } from "../../../../lib/pass-access";
import { PARIS_TICKET_SEEDS, rankTicketCandidates } from "../../../../lib/ticket-intelligence";
import { revalidateViatorCandidates } from "../../../../lib/viator-provider";

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

  const provider = await revalidateViatorCandidates(PARIS_TICKET_SEEDS);
  const recommendations = rankTicketCandidates(provider.candidates, {
    availableMinutes,
    elapsedMinutes,
    protectedMarginMinutes,
    nextObligationInMinutes,
    maxSuggestions: 3,
  });

  const bookingReady = provider.mode === "production"
    && !provider.degraded
    && provider.verifiedCount >= 3
    && recommendations.length === 3;

  return Response.json({
    status: bookingReady ? "ready" : "degraded",
    bookingReady,
    requiredRecommendationCount: 3,
    recommendations: bookingReady ? recommendations : [],
    decision: bookingReady
      ? "NOW found three Viator offers that were revalidated against today's live product and availability schedule and still fit the protected route margin."
      : "NOW cannot currently prove three safe, live Viator offers, so it is not presenting a partial or unverified booking selection.",
    fallback: bookingReady
      ? null
      : "Keep the current route and use a no-ticket alternative until three offers can be revalidated.",
    providerHealth: {
      provider: "Viator Partner API",
      mode: provider.mode,
      configured: provider.configured,
      verifiedCount: provider.verifiedCount,
      degraded: provider.degraded,
      reason: provider.reason ?? null,
    },
    commercialModel: "Book only what fits; no bundle required.",
    availabilityMode: "Single-product Viator availability schedules are fetched at request time; sandbox data never becomes traveler-facing booking readiness.",
    priceMode: "Only provider-returned pricing may be surfaced. Promotions still require both current and original prices to be recently verified.",
    linkMode: "Exact Viator product deep links only; generic provider pages are rejected.",
    provider: "Viator Partner API + affiliate deep links",
    generatedAt: new Date().toISOString(),
  }, {
    headers: {
      "Cache-Control": "private, no-store",
      "X-NOW-Ticket-Mode": bookingReady ? "live-provider-verified-three" : "degraded-no-partial-offers",
      "X-NOW-Viator-Mode": provider.mode,
    },
  });
}
