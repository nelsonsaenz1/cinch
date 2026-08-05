import Constants from 'expo-constants';
import Storage from 'expo-sqlite/kv-store';

import { QueryClient, type Query } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

/**
 * TanStack Query v5. There is no v6 for the React adapter — v6 exists only for
 * the Svelte adapter — so v5 is the terminal stable line and no migration is
 * pending.
 *
 * Persistence uses `expo-sqlite/kv-store` rather than MMKV: it is synchronous
 * (so the *sync* persister works, which is cheaper than the async one), needs
 * no extra native dependency, and runs in Expo Go. MMKV is faster but pulls in
 * Nitro and forces a dev build — worth it only if profiling shows this is a
 * bottleneck, which for a closet-sized cache it will not be.
 */

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The closet changes rarely; refetching on every focus wastes battery
      // and, for weather, risks tripping Open-Meteo's per-IP rate limit.
      staleTime: 5 * 60_000,
      gcTime: 24 * 60 * 60_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

export const persister = createSyncStoragePersister({
  storage: {
    getItem: (key) => Storage.getItemSync(key),
    setItem: (key, value) => Storage.setItemSync(key, value),
    removeItem: (key) => Storage.removeItemSync(key),
  },
});

/**
 * Which query keys survive a cold start.
 *
 * An allowlist rather than a blocklist, because the failure modes differ in
 * kind. Forgetting to persist something costs a refetch; persisting something
 * by accident writes it to disk and hands it to the next render, possibly for
 * a long time. Three keys earn it:
 *
 *   closet         — the grid, so it paints instead of spinning
 *   wardrobe       — the engine's scoring inputs
 *   style-profile  — the learned weights the engine scores with
 *
 * Together those are exactly what `generateOutfits` needs, which is what makes
 * the offline claim in the App Store listing true rather than aspirational.
 *
 * Everything else is deliberately excluded, and two of them would be bugs:
 *
 *   signed-urls    — Storage URLs expire after an hour. Rehydrating them a day
 *                    later renders broken images with no error, which is worse
 *                    than a placeholder. `useSignedUrls` sets gcTime to the TTL
 *                    for the same reason.
 *   ai-consent     — an authorization decision. It is read fresh from the
 *                    server, never from a cache that outlives a revocation.
 *   outfit-rerank,
 *   chat-history   — model output, and subject to consent withdrawal.
 *   weather,
 *   location,
 *   forecast       — a stale forecast is a wrong forecast, and the styling
 *                    engine already handles `weather: null` correctly.
 *
 * Only successful queries are written; persisting an error state would show a
 * failure that has not happened yet on next launch.
 */
const PERSISTED_KEYS = new Set(['closet', 'wardrobe', 'style-profile']);

export function shouldDehydrateQuery(query: Query): boolean {
  if (query.state.status !== 'success') return false;
  const root = query.queryKey[0];
  return typeof root === 'string' && PERSISTED_KEYS.has(root);
}

/**
 * Invalidates the whole persisted cache when it changes shape.
 *
 * The dehydrated blob is the *return type* of the query functions, frozen to
 * disk. Change `toItem`, `toGarment` or `StyleProfile` and yesterday's blob
 * rehydrates into components that expect the new shape — a crash, or worse, a
 * silently wrong render. The app version covers the ordinary case because any
 * such change ships in a build; `PERSIST_SCHEMA` is the manual override for
 * when a shape changes without a version bump, e.g. between two dev builds.
 *
 * Bump `PERSIST_SCHEMA` whenever a persisted query's return type changes.
 */
const PERSIST_SCHEMA = 1;
export const persistBuster = `v${PERSIST_SCHEMA}-${Constants.expoConfig?.version ?? 'dev'}`;

/**
 * Twelve hours. Short enough that a closet edited on another device is not
 * fronted as current for a whole day, long enough to cover the case this
 * exists for — opening the app on a plane the morning after packing.
 */
export const persistMaxAge = 12 * 60 * 60_000;

/**
 * Wipe the persisted cache from disk.
 *
 * `queryClient.clear()` empties memory only. Without this, signing out leaves
 * the previous user's closet sitting in SQLite, and the next cold start
 * rehydrates it *before* anything knows who is signed in — so user B watches
 * user A's clothes paint in and then disappear. That is a data leak, not a
 * cosmetic flicker, and it is the one thing that makes persistence riskier
 * than not having it.
 *
 * Called on every auth transition from the root layout, alongside the
 * in-memory `clear()` that `useSession` already does.
 */
export async function purgePersistedCache(): Promise<void> {
  await persister.removeClient();
}
