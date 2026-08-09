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

  // Shared with `fetchForecastRange` and the archive reader below. Three copies
  // of this mapping is how one of them silently stops applying apparent
  // temperature.
  return dailyToContexts((await res.json()) as OpenMeteoResponse);
}

// ---------------------------------------------------------------------------
// Forecasting a trip that has not started yet
// ---------------------------------------------------------------------------

/**
 * How far ahead Open-Meteo will actually forecast.
 *
 * The number matters to the product, not just to this module: it is the exact
 * line between K-05 quoting a real forecast and K-06's first failure quoting a
 * normal September instead. Booking a trip three months out is the common case,
 * so that failure is not an edge — it is most first trips.
 */
export const FORECAST_HORIZON_DAYS = 16;

/** Whole days from today, in the local calendar, to a `YYYY-MM-DD`. */
function daysAhead(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  const target = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** True when the whole range is inside the forecast horizon. */
export const hasForecastFor = (startsOn: string, endsOn: string): boolean =>
  daysAhead(startsOn) >= 0 && daysAhead(endsOn) <= FORECAST_HORIZON_DAYS;

/**
 * The forecast for a specific date range rather than for the next N days.
 *
 * `fetchForecast` above counts forward from today, which is right for the week
 * planner and useless for a trip: "12–15 September" is not "the next four
 * days". Open-Meteo takes the range directly, so this is the same endpoint with
 * two more parameters and none of the arithmetic.
 *
 * Returns an empty array when the range is outside the horizon, rather than a
 * silently wrong one — the caller is expected to fall back to
 * `fetchSeasonalNormals` and to SAY that it did.
 */
export async function fetchForecastRange(
  latitude: number,
  longitude: number,
  startsOn: string,
  endsOn: string,
  signal?: AbortSignal,
): Promise<WeatherContext[]> {
  if (!hasForecastFor(startsOn, endsOn)) return [];

  const params = new URLSearchParams({
    latitude: latitude.toFixed(2),
    longitude: longitude.toFixed(2),
    daily:
      'temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,wind_speed_10m_max',
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh',
    timezone: 'auto',
    start_date: startsOn,
    end_date: endsOn,
  });

  const res = await fetch(`${ENDPOINT}?${params}`, { signal });
  if (!res.ok) throw new Error(`Forecast request failed: ${res.status}`);

  return dailyToContexts((await res.json()) as OpenMeteoResponse);
}

/** The shared shape of every daily Open-Meteo payload, in one place. */
function dailyToContexts(json: OpenMeteoResponse & { daily?: { wind_speed_10m_max?: number[] } }) {
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

/**
 * What that place is normally like on those dates.
 *
 * NOT A FORECAST, AND THE SCREEN HAS TO SAY SO. This reads Open-Meteo's ARCHIVE
 * — what the weather actually was on the same dates in previous years — rather
 * than a climate model's projection. "Lisbon is 18 to 27° in September" is then
 * a fact with a provenance, which is the difference between K-06's honest
 * fallback and an invented range.
 *
 * Three years, because two is an accident and ten is a request that takes long
 * enough to feel like the app hung. `years` comes back with the numbers so the
 * caller can attribute them if it wants to.
 */
const ARCHIVE_ENDPOINT = 'https://archive-api.open-meteo.com/v1/archive';

const NORMALS_YEARS = 3;

export type SeasonalNormals = {
  /** One entry per day of the range, so the packing engine can run unchanged. */
  perDay: WeatherContext[];
  lowC: number;
  highC: number;
  /** How many previous years were averaged. */
  years: number;
};

export async function fetchSeasonalNormals(
  latitude: number,
  longitude: number,
  startsOn: string,
  endsOn: string,
  signal?: AbortSignal,
): Promise<SeasonalNormals | null> {
  const startYear = Number(startsOn.slice(0, 4));
  const runs = await Promise.all(
    Array.from({ length: NORMALS_YEARS }, (_, i) =>
      fetchArchiveRange(
        latitude,
        longitude,
        `${startYear - i - 1}${startsOn.slice(4)}`,
        `${startYear - i - 1}${endsOn.slice(4)}`,
        signal,
      ).catch(() => [] as WeatherContext[]),
    ),
  );

  const usable = runs.filter((r) => r.length > 0);
  if (!usable.length) return null;

  // Averaged across years, day by day. A range that crossed a leap day in one
  // year and not another comes back a day short; the shortest run bounds it
  // rather than padding with a repeat of the last day.
  const length = Math.min(...usable.map((r) => r.length));
  const perDay: WeatherContext[] = [];

  for (let i = 0; i < length; i++) {
    const highC = mean(usable.map((r) => r[i]!.highC));
    const lowC = mean(usable.map((r) => r[i]!.lowC));
    perDay.push({
      feelsLikeC: (highC + lowC) / 2,
      highC,
      lowC,
      // Deliberately zero. "It rained on the 14th three Septembers ago" is not
      // a reason to pack a raincoat for the 14th, and the memo must not claim a
      // wet afternoon it cannot know about.
      precipitationChance: 0,
      windKph: mean(usable.map((r) => r[i]!.windKph)),
      swing: highC - lowC >= 8,
    });
  }

  if (!perDay.length) return null;

  return {
    perDay,
    lowC: Math.round(Math.min(...perDay.map((d) => d.lowC))),
    highC: Math.round(Math.max(...perDay.map((d) => d.highC))),
    years: usable.length,
  };
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

async function fetchArchiveRange(
  latitude: number,
  longitude: number,
  startsOn: string,
  endsOn: string,
  signal?: AbortSignal,
): Promise<WeatherContext[]> {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(2),
    longitude: longitude.toFixed(2),
    daily:
      'temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,wind_speed_10m_max',
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh',
    timezone: 'auto',
    start_date: startsOn,
    end_date: endsOn,
  });

  const res = await fetch(`${ARCHIVE_ENDPOINT}?${params}`, { signal });
  if (!res.ok) throw new Error(`Archive request failed: ${res.status}`);
  return dailyToContexts((await res.json()) as OpenMeteoResponse);
}

/**
 * The band that tells two Lisbons apart (K-02).
 *
 * Portugal in September is 18–24°; Ohio is 6–14°. Nothing else in a geocoder
 * result distinguishes them for someone deciding what to pack, which is why the
 * atlas puts the climate where a subtitle would normally go.
 *
 * Returns null rather than a guess when the archive has nothing — the row then
 * falls back to the region, which is the ordinary disambiguation.
 */
export async function fetchClimateBand(
  latitude: number,
  longitude: number,
  onIsoDate: string,
  signal?: AbortSignal,
): Promise<{ lowC: number; highC: number } | null> {
  const normals = await fetchSeasonalNormals(
    latitude,
    longitude,
    onIsoDate,
    onIsoDate,
    signal,
  ).catch(() => null);

  return normals ? { lowC: normals.lowC, highC: normals.highC } : null;
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
