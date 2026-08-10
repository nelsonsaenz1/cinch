/**
 * The handle an invite link arrived with, held between the tap and the moment
 * there is somebody to be friends on behalf of.
 *
 * A module-level slot rather than state or storage, and each of those is a
 * deliberate refusal:
 *
 *  - NOT React state, because the URL usually arrives before the tree that
 *    would hold it. A cold start opened by a link has the URL available from
 *    `getInitialURL()` while the root layout is still deciding whether there
 *    is a session at all.
 *
 *  - NOT AsyncStorage, because it must not survive the app being closed. A
 *    handle that persisted would attach a friendship to whoever signs in on
 *    this phone next, which could easily be a different person — and
 *    `apply_invite` makes the friendship rather than requesting it, so there
 *    is no confirmation step in which the mistake would surface.
 *
 * The slot is therefore in-memory and single-use: `take` clears it, so a
 * handle is spent exactly once.
 */

let pending: string | null = null;

/** Remember a handle parsed off an incoming URL. Last one in wins. */
export function rememberInvite(handle: string): void {
  pending = handle;
}

/**
 * Read and clear. Called by the handoff once a session exists, which is the
 * only place that can act on it.
 */
export function takePendingInvite(): string | null {
  const handle = pending;
  pending = null;
  return handle;
}

/** Read without clearing — for deciding whether a route is owed at all. */
export function peekPendingInvite(): string | null {
  return pending;
}
