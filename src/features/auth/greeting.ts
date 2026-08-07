/**
 * The time-aware salutation for the handoff screen (W-14).
 *
 * Pure over an hour number so it can be unit tested without freezing clocks:
 * the screen passes `new Date().getHours()`.
 */
export function greetingForHour(hour: number): 'Good morning' | 'Good afternoon' | 'Good evening' {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 18) return 'Good afternoon';
  return 'Good evening';
}
