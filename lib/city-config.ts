export type NowCityId = "paris" | "montreal";

export type NowCityConfig = {
  id: NowCityId;
  name: string;
  countryCode: string;
  timezone: string;
  locale: string;
  center: { lat: number; lon: number };
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  weatherRegion: "europe" | "north-america";
  transportProvider: "idfm" | "stm";
};

export const NOW_CITY_CONFIG: Record<NowCityId, NowCityConfig> = {
  paris: {
    id: "paris",
    name: "Paris",
    countryCode: "FR",
    timezone: "Europe/Paris",
    locale: "fr-FR",
    center: { lat: 48.8566, lon: 2.3522 },
    bounds: { minLat: 48.80, maxLat: 48.92, minLon: 2.20, maxLon: 2.50 },
    weatherRegion: "europe",
    transportProvider: "idfm",
  },
  montreal: {
    id: "montreal",
    name: "Montréal",
    countryCode: "CA",
    timezone: "America/Toronto",
    locale: "fr-CA",
    center: { lat: 45.5017, lon: -73.5673 },
    // MVP operating envelope includes central Montréal and YUL while rejecting
    // obviously unrelated coordinates. It can be widened later for regional NOW.
    bounds: { minLat: 45.40, maxLat: 45.72, minLon: -73.98, maxLon: -73.45 },
    weatherRegion: "north-america",
    transportProvider: "stm",
  },
};

export function isNowCityId(value: unknown): value is NowCityId {
  return value === "paris" || value === "montreal";
}

export function getNowCityConfig(city: NowCityId = "paris") {
  return NOW_CITY_CONFIG[city];
}

export function pointIsInsideCity(city: NowCityId, point: { lat: number; lon: number }) {
  const { bounds } = getNowCityConfig(city);
  return point.lat >= bounds.minLat && point.lat <= bounds.maxLat && point.lon >= bounds.minLon && point.lon <= bounds.maxLon;
}
