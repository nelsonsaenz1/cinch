import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

const BUCKET = 'garments';

/**
 * Signed URLs are valid for an hour and refetched at fifty minutes, so a URL
 * can never expire while it is on screen.
 */
const TTL_SECONDS = 3600;
const REFETCH_AFTER_MS = 50 * 60_000;

/**
 * Storage paths -> displayable URLs.
 *
 * The garments bucket is private, which is the correct default for photographs
 * of someone's clothes and their home. The consequence is that a stored path
 * is not a URL: handing `items.thumb_path` straight to an <Image> renders
 * nothing, silently, with no error to debug.
 *
 * Signing is batched into one request rather than one per image. A closet grid
 * mounts dozens of cards at once, and per-image signing would mean dozens of
 * round trips on every scroll — the difference between a screen that appears
 * and one that fills in.
 */
export function useSignedUrls(paths: (string | null | undefined)[]) {
  // Deduplicated and sorted so that the same set of images in a different order
  // is a cache hit rather than a fresh request.
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))].sort();

  const query = useQuery({
    queryKey: ['signed-urls', unique],
    enabled: unique.length > 0,
    staleTime: REFETCH_AFTER_MS,
    // staleTime alone only MARKS the data stale — nothing re-runs a query the
    // screen is already subscribed to, and focus refetch is disabled globally.
    // The interval is what actually renews URLs before the 60-minute expiry.
    refetchInterval: REFETCH_AFTER_MS,
    gcTime: TTL_SECONDS * 1000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(unique, TTL_SECONDS);

      if (error) throw error;

      const map: Record<string, string> = {};
      for (const entry of data ?? []) {
        // `createSignedUrls` reports per-path failures inline instead of
        // throwing, so one deleted object cannot take down the whole grid.
        if (entry.signedUrl && entry.path) map[entry.path] = entry.signedUrl;
      }
      return map;
    },
  });

  return {
    urls: query.data ?? {},
    isLoading: query.isLoading,
    /** Resolve a path, preferring the cutout and falling back to the thumbnail. */
    resolve: (...candidates: (string | null | undefined)[]): string | undefined => {
      for (const c of candidates) {
        if (c && query.data?.[c]) return query.data[c];
      }
      return undefined;
    },
  };
}

/**
 * Turn a signed URL into an `<Image>` source that survives re-signing.
 *
 * expo-image keys its disk cache on the whole URI by default, and a signed URI
 * carries a token that is different on every signing — so the same garment
 * photograph was written to disk under a new key every hour and never once read
 * back. Offline, and on any cold start after the previous token expired, every
 * cell fell back to a placeholder even though the bytes were already on the
 * device.
 *
 * Stripping the query leaves `{bucket}/{user}/{item}/{file}`, which is stable
 * for the life of the object, so the cache actually hits. Passing it explicitly
 * is required: expo-image cannot infer that two URLs differing only in their
 * token are the same image.
 */
export function stableImageSource(uri: string | undefined) {
  if (!uri) return undefined;
  return { uri, cacheKey: uri.split('?')[0] };
}
