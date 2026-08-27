import { isNowPassPlan, planDurationMs } from "./stripe-now";

const EXPECTED_AMOUNTS = { "72h": 1490, "7d": 2290 } as const;
const cache = new Map<string, { active: false; checkedAt: number }>();
const INACTIVE_CACHE_MS = 2 * 60 * 1000;
const STATE_RANK: Record<string, number> = { pending: 0, active: 1, revoked: 2 };

function secret() {
  const value = process.env.STRIPE_SECRET_KEY;
  if (!value) throw new Error("STRIPE_SECRET_KEY is not configured");
  return value;
}

async function stripe(path: string, init?: RequestInit): Promise<any> {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret()}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `Stripe request failed (${response.status})`);
  return payload;
}

async function session(sessionId: string) {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) throw new Error("Invalid Stripe Checkout Session id");
  return stripe(`/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=payment_intent`);
}

function validatePaidSession(value: any) {
  const meta = value?.metadata || {};
  const plan = meta.pass_duration;
  if (meta.product_family !== "velvet_passport" || meta.product !== "paris_now" || !isNowPassPlan(plan)) return { valid: false as const, reason: "not-paris-now" };
  if (value?.payment_status !== "paid" || value?.status !== "complete") return { valid: false as const, reason: "payment-not-complete" };
  if (String(value?.currency || "").toLowerCase() !== "eur" || value?.amount_total !== EXPECTED_AMOUNTS[plan]) return { valid: false as const, reason: "amount-mismatch" };
  return { valid: true as const, plan };
}

async function updateIntent(paymentIntentId: string, params: URLSearchParams, idempotencyKey: string) {
  await stripe(`/payment_intents/${encodeURIComponent(paymentIntentId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": idempotencyKey },
    body: params,
  });
}

async function paymentIntentIdForEvent(event: any) {
  const object = event?.data?.object || {};
  if (typeof object.payment_intent === "string" && object.payment_intent.startsWith("pi_")) return object.payment_intent;
  if (object.payment_intent?.id?.startsWith?.("pi_")) return object.payment_intent.id;
  if (typeof object.id === "string" && object.id.startsWith("cs_")) {
    const checkout = await session(object.id);
    if (typeof checkout.payment_intent === "string") return checkout.payment_intent;
    if (checkout.payment_intent?.id) return checkout.payment_intent.id;
  }
  const chargeId = typeof object.charge === "string" ? object.charge : object.charge?.id;
  if (typeof chargeId === "string" && chargeId.startsWith("ch_")) {
    const charge = await stripe(`/charges/${encodeURIComponent(chargeId)}`);
    if (typeof charge.payment_intent === "string") return charge.payment_intent;
  }
  return null;
}

function eventState(event: any) {
  if (event.type === "checkout.session.completed" && event?.data?.object?.payment_status === "paid") return "active";
  if (event.type === "checkout.session.async_payment_succeeded") return "active";
  if (["checkout.session.async_payment_failed", "charge.refunded", "charge.dispute.created"].includes(event.type)) return "revoked";
  return "pending";
}

export async function markStripeEventState(event: any) {
  const paymentIntentId = await paymentIntentIdForEvent(event);
  if (!paymentIntentId) {
    if (event?.type === "checkout.session.expired") return { recorded: true, skipped: true } as const;
    throw new Error("Relevant Stripe event has no PaymentIntent");
  }

  const state = eventState(event);
  const currentIntent = await stripe(`/payment_intents/${encodeURIComponent(paymentIntentId)}`);
  const currentMetadata = currentIntent?.metadata || {};
  const previousState = typeof currentMetadata.now_access_state === "string" ? currentMetadata.now_access_state : "pending";
  const previousCreated = Number(currentMetadata.now_state_event_created);
  const incomingCreated = Number(event?.created);

  // Revocation is terminal for the events handled here. A delayed completion or
  // success event must never restore access after a refund, dispute or async failure.
  if (previousState === "revoked" && state !== "revoked") {
    return { recorded: true, skipped: true, state: previousState, reason: "revocation-is-terminal" } as const;
  }

  if (Number.isFinite(previousCreated) && Number.isFinite(incomingCreated)) {
    if (incomingCreated < previousCreated) {
      return { recorded: true, skipped: true, state: previousState, reason: "stale-event" } as const;
    }
    if (incomingCreated === previousCreated && (STATE_RANK[state] ?? 0) < (STATE_RANK[previousState] ?? 0)) {
      return { recorded: true, skipped: true, state: previousState, reason: "lower-priority-same-time-event" } as const;
    }
  }

  const params = new URLSearchParams();
  params.set("metadata[now_access_state]", state);
  params.set("metadata[now_state_event_id]", String(event.id));
  params.set("metadata[now_state_event_type]", String(event.type));
  params.set("metadata[now_state_event_created]", Number.isFinite(incomingCreated) ? String(incomingCreated) : String(Math.floor(Date.now() / 1000)));
  params.set("metadata[now_state_updated_at]", new Date().toISOString());
  await updateIntent(paymentIntentId, params, `now-state-${event.id}`);
  cache.clear();
  return { recorded: true, state } as const;
}

export async function verifyPurchasedNowSession(sessionId: string) {
  const checkout = await session(sessionId);
  const validated = validatePaidSession(checkout);
  if (!validated.valid) return validated;
  return {
    valid: true as const,
    plan: validated.plan,
    sessionId: checkout.id,
    activationNonceHash: typeof checkout?.metadata?.activation_nonce_hash === "string" ? checkout.metadata.activation_nonce_hash : null,
  };
}

export async function activateStripeNowSession(sessionId: string) {
  const checkout = await session(sessionId);
  const validated = validatePaidSession(checkout);
  if (!validated.valid) return { ready: false as const, retryable: validated.reason === "payment-not-complete", reason: validated.reason };

  const intent = typeof checkout.payment_intent === "object" ? checkout.payment_intent : null;
  const metadata = intent?.metadata || {};
  if (!intent?.id) return { ready: false as const, retryable: true, reason: "payment-intent-unavailable" };
  if (metadata.product_family !== "velvet_passport" || metadata.product !== "paris_now") return { ready: false as const, retryable: false, reason: "payment-intent-metadata-mismatch" };
  if (metadata.now_access_state !== "active") return { ready: false as const, retryable: metadata.now_access_state === "pending", reason: `access-${metadata.now_access_state || "unknown"}` };

  const previousActivatedAt = Number(metadata.now_activated_at);
  const previousExpiresAt = Number(metadata.now_expires_at);
  if (
    Number.isFinite(previousActivatedAt)
    && Number.isFinite(previousExpiresAt)
    && previousExpiresAt > previousActivatedAt
    && previousExpiresAt > Date.now()
  ) {
    return { ready: true as const, sessionId: checkout.id, plan: validated.plan, activatedAt: previousActivatedAt, expiresAt: previousExpiresAt };
  }
  if (Number.isFinite(previousExpiresAt) && previousExpiresAt <= Date.now()) {
    return { ready: false as const, retryable: false, reason: "access-expired" };
  }

  const activatedAt = Date.now();
  const expiresAt = activatedAt + planDurationMs(validated.plan);
  const params = new URLSearchParams();
  params.set("metadata[now_activated_at]", String(activatedAt));
  params.set("metadata[now_expires_at]", String(expiresAt));
  params.set("metadata[now_activation_session]", checkout.id);
  await updateIntent(intent.id, params, `now-activate-${checkout.id}`);
  cache.clear();
  return { ready: true as const, sessionId: checkout.id, plan: validated.plan, activatedAt, expiresAt };
}

export async function isStripePassEntitlementActive(sessionId: string) {
  const now = Date.now();
  const cached = cache.get(sessionId);
  if (cached && now - cached.checkedAt < INACTIVE_CACHE_MS) return false;

  // Positive access is never trusted from process-local memory. Serverless
  // instances do not share caches, so a refund/dispute handled by another
  // instance could otherwise leave a short stale-access window. Active Passes
  // are therefore revalidated against Stripe on every entitlement check.
  const checkout = await session(sessionId);
  const validated = validatePaidSession(checkout);
  const intent = typeof checkout.payment_intent === "object" ? checkout.payment_intent : null;
  const activatedAt = Number(intent?.metadata?.now_activated_at);
  const expiresAt = Number(intent?.metadata?.now_expires_at);
  const active = Boolean(
    validated.valid
    && intent?.metadata?.now_access_state === "active"
    && Number.isFinite(activatedAt)
    && Number.isFinite(expiresAt)
    && expiresAt > activatedAt
    && expiresAt > now
  );

  if (!active) cache.set(sessionId, { active: false, checkedAt: now });
  else cache.delete(sessionId);
  return active;
}