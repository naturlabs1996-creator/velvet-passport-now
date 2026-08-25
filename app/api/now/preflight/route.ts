export const runtime = "nodejs";

function authorized(request: Request) {
  const expected = process.env.NOW_HEALTH_KEY?.trim();
  if (!expected) return false;
  const provided = request.headers.get("x-now-health-key")?.trim();
  return Boolean(provided && provided === expected);
}

function configured(name: string) {
  return Boolean(process.env[name]?.trim());
}

function validHttpsOrigin(value?: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === value.replace(/\/$/, "");
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Preflight endpoint unavailable" }, { status: 404 });
  }

  const viatorMode = (process.env.VIATOR_API_MODE || "").trim().toLowerCase();
  const origin = process.env.NOW_PUBLIC_ORIGIN?.trim().replace(/\/$/, "");
  const weatherGatewayConfigured = configured("NOW_WEATHER_MODEL_GATEWAY") || configured("VERCEL_URL") || configured("VERCEL_PROJECT_PRODUCTION_URL");
  const transportConfigured = configured("IDFM_PRIM_API_KEY") || configured("PRIM_API_KEY");

  const checks = {
    healthKey: configured("NOW_HEALTH_KEY"),
    passSigning: configured("PARIS_NOW_PASS_SECRET"),
    stripeSecret: configured("STRIPE_SECRET_KEY"),
    stripeWebhookSecret: configured("STRIPE_WEBHOOK_SECRET"),
    publicOrigin: Boolean(origin) && validHttpsOrigin(origin),
    viatorApiKey: configured("VIATOR_API_KEY"),
    viatorMode: viatorMode === "sandbox" || viatorMode === "production",
    transportProvider: transportConfigured,
    weatherGateway: weatherGatewayConfigured,
  };

  const criticalReady = checks.healthKey
    && checks.passSigning
    && checks.stripeSecret
    && checks.stripeWebhookSecret
    && checks.publicOrigin;

  const providerReady = checks.viatorApiKey
    && checks.viatorMode
    && checks.transportProvider
    && checks.weatherGateway;

  return Response.json({
    scope: "paris-now",
    generatedAt: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
    viatorMode: viatorMode === "sandbox" || viatorMode === "production" ? viatorMode : "unconfigured",
    checks,
    criticalReady,
    providerReady,
    readyForMajorTests: criticalReady && providerReady,
  }, {
    headers: {
      "Cache-Control": "private, no-store",
      "X-NOW-Preflight": criticalReady && providerReady ? "ready" : "blocked",
    },
  });
}
