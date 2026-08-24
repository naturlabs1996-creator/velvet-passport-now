import { verifyStripeWebhook } from "../../../../lib/stripe-now";
import { markStripeEventState } from "../../../../lib/stripe-entitlement";

export const runtime = "nodejs";

const RELEVANT_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "charge.refunded",
  "charge.dispute.created",
]);

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing Stripe signature" }, { status: 400 });

  const rawBody = await request.text();
  let event;
  try {
    event = verifyStripeWebhook(rawBody, signature);
  } catch (error) {
    console.error("NOW Stripe webhook verification failed", error);
    return Response.json({ error: "Invalid Stripe webhook" }, { status: 400 });
  }

  if (!RELEVANT_EVENTS.has(event.type)) {
    return Response.json({ received: true, ignored: true }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    await markStripeEventState(event);
    return Response.json({ received: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("NOW Stripe event persistence failed", error);
    return Response.json({ error: "Payment event persistence failed" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
