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

type StripeCheckoutSession = {
  id: string;
  url?: string | null;
  payment_status?: string;
  status?: string;
  amount_total?: number | null;
  currency?: string | null;
  metadata?: Record<string, string> | null;
};

export type StripeEvent = {
  id: string;
  type: string;
  created?: number;
  data?: { object?: Record<string, unknown> };
};

const PLAN_CONFIG: Record<NowPassPlan, { amount: number; durationMs: number; priceEnv: string; name: string }> = {
  "72h": { amount: 1490, durationMs: 72 * 60 * 60 * 1000, priceEnv: "STRIPE_PRICE_PARIS_NOW_72H", name: "Paris NOW · 72-hour Pass" },
  "7d": { amount: 2290, durationMs: 7 * 24 * 60 * 60 * 1000, priceEnv: "STRIPE_PRICE_PARIS_NOW_7D", name: "Paris NOW · 7-day Pass" },
};

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
  const priceId = process.env[config.priceEnv]?.trim();
  if (priceId) {
    params.set("line_items[0][price]", priceId);
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

export async function retrieveCheckoutSession(sessionId: string) {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) throw new Error("Invalid Stripe Checkout Session id");
  const payload = await stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}`);
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
