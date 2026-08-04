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
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
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

  const feelsLikeC = json.current?.apparent_temperature ?? json.current?.temperature_2m ?? 18;
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
