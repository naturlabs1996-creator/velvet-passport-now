import { getNowCityConfig } from "../../../../../lib/city-config";
import { getMontrealTransitHealth } from "../../../../../lib/montreal-transit";
import { getWeatherIntelligence } from "../../../../../lib/weather-intelligence";

export const runtime = "nodejs";

function authorized(request: Request) {
  const expected = process.env.NOW_HEALTH_KEY?.trim();
  const provided = request.headers.get("x-now-health-key")?.trim();
  return Boolean(expected && provided && expected === provided);
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Health endpoint unavailable" }, { status: 404 });

  const city = getNowCityConfig("montreal");
  const [transit, weather] = await Promise.all([
    getMontrealTransitHealth(),
    getWeatherIntelligence(city.center),
  ]);

  const weatherSafe = weather.available;
  const status = !weatherSafe ? "red" : transit.degraded || weather.agreement === "single-source" ? "amber" : "green";

  return Response.json({
    city: city.id,
    checkedAt: new Date().toISOString(),
    status,
    travelerSafe: weatherSafe && transit.travelerSafe,
    weather: {
      available: weather.available,
      region: weather.region,
      agreement: weather.agreement,
      primaryModel: weather.primaryModel,
      modelsUsed: weather.modelsUsed,
      scenario: weather.scenario,
    },
    transit,
  }, {
    status: status === "red" ? 503 : 200,
    headers: { "Cache-Control": "private, no-store", "X-NOW-City-Health": status },
  });
}
