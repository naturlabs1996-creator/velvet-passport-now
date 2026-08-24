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
  data?: { object?: StripeCheckoutSession };
};

const PLAN_CONFIG: Record<NowPassPlan, { amount: number; durationMs: number; priceEnv: string }> = {
  "72h": { amount: 1490, durationMs: 72 * 60 * 60 * 1000, priceEnv: "STRIPE_PRICE_PARIS_NOW_72H" },
  "7d": { amount: 2290, durationMs: 7 * 24 * 60 * 60 * 1000, priceEnv: "STRIPE_PRICE_PARIS_NOW_7D" },
};

function stripeSecret() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return key;
}

function planPriceId(plan: NowPassPlan) {
  const value = process.env[PLAN_CONFIG[plan].priceEnv];
  if (!value) throw new Error(`${PLAN_CONFIG[plan].priceEnv} is not configured`);
  return value;
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

export async function createNowCheckoutSession(input: NowCheckoutInput) {
  const config = PLAN_CONFIG[input.plan];
  const priceId = planPriceId(input.plan);
  const channelCommissionable = input.channel !== "direct";
  const partnerId = (input.partnerId || "").trim().slice(0, 120);
  const commissionScheme = (input.commissionScheme || (channelCommissionable ? "partner-default" : "none")).trim().slice(0, 120);

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("line_items[0][price]", priceId);
  params.set("line_items[0][quantity]", "1");
  params.set("success_url", `${input.origin}/app?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
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

export async function recordRevenueEvent(event: StripeEvent) {
  const base = process.env.NOW_REVENUE_ENGINE_URL?.replace(/\/$/, "");
  const secret = process.env.NOW_REVENUE_ENGINE_SECRET;
  if (!base || !secret) return { recorded: false, reason: "revenue-engine-not-configured" } as const;

  const response = await fetch(`${base}/stripe/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      "Idempotency-Key": event.id,
    },
    body: JSON.stringify({ source: "velvet_passport_now", event }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Revenue engine rejected Stripe event (${response.status})`);
  return { recorded: true } as const;
}

export async function paymentWasRecorded(sessionId: string) {
  const base = process.env.NOW_REVENUE_ENGINE_URL?.replace(/\/$/, "");
  const secret = process.env.NOW_REVENUE_ENGINE_SECRET;
  if (!base || !secret) return false;
  const response = await fetch(`${base}/stripe/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${secret}` },
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`Revenue engine payment lookup failed (${response.status})`);
  const payload = await response.json() as { paid?: boolean; source?: string };
  return payload.paid === true && (!payload.source || payload.source === "velvet_passport_now");
}
