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

  const priceChanges = provider.diagnostics.filter((item) => item.state === "price_changed");
  const removedOffers = provider.diagnostics.filter((item) => ["product_unavailable", "slot_unavailable", "invalid_product"].includes(item.state));
  const providerFailures = provider.diagnostics.filter((item) => item.state === "provider_unavailable");

  const travelerFallback = bookingReady
    ? null
    : providerFailures.length
      ? "Ticket availability is temporarily unavailable. Your current route remains valid; NOW will keep the no-ticket version rather than guess."
      : removedOffers.length
        ? "One or more ticketed options changed or disappeared. NOW removed them and kept your route safe without forcing a replacement."
        : "NOW does not currently have three verified offers that fit safely, so it is keeping the no-ticket route instead of showing a partial selection.";

  return Response.json({
    status: bookingReady ? "ready" : "degraded",
    bookingReady,
    requiredRecommendationCount: 3,
    recommendations: bookingReady ? recommendations : [],
    decision: bookingReady
      ? "NOW found three Viator offers whose product status and today's availability schedule were freshly revalidated and that still fit the protected route margin."
      : "NOW cannot currently prove three safe, freshly revalidated Viator offers, so it is not presenting a partial or unverified booking selection.",
    fallback: travelerFallback,
    fallbackState: {
      priceChanged: priceChanges.length > 0,
      removedOfferCount: removedOffers.length,
      providerUnavailable: providerFailures.length > 0,
      routePreserved: true,
      staleEvidenceDiscarded: provider.diagnostics.some((item) => item.state !== "verified"),
    },
    providerHealth: {
      provider: "Viator Partner API",
      mode: provider.mode,
      configured: provider.configured,
      verifiedCount: provider.verifiedCount,
      degraded: provider.degraded,
      reason: provider.reason ?? null,
      diagnostics: provider.diagnostics,
    },
    commercialModel: "Book only what fits; no bundle required.",
    availabilityMode: "Single-product Viator availability schedules are fetched at request time; stale evidence is discarded whenever revalidation fails.",
    finalCheckoutVerification: "Availability and price can still change after recommendation. Viator performs the final booking-side verification; if NOW later books directly, it must call /availability/check immediately before booking.",
    priceMode: "If the provider price changes, NOW discards the previous amount immediately and surfaces only the freshly revalidated amount. A promotion is never inferred from a price change alone.",
    linkMode: "Exact Viator product deep links only; generic provider pages are rejected.",
    provider: "Viator Partner API + affiliate deep links",
    generatedAt: new Date().toISOString(),
  }, {
    headers: {
      "Cache-Control": "private, no-store",
      "X-NOW-Ticket-Mode": bookingReady ? "schedule-revalidated-three" : "degraded-fallback-active",
      "X-NOW-Viator-Mode": provider.mode,
    },
  });
}
