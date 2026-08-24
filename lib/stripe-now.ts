import { createHmac, timingSafeEqual } from "node:crypto";

export type NowPassPlan = "72h" | "7d";
export type NowSalesChannel = "direct" | "hotel" | "affiliate";

export type NowCheckoutInput = {
  plan: NowPassPlan;
  channel: NowSalesChannel;
  partnerId?: string;
  commissionScheme?: string;
  origin: string;
};

type StripePaymentIntent = {
  id: string;
  status?: string;
  metadata?: Record<string, string> | null;
};

type StripeCheckoutSession = {
  id: string;
  url?: string | null;
  payment_status?: string;
  status?: string;
  amount_total?: number | null;
  currency?: string | null;
  metadata?: Record<string, string> | null;
  payment_intent?: string | StripePaymentIntent | null;
};

type StripeCharge = {
  id: string;
  payment_intent?: string | null;
  refunded?: boolean;
};

type StripeDispute = {
  id: string;
  payment_intent?: string | null;
  charge?: string | StripeCharge | null;
};

type StripeObject = StripeCheckoutSession | StripeCharge | StripeDispute | Record<string, unknown>;

export type StripeEvent = {
  id: string;
  type: string;
  created?: number;
  data?: { object?: StripeObject };
};

const PLAN_CONFIG: Record<NowPassPlan, { amount: number; durationMs: number; priceEnv: string; name: string }> = {
  "72h": { amount: 1490, durationMs: 72 * 60 * 60 * 1000, priceEnv: "STRIPE_PRICE_PARIS_NOW_72H", name: "Paris NOW · 72-hour Pass" },
  "7d": { amount: 2290, durationMs: 7 * 24 * 60 * 60 * 1000, priceEnv: "STRIPE_PRICE_PARIS_NOW_7D", name: "Paris NOW · 7-day Pass" },
};

const entitlementCache = new Map<string, { active: boolean; checkedAt: number }>();
const ENTITLEMENT_CACHE_MS = 2 * 60 * 1000;

function stripeSecret() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return key;
}

async function stripeRequest(path: string, init?: RequestInit) {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${stripeSecret()}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    const error = payload.error && typeof payload.error === "object" ? payload.error as Record<string, unknown> : null;
    throw new Error(typeof error?.message === "string" ? error.message : `Stripe request failed (${response.status})`);
  }
  return payload;
}

export function isNowPassPlan(value: unknown): value is NowPassPlan {
  return value === "72h" || value === "7d";
}

export function isNowSalesChannel(value: unknown): value is NowSalesChannel {
  return value === "direct" || value === "hotel" || value === "affiliate";
}

export function planDurationMs(plan: NowPassPlan) {
  return PLAN_CONFIG[plan].durationMs;
}

function addCheckoutPrice(params: URLSearchParams, plan: NowPassPlan) {
  const config = PLAN_CONFIG[plan];
  const reusablePrice = process.env[config.priceEnv]?.trim();
  if (reusablePrice) {
    params.set("line_items[0][price]", reusablePrice);
  } else {
    params.set("line_items[0][price_data][currency]", "eur");
    params.set("line_items[0][price_data][unit_amount]", String(config.amount));
    params.set("line_items[0][price_data][product_data][name]", config.name);
    params.set("line_items[0][price_data][product_data][metadata][product_family]", "velvet_passport");
    params.set("line_items[0][price_data][product_data][metadata][product]", "paris_now");
    params.set("line_items[0][price_data][product_data][metadata][pass_duration]", plan);
  }
  params.set("line_items[0][quantity]", "1");
}

export async function createNowCheckoutSession(input: NowCheckoutInput) {
  const config = PLAN_CONFIG[input.plan];
  const channelCommissionable = input.channel !== "direct";
  const partnerId = (input.partnerId || "").trim().slice(0, 120);
  const commissionScheme = (input.commissionScheme || (channelCommissionable ? "partner-default" : "none")).trim().slice(0, 120);

  const params = new URLSearchParams();
  params.set("mode", "payment");
  addCheckoutPrice(params, input.plan);
  params.set("success_url", `${input.origin}/api/now/complete-checkout?session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${input.origin}/?checkout=cancelled`);
  params.set("client_reference_id", `paris-now-${input.plan}-${Date.now()}`);
  params.set("metadata[product_family]", "velvet_passport");
  params.set("metadata[product]", "paris_now");
  params.set("metadata[pass_duration]", input.plan);
  params.set("metadata[channel]", input.channel);
  params.set("metadata[partner_id]", partnerId);
  params.set("metadata[commission_scheme]", commissionScheme);
  params.set("metadata[commissionable_amount]", channelCommissionable ? String(config.amount) : "0");
  params.set("metadata[non_commissionable_amount]", channelCommissionable ? "0" : String(config.amount));
  params.set("metadata[currency]", "eur");
  params.set("payment_intent_data[metadata][product_family]", "velvet_passport");
  params.set("payment_intent_data[metadata][product]", "paris_now");
  params.set("payment_intent_data[metadata][pass_duration]", input.plan);
  params.set("payment_intent_data[metadata][channel]", input.channel);
  params.set("payment_intent_data[metadata][partner_id]", partnerId);
  params.set("payment_intent_data[metadata][commission_scheme]", commissionScheme);
  params.set("payment_intent_data[metadata][commissionable_amount]", channelCommissionable ? String(config.amount) : "0");
  params.set("payment_intent_data[metadata][non_commissionable_amount]", channelCommissionable ? "0" : String(config.amount));
  params.set("payment_intent_data[metadata][now_access_state]", "pending");

  const payload = await stripeRequest("/checkout/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const session = payload as unknown as StripeCheckoutSession;
  if (!session.id || !session.url) throw new Error("Stripe did not return a usable Checkout Session");
  return session;
}

export async function retrieveCheckoutSession(sessionId: string, expandPaymentIntent = false) {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) throw new Error("Invalid Stripe Checkout Session id");
  const query = expandPaymentIntent ? "?expand[]=payment_intent" : "";
  const payload = await stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}${query}`);
  return payload as unknown as StripeCheckoutSession;
}

function parseStripeSignature(header: string) {
  const parts = header.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  return { timestamp: timestamp ? Number(timestamp) : NaN, signatures };
}

export function verifyStripeWebhook(rawBody: string, signatureHeader: string, toleranceSeconds = 300): StripeEvent {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  const { timestamp, signatures } = parseStripeSignature(signatureHeader);
  if (!Number.isFinite(timestamp) || signatures.length === 0) throw new Error("Invalid Stripe signature header");
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > toleranceSeconds) throw new Error("Stale Stripe webhook signature");

  const expected = createHmac("sha256", webhookSecret).update(`${timestamp}.${rawBody}`).digest("hex");
  const valid = signatures.some((signature) => {
    const supplied = Buffer.from(signature, "utf8");
    const wanted = Buffer.from(expected, "utf8");
    return supplied.length === wanted.length && timingSafeEqual(supplied, wanted);
  });
  if (!valid) throw new Error("Stripe webhook signature verification failed");

  const event = JSON.parse(rawBody) as StripeEvent;
  if (!event.id || !event.type) throw new Error("Malformed Stripe webhook event");
  return event;
}

function objectValue(object: StripeObject | undefined, key: string) {
  if (!object || typeof object !== "object") return undefined;
  return (object as Record<string, unknown>)[key];
}

async function resolvePaymentIntentId(event: StripeEvent) {
  const object = event.data?.object;
  const direct = objectValue(object, "payment_intent");
  if (typeof direct === "string" && direct.startsWith("pi_")) return direct;
  if (direct && typeof direct === "object") {
    const id = (direct as Record<string, unknown>).id;
    if (typeof id === "string" && id.startsWith("pi_")) return id;
  }

  const objectId = objectValue(object, "id");
  if (typeof objectId === "string" && objectId.startsWith("cs_")) {
    const session = await retrieveCheckoutSession(objectId, true);
    if (typeof session.payment_intent === "string") return session.payment_intent;
    if (session.payment_intent && typeof session.payment_intent === "object") return session.payment_intent.id;
  }

  const charge = objectValue(object, "charge");
  const chargeId = typeof charge === "string" ? charge : charge && typeof charge === "object" ? (charge as Record<string, unknown>).id : null;
  if (typeof chargeId === "string" && chargeId.startsWith("ch_")) {
    const payload = await stripeRequest(`/charges/${encodeURIComponent(chargeId)}`);
    const paymentIntent = payload.payment_intent;
    if (typeof paymentIntent === "string" && paymentIntent.startsWith("pi_")) return paymentIntent;
  }
  return null;
}

function desiredAccessState(event: StripeEvent) {
  if (event.type === "checkout.session.completed") {
    const paymentStatus = objectValue(event.data?.object, "payment_status");
    return paymentStatus === "paid" ? "active" : "pending";
  }
  if (event.type === "checkout.session.async_payment_succeeded") return "active";
  if (["checkout.session.async_payment_failed", "checkout.session.expired", "charge.refunded", "charge.dispute.created"].includes(event.type)) return "revoked";
  return "pending";
}

export async function recordRevenueEvent(event: StripeEvent) {
  const paymentIntentId = await resolvePaymentIntentId(event);
  if (!paymentIntentId) {
    if (event.type === "checkout.session.expired") return { recorded: true, skipped: true } as const;
    throw new Error(`Stripe event ${event.id} has no payment intent`);
  }

  const accessState = desiredAccessState(event);
  const params = new URLSearchParams();
  params.set("metadata[now_access_state]", accessState);
  params.set("metadata[now_state_event_id]", event.id);
  params.set("metadata[now_state_event_type]", event.type);
  params.set("metadata[now_state_updated_at]", new Date().toISOString());

  await stripeRequest(`/payment_intents/${encodeURIComponent(paymentIntentId)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `now-${event.id}`,
    },
    body: params,
  });
  return { recorded: true, accessState } as const;
}

function extractPaymentIntent(session: StripeCheckoutSession) {
  return session.payment_intent && typeof session.payment_intent === "object" ? session.payment_intent : null;
}

export async function paymentWasRecorded(sessionId: string) {
  const session = await retrieveCheckoutSession(sessionId, true);
  const paymentIntent = extractPaymentIntent(session);
  if (!paymentIntent) return false;
  const metadata = paymentIntent.metadata ?? {};
  return metadata.product_family === "velvet_passport"
    && metadata.product === "paris_now"
    && metadata.now_access_state === "active";
}

export async function isStripePassEntitlementActive(sessionId: string) {
  const cached = entitlementCache.get(sessionId);
  if (cached && Date.now() - cached.checkedAt < ENTITLEMENT_CACHE_MS) return cached.active;

  const session = await retrieveCheckoutSession(sessionId, true);
  const paymentIntent = extractPaymentIntent(session);
  const sessionMetadata = session.metadata ?? {};
  const intentMetadata = paymentIntent?.metadata ?? {};
  const active = Boolean(
    paymentIntent
    && session.status === "complete"
    && session.payment_status === "paid"
    && sessionMetadata.product_family === "velvet_passport"
    && sessionMetadata.product === "paris_now"
    && intentMetadata.product_family === "velvet_passport"
    && intentMetadata.product === "paris_now"
    && intentMetadata.now_access_state === "active"
  );
  entitlementCache.set(sessionId, { active, checkedAt: Date.now() });
  return active;
}
