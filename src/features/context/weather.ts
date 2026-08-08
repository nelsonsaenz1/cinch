import type { WeatherContext } from '@/lib/styling';

/**
 * Open-Meteo. No API key, no account, generous free tier for non-commercial
 * use, and it returns apparent temperature directly rather than making us
 * reimplement wind chill.
 *
 * Apparent temperature is the number the styling engine wants. Air temperature
 * is what thermometers report; what a person needs to wear is decided by wind
 * and humidity too, and 4°C in a 30 km/h wind calls for a different coat than
 * 4°C still.
 */
const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    precipitation?: number;
    wind_speed_10m?: number;
  };
  daily?: {
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    apparent_temperature_max?: number[];
    apparent_temperature_min?: number[];
    precipitation_probability_max?: number[];
  };
};

export async function fetchWeather(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<WeatherContext> {
  // Two decimals — about 1.1 km. Weather does not vary meaningfully below that,
  // so sending more would be precision leaked to a third party for nothing.
  //
  // It is also the difference between declaring Precise Location and Coarse
  // Location in the privacy manifest: Apple's threshold for "precise" is three
  // or more decimal places. Rounding here is the honest way to qualify for the
  // weaker claim, rather than the other way round.
  const params = new URLSearchParams({
    latitude: latitude.toFixed(2),
    longitude: longitude.toFixed(2),
    current: 'temperature_2m,apparent_temperature,precipitation,wind_speed_10m',
    daily:
      'temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max',
    // Celsius throughout; the UI converts for display. Keeping one unit inside
    // the engine avoids a class of bug where a threshold is silently compared
    // against the wrong scale.
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh',
    timezone: 'auto',
    forecast_days: '1',
  });

  const res = await fetch(`${ENDPOINT}?${params}`, { signal });
  if (!res.ok) throw new Error(`Weather request failed: ${res.status}`);

  const json = (await res.json()) as OpenMeteoResponse;

  // No invented temperature. This value reaches the share card, an artifact
  // that leaves the phone, and the card's rule is that weather is printed or
  // dropped — never estimated. A payload with neither reading is a failed
  // request that happened to return 200, so it throws like one: the caller
  // ends up with no weather context at all, the colophon line disappears, and
  // nothing claims to know what the day feels like. (`?? 18` used to sit here,
  // which shipped a confident "Feels 64°F" derived from nothing.)
  const feelsLikeC = json.current?.apparent_temperature ?? json.current?.temperature_2m;
  if (feelsLikeC == null) throw new Error('Weather response carried no temperature');
  const highC = json.daily?.apparent_temperature_max?.[0] ?? json.daily?.temperature_2m_max?.[0] ?? feelsLikeC;
  const lowC = json.daily?.apparent_temperature_min?.[0] ?? json.daily?.temperature_2m_min?.[0] ?? feelsLikeC;

  return {
    feelsLikeC,
    highC,
    lowC,
    precipitationChance: (json.daily?.precipitation_probability_max?.[0] ?? 0) / 100,
    windKph: json.current?.wind_speed_10m ?? 0,
    // A day that moves more than about eight degrees cannot be dressed for with
    // one fixed weight, so the engine starts preferring a removable layer over
    // a single heavier piece.
    swing: highC - lowC >= 8,
  };
}

/**
 * A multi-day forecast, one WeatherContext per day.
 *
 * Used by the week planner and the packing list. Daily rows have no "current"
 * reading, so apparent-temperature max and min are averaged to stand in for
 * feels-like — closer to what a whole day feels like than either extreme, and
 * the swing is preserved separately for the layering rule.
 */
export async function fetchForecast(
  latitude: number,
  longitude: number,
  days: number,
  signal?: AbortSignal,
): Promise<WeatherContext[]> {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(2),
    longitude: longitude.toFixed(2),
    daily:
      'temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,wind_speed_10m_max',
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh',
    timezone: 'auto',
    // Open-Meteo caps the free forecast at 16 days.
    forecast_days: String(Math.min(Math.max(days, 1), 16)),
  });

  const res = await fetch(`${ENDPOINT}?${params}`, { signal });
  if (!res.ok) throw new Error(`Forecast request failed: ${res.status}`);

  const json = (await res.json()) as OpenMeteoResponse & {
    daily?: { wind_speed_10m_max?: number[] };
  };
  const d = json.daily;
  if (!d?.temperature_2m_max?.length) return [];

  return d.temperature_2m_max.map((_, i) => {
    const highC = d.apparent_temperature_max?.[i] ?? d.temperature_2m_max![i]!;
    const lowC = d.apparent_temperature_min?.[i] ?? d.temperature_2m_min?.[i] ?? highC;
    return {
      feelsLikeC: (highC + lowC) / 2,
      highC,
      lowC,
      precipitationChance: (d.precipitation_probability_max?.[i] ?? 0) / 100,
      windKph: d.wind_speed_10m_max?.[i] ?? 0,
      swing: highC - lowC >= 8,
    };
  });
}

export type Place = {
  name: string;
  country: string;
  /** The first-level region — "Colorado", "Île-de-France". Empty string when
   *  the gazetteer has none, which is common for city-states and small
   *  countries; the field is always present so callers format rather than
   *  branch. */
  admin1: string;
  latitude: number;
  longitude: number;
};

/**
 * Place lookup for packing, and for an occasion's Where field.
 *
 * Open-Meteo's geocoding API, same provider as the forecast — no key, and no
 * second vendor to name in the privacy policy. Two callers now share it, so
 * it only ever grows: the packing questionnaire reads `name` and `country`
 * and is untouched by `admin1` arriving beside them.
 */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`,
    { signal },
  );
  if (!res.ok) return [];

  const json = (await res.json()) as {
    results?: {
      name: string;
      country?: string;
      admin1?: string;
      latitude: number;
      longitude: number;
    }[];
  };

  return (json.results ?? []).map((r) => ({
    name: r.name,
    country: r.country ?? '',
    admin1: r.admin1 ?? '',
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}

/** Whole degrees in the user's unit. Nobody dresses to a tenth of a degree. */
export function formatTemp(celsius: number, units: 'C' | 'F'): string {
  const value = units === 'F' ? (celsius * 9) / 5 + 32 : celsius;
  return `${Math.round(value)}°`;
}

/** A short phrase for the weather strip — the reason, not just the number. */
export function describeWeather(w: WeatherContext, units: 'C' | 'F'): string {
  const parts: string[] = [];

  if (w.precipitationChance >= 0.4) {
    parts.push(`${Math.round(w.precipitationChance * 100)}% rain`);
  }
  if (w.windKph >= 25) parts.push('windy');
  if (w.swing) {
    parts.push(`${formatTemp(w.lowC, units)}–${formatTemp(w.highC, units)} today`);
  }

  if (parts.length) return parts.join(' · ');
  return w.feelsLikeC >= 24 ? 'warm' : w.feelsLikeC <= 8 ? 'cold' : 'mild';
}
