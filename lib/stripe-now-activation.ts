import { isNowPassPlan, planDurationMs, retrieveCheckoutSession } from "./stripe-now";

const EXPECTED_AMOUNTS = { "72h": 1490, "7d": 2290 } as const;

type ActivationResult =
  | { ready: true; sessionId: string; plan: "72h" | "7d"; activatedAt: number; expiresAt: number }
  | { ready: false; retryable: boolean; reason: string };

function stripeSecret() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return key;
}

function paymentIntentFrom(session: Awaited<ReturnType<typeof retrieveCheckoutSession>>) {
  return session.payment_intent && typeof session.payment_intent === "object" ? session.payment_intent : null;
}

function validateSession(session: Awaited<ReturnType<typeof retrieveCheckoutSession>>) {
  const metadata = session.metadata ?? {};
  const plan = metadata.pass_duration;
  if (metadata.product_family !== "velvet_passport" || metadata.product !== "paris_now" || !isNowPassPlan(plan)) {
    return { valid: false as const, reason: "not-paris-now" };
  }
  if (session.payment_status !== "paid" || session.status !== "complete") {
    return { valid: false as const, reason: "payment-not-complete" };
  }
  if (session.currency?.toLowerCase() !== "eur" || session.amount_total !== EXPECTED_AMOUNTS[plan]) {
    return { valid: false as const, reason: "amount-mismatch" };
  }
  return { valid: true as const, plan };
}

export async function verifyPurchasedNowSession(sessionId: string) {
  const session = await retrieveCheckoutSession(sessionId, true);
  const validated = validateSession(session);
  if (!validated.valid) return validated;
  return { valid: true as const, plan: validated.plan, sessionId: session.id };
}

async function updatePaymentIntentActivation(paymentIntentId: string, activatedAt: number, expiresAt: number, sessionId: string) {
  const params = new URLSearchParams();
  params.set("metadata[now_activated_at]", String(activatedAt));
  params.set("metadata[now_expires_at]", String(expiresAt));
  params.set("metadata[now_activation_session]", sessionId);

  const response = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecret()}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `now-activate-${sessionId}`,
    },
    body: params,
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    const error = payload.error && typeof payload.error === "object" ? payload.error as Record<string, unknown> : null;
    throw new Error(typeof error?.message === "string" ? error.message : `Stripe activation update failed (${response.status})`);
  }
}

export async function activateStripeNowSession(sessionId: string): Promise<ActivationResult> {
  const session = await retrieveCheckoutSession(sessionId, true);
  const validated = validateSession(session);
  if (!validated.valid) {
    return { ready: false, retryable: validated.reason === "payment-not-complete", reason: validated.reason };
  }

  const paymentIntent = paymentIntentFrom(session);
  if (!paymentIntent) return { ready: false, retryable: true, reason: "payment-intent-not-expanded" };
  const intentMetadata = paymentIntent.metadata ?? {};
  if (intentMetadata.product_family !== "velvet_passport" || intentMetadata.product !== "paris_now") {
    return { ready: false, retryable: false, reason: "payment-intent-metadata-mismatch" };
  }
  if (intentMetadata.now_access_state !== "active") {
    return { ready: false, retryable: intentMetadata.now_access_state === "pending", reason: `access-${intentMetadata.now_access_state || "unknown"}` };
  }

  const previousActivatedAt = Number(intentMetadata.now_activated_at);
  const previousExpiresAt = Number(intentMetadata.now_expires_at);
  if (Number.isFinite(previousActivatedAt) && Number.isFinite(previousExpiresAt) && previousExpiresAt > previousActivatedAt) {
    return {
      ready: true,
      sessionId: session.id,
      plan: validated.plan,
      activatedAt: previousActivatedAt,
      expiresAt: previousExpiresAt,
    };
  }

  const activatedAt = Date.now();
  const expiresAt = activatedAt + planDurationMs(validated.plan);
  await updatePaymentIntentActivation(paymentIntent.id, activatedAt, expiresAt, session.id);
  return { ready: true, sessionId: session.id, plan: validated.plan, activatedAt, expiresAt };
}
