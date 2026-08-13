export type UpdateTrigger = 'launch' | 'foreground';
export type UpdateFailureStage = 'check' | 'download' | 'reload';
export type UpdateFailureReason = 'network' | 'unknown';

/** Avoid another request for quick photo-picker and permission round trips. */
export const FOREGROUND_CHECK_COOLDOWN_MS = 60_000;

/** Give expo-updates' native launch check a moment to finish first. */
export const LAUNCH_CHECK_DELAY_MS = 4_000;

export function shouldCheckForUpdate({
  now,
  lastCheckedAt,
  inFlight,
}: {
  now: number;
  lastCheckedAt: number | null;
  inFlight: boolean;
}): boolean {
  if (inFlight) return false;
  return lastCheckedAt === null || now - lastCheckedAt >= FOREGROUND_CHECK_COOLDOWN_MS;
}

/** Never forward SDK error text to analytics; it can contain URLs and device details. */
export function updateFailureReason(error: unknown): UpdateFailureReason {
  const message = error instanceof Error ? error.message : '';
  return /network|offline|internet|timed?\s*out|connection/i.test(message)
    ? 'network'
    : 'unknown';
}

export function shortUpdateIdentity(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  return value.length > 12 ? value.slice(0, 12) : value;
}
