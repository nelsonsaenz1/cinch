import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Place } from '@/features/context/weather';
import { getUserId, supabase } from '@/lib/supabase';
import type { Json } from '@/types/database';

import { type CompanionKey, type DayPartKey, type IsoDate, type Trip, type VibeKey } from './trip';

/**
 * Saved trips.
 *
 * ONE MODULE, READ-ONLY TO THE UNITS THAT USE IT. Three separate surfaces need
 * a trip to outlive its screen and they are being built in parallel — K-01
 * quotes the last one, K-05 saves this one, K-06 reopens the last saved list.
 * Three units each writing their own `.from('trips')` is how the same query
 * ends up defined three times and drifting, so it is defined here once.
 *
 * A row exists from the moment the questionnaire is answered, before anything
 * is packed. That is what makes K-06's "your answers are saved — nothing to
 * type again" a true sentence after a timeout rather than a hopeful one.
 */

export type SavedTrip = {
  id: string;
  destination: Place;
  startsOn: IsoDate;
  endsOn: IsoDate;
  companions: CompanionKey;
  friendIds: string[];
  vibes: VibeKey[];
  parts: DayPartKey[];
  /** Null until a list was actually produced. */
  pieceCount: number | null;
  lookCount: number | null;
  itemIds: string[];
  memo: Json | null;
  weatherSource: 'none' | 'forecast' | 'normals';
  savedAt: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  place_name: string;
  place_country: string;
  place_admin1: string;
  latitude: number;
  longitude: number;
  starts_on: string;
  ends_on: string;
  companions: string;
  friend_ids: string[] | null;
  vibes: string[] | null;
  parts: string[] | null;
  piece_count: number | null;
  look_count: number | null;
  item_ids: string[] | null;
  memo: Json | null;
  weather_source: string;
  saved_at: string | null;
  created_at: string;
};

function toTrip(row: Row): SavedTrip {
  return {
    id: row.id,
    destination: {
      name: row.place_name,
      country: row.place_country,
      admin1: row.place_admin1,
      // Postgres numerics arrive as strings through PostgREST often enough that
      // coercing here is cheaper than discovering it at the forecast call.
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
    },
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    companions: row.companions as CompanionKey,
    friendIds: row.friend_ids ?? [],
    vibes: (row.vibes ?? []) as VibeKey[],
    parts: (row.parts ?? []) as DayPartKey[],
    pieceCount: row.piece_count,
    lookCount: row.look_count,
    itemIds: row.item_ids ?? [],
    memo: row.memo ?? null,
    weatherSource: (row.weather_source as SavedTrip['weatherSource']) ?? 'none',
    savedAt: row.saved_at,
    createdAt: row.created_at,
  };
}

/**
 * The last trip that actually produced a list.
 *
 * K-01 quotes it — "Your last trip — four days in Lisbon — came out at eleven
 * pieces and nine looks." `saved_at is not null` is the filter that makes that
 * sentence true: a questionnaire somebody abandoned three questions in is not a
 * trip they took, and quoting it would be the app making something up about the
 * user's own history.
 *
 * Undefined while loading, null when there is none. The gate drops the line
 * entirely for null — a first-time user does not get an invented Lisbon.
 */
export function useLastPackedTrip() {
  return useQuery({
    queryKey: ['trips', 'last-packed'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SavedTrip | null> => {
      const userId = await getUserId();
      if (!userId) return null;

      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('user_id', userId)
        .not('saved_at', 'is', null)
        .order('saved_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data ? toTrip(data as Row) : null;
    },
  });
}

/**
 * Recent destinations for K-02's "Recent" row.
 *
 * Distinct by name, newest first, capped at three because the atlas draws
 * three and because a fourth is somebody's holiday from last year.
 */
export function useRecentDestinations(limit = 3) {
  return useQuery({
    queryKey: ['trips', 'recent-destinations', limit],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Place[]> => {
      const userId = await getUserId();
      if (!userId) return [];

      const { data, error } = await supabase
        .from('trips')
        .select('place_name, place_country, place_admin1, latitude, longitude, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const seen = new Set<string>();
      const places: Place[] = [];
      for (const row of (data ?? []) as Row[]) {
        const key = `${row.place_name}|${row.place_country}`;
        if (seen.has(key)) continue;
        seen.add(key);
        places.push({
          name: row.place_name,
          country: row.place_country,
          admin1: row.place_admin1,
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
        });
        if (places.length >= limit) break;
      }
      return places;
    },
  });
}

/**
 * Every trip this reader has, for the Trips list — redesign 04.
 *
 * Here rather than in `features/trips/` because of the rule at the top of this
 * file: `.from('trips')` is defined in ONE module, and a fifth surface reading
 * the table is exactly the drift that rule exists to prevent. No new table, no
 * new column, no server-side grouping — the partition into upcoming and past
 * and the two sorts are pure functions in `trips-list-spec.ts`, where they can
 * be tested without a database.
 *
 * Unsaved rows are included on purpose. A row exists from the moment the
 * questionnaire is answered, and a trip somebody has booked but not yet packed
 * for is still a trip they are taking — the frame has a "Packed" badge
 * precisely so the list can hold both without lying about either.
 *
 * The cap is the shelf's, not the database's: nobody scrolls two hundred trips,
 * and an unbounded select on a page that opens on a tap is how a cold start on
 * a slow connection becomes a blank screen.
 */
export function useAllTrips() {
  return useQuery({
    queryKey: ['trips', 'all'],
    staleTime: 60_000,
    queryFn: async (): Promise<SavedTrip[]> => {
      const userId = await getUserId();
      if (!userId) return [];

      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('user_id', userId)
        .order('starts_on', { ascending: false })
        .limit(100);

      if (error) throw error;
      return ((data ?? []) as Row[]).map(toTrip);
    },
  });
}

/** The most recent trip of any kind, saved or not — K-06's "your answers are saved". */
export function useLastTrip() {
  return useQuery({
    queryKey: ['trips', 'last'],
    staleTime: 60_000,
    queryFn: async (): Promise<SavedTrip | null> => {
      const userId = await getUserId();
      if (!userId) return null;

      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data ? toTrip(data as Row) : null;
    },
  });
}

/**
 * Record the answered questionnaire, before anything is packed.
 *
 * Returns the row id, which the save below needs. A failure here is not worth a
 * screen: packing proceeds from the answers in memory either way, and all that
 * is lost is the ability to reopen it — so callers should swallow the error and
 * carry on rather than blocking a paid feature on a write.
 */
export function useStartTrip() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (trip: Trip): Promise<string | null> => {
      const userId = await getUserId();
      if (!userId) return null;

      const { data, error } = await supabase
        .from('trips')
        .insert({
          user_id: userId,
          place_name: trip.destination.name,
          place_country: trip.destination.country,
          place_admin1: trip.destination.admin1,
          latitude: Number(trip.destination.latitude.toFixed(2)),
          longitude: Number(trip.destination.longitude.toFixed(2)),
          starts_on: trip.startsOn,
          ends_on: trip.endsOn,
          companions: trip.companions,
          friend_ids: trip.friendIds,
          vibes: trip.vibes,
          parts: trip.parts,
        })
        .select('id')
        .single();

      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}

/** K-05's "Save to Plan" — the result, onto a row that already exists. */
export function useSaveTrip() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      tripId: string;
      pieceCount: number;
      lookCount: number;
      itemIds: string[];
      memo: Json;
      weatherSource: SavedTrip['weatherSource'];
    }) => {
      const { error } = await supabase
        .from('trips')
        .update({
          piece_count: input.pieceCount,
          look_count: input.lookCount,
          item_ids: input.itemIds,
          memo: input.memo,
          weather_source: input.weatherSource,
          saved_at: new Date().toISOString(),
        })
        .eq('id', input.tripId);

      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}
