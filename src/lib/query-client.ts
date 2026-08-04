import Storage from 'expo-sqlite/kv-store';

import { QueryClient } from '@tanstack/react-query';
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
