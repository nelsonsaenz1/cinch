import type { PostgrestError } from '@supabase/supabase-js';

export type WearFailureKind =
  | 'signed_out'
  | 'session_unavailable'
  | 'network'
  | 'rejected'
  | 'unexpected';

/**
 * A safe category for the UI with the untouched underlying failure retained
 * for diagnostics. The raw service message is never shown to the wearer.
 */
export class WearMutationError extends Error {
  readonly kind: WearFailureKind;
  readonly cause: unknown;

  constructor(kind: WearFailureKind, cause?: unknown) {
    super(`Wear could not be recorded (${kind}).`);
    this.name = 'WearMutationError';
    this.kind = kind;
    this.cause = cause;
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : typeof error === 'string' ? error : '';
}

function pgCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  return String((error as PostgrestError).code);
}

export function isNetworkFailure(error: unknown): boolean {
  return /network|offline|internet|fetch|connect|timed?\s*out|socket|dns/i.test(messageOf(error));
}

export function classifyWearSessionFailure(error: unknown): WearFailureKind {
  // `withDeadline` names its own bounded auth timeout this way. That is a
  // session lookup that failed to settle, not evidence that the device itself
  // is offline, even though the recovery copy may still mention connection.
  if (/did not respond/i.test(messageOf(error))) return 'session_unavailable';
  return isNetworkFailure(error) ? 'network' : 'session_unavailable';
}

/** Stable, deliberately small mapping from service failures to actionable UI states. */
export function classifyWearFailure(error: unknown): WearFailureKind {
  if (error instanceof WearMutationError) return error.kind;
  if (isNetworkFailure(error)) return 'network';

  // Insufficient privilege/ownership, invalid arguments, foreign-key and check
  // failures all mean the requested wardrobe write was refused, not that it
  // might have landed. Keep symbolic SQLSTATE values rather than message text.
  const code = pgCode(error);
  if (code === 'PGRST301') return 'signed_out';
  if (code && ['42501', '22004', '22023', '23503', '23514'].includes(code)) return 'rejected';

  return 'unexpected';
}

export type WearFailureCopy = {
  title: string;
  body: string;
  retryLabel: string;
};

export function wearFailureCopy(kind: WearFailureKind): WearFailureCopy {
  switch (kind) {
    case 'signed_out':
      return {
        title: 'Sign in again',
        body: 'This wear wasn’t logged. Sign in, then try again.',
        retryLabel: 'Try again',
      };
    case 'session_unavailable':
      return {
        title: 'Couldn’t check your session',
        body: 'This wear wasn’t logged. Try again. If it keeps happening, reopen Cinch.',
        retryLabel: 'Try again',
      };
    case 'network':
      return {
        title: 'No connection',
        body: 'This wear wasn’t logged. Reconnect and try again.',
        retryLabel: 'Try again',
      };
    case 'rejected':
      return {
        title: 'Couldn’t log this wear',
        body: 'One or more pieces may have changed. Review your closet, then try again.',
        retryLabel: 'Try again',
      };
    case 'unexpected':
      return {
        title: 'Couldn’t log this wear',
        body: 'This wear wasn’t logged. Try again in a moment.',
        retryLabel: 'Try again',
      };
  }
}
