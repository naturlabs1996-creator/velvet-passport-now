import { getMontrealPilotRoute } from "./montreal-pilot-routes";
import { simulateMontrealPilotRoute } from "./montreal-pilot-simulator";

export function runMontrealPilotScenarioSuite() {
  const oldMontreal = getMontrealPilotRoute("montreal-old-1");
  const downtown = getMontrealPilotRoute("montreal-downtown-1");
  const mileEnd = getMontrealPilotRoute("montreal-mile-end-1");
  if (!oldMontreal || !downtown || !mileEnd) throw new Error("Montreal pilot catalogue incomplete");

  const cases = [
    {
      id: "old-snow",
      result: simulateMontrealPilotRoute(oldMontreal, {
        currentLocation: { lat: 45.5058, lon: -73.5579 },
        weather: "snow",
      }),
      expect: { weatherAction: "shorten-outdoor" },
    },
    {
      id: "downtown-mccord-closed",
      result: simulateMontrealPilotRoute(downtown, {
        currentLocation: { lat: 45.4986, lon: -73.5693 },
        visitedStopIds: ["downtown-dorchester", "downtown-place-canada"],
        unavailableStopIds: ["downtown-mccord"],
      }),
      expect: { routeAction: "end-safely", nextStop: null },
    },
    {
      id: "mile-rialto-closed",
      result: simulateMontrealPilotRoute(mileEnd, {
        currentLocation: { lat: 45.5217, lon: -73.6018 },
        visitedStopIds: ["mile-lahaie", "mile-richler"],
        unavailableStopIds: ["mile-rialto"],
      }),
      expect: { routeAction: "end-safely", nextStop: null },
    },
    {
      id: "stm-degraded",
      result: simulateMontrealPilotRoute(downtown, {
        currentLocation: { lat: 45.4998, lon: -73.5709 },
        transit: { stm: "degraded", rem: "normal" },
      }),
      expect: { transitAction: "replan" },
    },
    {
      id: "stm-rem-unavailable",
      result: simulateMontrealPilotRoute(downtown, {
        currentLocation: { lat: 45.4998, lon: -73.5709 },
        transit: { stm: "unavailable", rem: "unavailable" },
      }),
      expect: { transitAction: "walk-or-taxi" },
    },
    {
      id: "gps-major-displacement",
      result: simulateMontrealPilotRoute(oldMontreal, {
        currentLocation: { lat: 45.5355, lon: -73.6130 },
      }),
      expect: { routeAction: "replan-from-current-location" },
    },
  ];

  const checks = cases.map((item) => {
    const pass = Object.entries(item.expect).every(([key, expected]) => {
      if (key === "nextStop") return item.result.nextStop === expected;
      return (item.result as unknown as Record<string, unknown>)[key] === expected;
    });
    return { id: item.id, pass, result: item.result };
  });

  return {
    checkedAt: new Date().toISOString(),
    passed: checks.every((item) => item.pass),
    total: checks.length,
    passedCount: checks.filter((item) => item.pass).length,
    checks,
  };
}
