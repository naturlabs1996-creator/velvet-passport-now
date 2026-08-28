import { runGlobalNowHealth } from "../../../../../lib/now-health-aggregate";

export const runtime = "nodejs";

function configured(name: string) {
  return Boolean(process.env[name]?.trim());
}

export async function GET() {
  const health = await runGlobalNowHealth();
  const viatorMode = (process.env.VIATOR_API_MODE || "").trim().toLowerCase();
  const checks = {
    healthKey: configured("NOW_HEALTH_KEY"),
    passSigning: configured("PARIS_NOW_PASS_SECRET"),
    stripeSecret: configured("STRIPE_SECRET_KEY"),
    stripeWebhookSecret: configured("STRIPE_WEBHOOK_SECRET"),
    publicOrigin: configured("NOW_PUBLIC_ORIGIN"),
    viatorApiKey: configured("VIATOR_API_KEY"),
    viatorMode: viatorMode === "sandbox" || viatorMode === "production",
    transportProvider: configured("IDFM_PRIM_API_KEY") || configured("PRIM_API_KEY"),
    weatherGateway: configured("NOW_WEATHER_MODEL_GATEWAY") || configured("VERCEL_URL") || configured("VERCEL_PROJECT_PRODUCTION_URL"),
  };
  const criticalReady = checks.healthKey && checks.passSigning && checks.stripeSecret && checks.stripeWebhookSecret && checks.publicOrigin;
  const providerReady = checks.viatorApiKey && checks.viatorMode && checks.transportProvider && checks.weatherGateway;

  return Response.json({
    scope: "paris-now",
    generatedAt: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
    configuration: {
      checks,
      criticalReady,
      providerReady,
      readyForMajorTests: criticalReady && providerReady,
      viatorMode: viatorMode === "sandbox" || viatorMode === "production" ? viatorMode : "unconfigured",
    },
    health: {
      status: health.status,
      travelerSafe: health.travelerSafe,
      degraded: health.degraded,
      action: health.action,
      counts: health.counts,
      componentCount: health.componentCount,
      components: health.components.map((item) => ({
        component: item.component,
        status: item.status,
        degraded: item.degraded,
        fallbackActive: item.fallbackActive,
        primaryCode: item.primaryCode,
      })),
    },
  }, {
    status: health.status === "red" ? 503 : 200,
    headers: { "Cache-Control": "private, no-store" },
  });
}
