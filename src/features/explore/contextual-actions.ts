/**
 * UX-09 — what the native context menu on an Explore row is allowed to offer,
 * and where each of those things can also be done by looking at the screen.
 *
 * The rule the accepted design sets is not "add a menu"; it is *every action in
 * a hidden gesture is also available visibly*. A long press is a discovery
 * problem — it is invisible, undiscoverable by VoiceOver users navigating by
 * element, and unavailable to anyone whose motor control makes a sustained
 * press unreliable. So the menu is an accelerator over the app's existing
 * surfaces, never a place where a capability lives.
 *
 * This module is the inventory, in data, so the promise is a test rather than a
 * comment. `explore.tsx` renders `Link.MenuAction` from exactly this list, and
 * `tests/explore-contextual-actions.test.ts` asserts that every entry names a
 * visible route to the same outcome.
 *
 * **Gesture-conflict audit** (the other half of UX-09), recorded here because
 * this is the file a future reader will open when they want to add a menu
 * somewhere else:
 *
 * - **Explore rows — safe, adopted.** The row has a tap and nothing else; no
 *   long press, no pan, no selection mode. A context menu steals nothing.
 * - **Closet grid — forbidden.** Long press IS multi-select there, and it is
 *   the only way in. A `Link.Menu` on a garment card would swallow the gesture
 *   and delete the feature. Explicitly not adopted, and this note is why.
 * - **Friend closet cards — not adopted.** They open a sheet
 *   (`FriendItemSheet`), not a route, and `Link.Preview` needs an `href` to
 *   preview. A menu without a preview on a card whose tap already opens a
 *   sheet of actions would be two menus for one object.
 * - **Zoom (`Link.AppleZoom`) — not adopted.** It is an iOS 18+ *navigation
 *   transition*, not a pinch-to-zoom viewer, and the Explore row's 76pt well is
 *   not the hero image of the closet page it opens; zooming a thumbnail into a
 *   grid it does not become is a transition that lies about where you went.
 */

import type { SFSymbols7_0 } from 'sf-symbols-typescript';

/** One entry in the menu, and the visible thing it duplicates. */
export interface ContextualAction {
  /** Stable id — the render site's key, and what the test names. */
  readonly id: string;
  /**
   * SF Symbol drawn beside the title. Typed to the same union `Link.MenuAction`
   * takes, so a symbol that does not exist is a compile error rather than a
   * blank square on device. Type-only — nothing native is imported here.
   */
  readonly icon: SFSymbols7_0;
  /**
   * Where the same outcome is reachable without the gesture. Prose, because a
   * reviewer has to be able to check it against the running app.
   */
  readonly visibleEquivalent: string;
}

/**
 * The Explore row menu: open, quieten, or go to the full circle.
 *
 * Three, at the low end of the accepted 3–5 band, and deliberately: a context
 * menu is a shortcut list, and the moment it grows past what fits in one glance
 * it becomes the primary surface it was not allowed to be. Nothing destructive
 * is here — unfriending, blocking and reporting stay behind the friend's own
 * overflow sheet with their confirmations, where a mis-registered long press
 * cannot reach them.
 */
export const EXPLORE_ROW_ACTIONS: readonly ContextualAction[] = [
  {
    id: 'open-closet',
    icon: 'square.grid.2x2',
    visibleEquivalent: 'Tapping the row itself opens the same friend closet.',
  },
  {
    id: 'mute',
    icon: 'bell.slash',
    visibleEquivalent:
      'The “Mute in Lately” row in the friend overflow sheet, on Friends and on their closet.',
  },
  {
    id: 'circle',
    icon: 'person.2',
    visibleEquivalent: 'The “Your circle” link at the foot of Explore.',
  },
] as const;

/** The menu item's words. Mute is a toggle, so its title depends on the row. */
export function actionTitle(id: string, opts: { ownerName: string; isMuted: boolean }): string {
  switch (id) {
    case 'open-closet':
      return `Open ${opts.ownerName}’s closet`;
    case 'mute':
      return opts.isMuted ? 'Unmute in Lately' : 'Mute in Lately';
    case 'circle':
      return 'Your circle';
    default:
      return '';
  }
}
