import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  TripsListBody,
  type PastTripView,
  type TripCardView,
  type TripsListView,
} from '@/components/trips/trips-list-body';
import { useCloset } from '@/features/closet/queries';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { useAllTrips, type SavedTrip } from '@/features/plan/use-trips';
import {
  CARD_TILES,
  HERO_TILES,
  TRIPS_LIST_STACK_SCALE,
  bagItemIds,
  destinationLabel,
  laterLabel,
  partitionTrips,
  pastDatesLine,
  tripDatesLine,
} from '@/features/trips/trips-list-spec';

/**
 * Trips — the list. Redesign 04, and the founder's explicit ask: after planning
 * a trip you can come back and see all of them.
 *
 * This file holds the queries and hands one plain object to `TripsListBody`.
 * Nothing here draws — the split people-search, the Plan week and the event
 * poster all make, and the reason is the same one every time: a screen that
 * reaches for three queries at the top cannot be posed, and the five accepted
 * frames have to be openable without a session.
 *
 * ── WHAT IT READS ────────────────────────────────────────────────────────────
 *
 * The existing `trips` table, through the one module allowed to touch it, plus
 * the closet and its signed URLs — which every other surface that shows a
 * garment already mounts. No schema change, no new table, no new endpoint.
 *
 * ── WHAT IT DELIBERATELY DOES NOT DO ─────────────────────────────────────────
 *
 * There is NO placement call on this page, and there is no membership read.
 * Planning a NEW trip is the paywall moment and that gate lives in `PackingTab`
 * where it always did; looking at the trips you already have is not a feature,
 * it is your own history, and putting a door in front of it would be the app
 * charging someone to see what they already paid to make. "Plan a trip" leaves
 * for the Packing tab and meets the gate there, once, in the place that owns it.
 */
export default function TripsScreen() {
  const router = useRouter();
  const { fontScale } = useWindowDimensions();

  const trips = useAllTrips();
  const closet = useCloset();

  const rows = useMemo(() => trips.data ?? [], [trips.data]);
  const items = useMemo(() => closet.data ?? [], [closet.data]);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  /**
   * Every path any card on the shelf might draw, signed in ONE batch.
   *
   * Collected across all the trips before signing rather than per card: the
   * signer takes a list, and a request per card would be one round trip per row
   * on a page whose whole job is to show every row at once.
   */
  const paths = useMemo(() => {
    const out: (string | null | undefined)[] = [];
    for (const trip of rows) {
      for (const id of bagItemIds(trip.memo, trip.itemIds, CARD_TILES)) {
        const item = byId.get(id);
        if (item) out.push(item.platePath, item.cutoutPath, item.thumbPath);
      }
    }
    return out;
  }, [rows, byId]);

  const { resolve } = useSignedUrls(paths);

  const view: TripsListView = useMemo(() => {
    const tilesFor = (trip: SavedTrip, limit: number) =>
      bagItemIds(trip.memo, trip.itemIds, limit).map((id) => {
        const item = byId.get(id);
        // The preference order every other garment well in the app uses.
        return { uri: item ? resolve(item.platePath, item.cutoutPath, item.thumbPath) : undefined };
      });

    const toCard = (trip: SavedTrip, limit: number): TripCardView => ({
      id: trip.id,
      destination: destinationLabel(trip.destination),
      dates: tripDatesLine(trip.startsOn, trip.endsOn),
      // The badge is the fact `saved_at` records: this trip actually produced a
      // packing list. It is not a count and it does not promise one.
      packed: trip.savedAt !== null,
      tiles: tilesFor(trip, limit),
    });

    const toPast = (trip: SavedTrip): PastTripView => ({
      id: trip.id,
      destination: destinationLabel(trip.destination),
      dates: pastDatesLine(trip.startsOn, trip.endsOn),
      // One well, not four: the past row is the quiet register and the artifact
      // gives it a single small square.
      tile: tilesFor(trip, 1)[0] ?? null,
    });

    const { upcoming, past } = partitionTrips(rows, new Date());
    const [next, ...rest] = upcoming;

    return {
      loading: trips.isLoading,
      offline: trips.isError,
      next: next ? toCard(next, HERO_TILES) : null,
      upcoming: rest.map((trip) => toCard(trip, CARD_TILES)),
      past: past.map(toPast),
      laterLabel: laterLabel(rest, new Date()),
      onBack: () => router.back(),
      // Straight into Packing, not onto the week calendar. The tab reads the
      // param on arrival; without it "Plan a trip" lands two taps short.
      onPlanTrip: () => router.push({ pathname: '/(tabs)/plan', params: { mode: 'packing' } }),
      onRetry: () => void trips.refetch(),
      /**
       * Trip Detail (brief §6) has landed, so the withheld chevron comes alive.
       *
       * The destination rides along as a param purely so the detail page's hero
       * can paint its real title in the first frame — the card that was tapped
       * already knows the place, and `trips/[id]` treats the param as a head
       * start that its own row read immediately supersedes. Nothing about the
       * page depends on it: a deep link with no param resolves identically, one
       * beat later.
       */
      onOpenTrip: (tripId: string) => {
        const trip = rows.find((t) => t.id === tripId);
        router.push({
          pathname: '/trips/[id]',
          params: { id: tripId, destination: trip ? destinationLabel(trip.destination) : '' },
        });
      },
    };
  }, [rows, byId, resolve, trips, router]);

  // Both edges, not just the top: this is a pushed page and its foot is pinned,
  // so on a device with a home indicator the empty state's CTA and the offline
  // state's retry would otherwise sit under it. The artifact's frame had a tab
  // bar occupying that space.
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'bottom']}>
      <TripsListBody view={view} large={fontScale >= TRIPS_LIST_STACK_SCALE} />
    </SafeAreaView>
  );
}
