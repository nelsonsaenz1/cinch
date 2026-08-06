import { useEffect, useState } from 'react';

/**
 * Debounce the query, not the render.
 *
 * Returns `value` again only once it has stopped changing for `delayMs`, so a
 * search field can render every keystroke while the thing driving a network
 * request — a `queryKey` — settles once typing pauses. React Query's own
 * key-based cancellation still keeps results correctly ordered; this only
 * cuts the wasted round trips.
 */
export function useDebouncedValue<T>(value: T, delayMs = 200): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
