/**
 * Every sentence the Invite / Share page prints. Redesign 10.
 *
 * A `.ts`, not a `.tsx`, for the reason `friends-lines.ts` and every page spec
 * in this wave give: the node test bundler cannot parse React Native's Flow
 * source, so anything a test needs to read has to live where no component
 * import can reach it.
 *
 * ── WHAT THIS PAGE MAY NOT SAY ──────────────────────────────────────────────
 *
 * There is ONE link per person and it is permanent. Nothing here mints a code,
 * sets an expiry, revokes anything or tracks a recipient — the app cannot know
 * a link was sent to anybody, because it reads no contact book and puts no
 * per-invite token in the URL. So there is no "waiting on" row, no "sent to N
 * people", no delivery state and no destination: the OS share sheet's chosen
 * app is never reported back.
 *
 * AN ARRIVAL PROVES EXACTLY ONE THING. `invite_arrivals()` answers "whose
 * `invited_by` is me", and that is the whole claim: this person joined Cinch
 * through your link. It is NOT a friendship, NOT mutual authorization and NOT
 * closet visibility — every one of those is a separate, later, opt-in act. No
 * sentence below may imply otherwise.
 */

// ---------------------------------------------------------------------------
// The card
// ---------------------------------------------------------------------------

/** The plate's eyebrow. Dropped entirely at the accessibility sizes. */
export const INVITATION_EYEBROW = 'Your invitation';

/** The two actions. Share is the one that matters; copy is its quiet neighbour. */
export const SHARE_ACTION = 'Share your link';
export const COPY_ACTION = 'Copy link';

/**
 * What Copy says while it holds its confirmation.
 *
 * The artifact draws this state twice and writes it two different ways — frame
 * 14 (the dedicated copy-confirmed frame) says "Copied", frame 22 says "Link
 * copied". Frame 14 is the one whose whole subject is this control, so it wins,
 * and the shorter word is also the one that cannot change the button's width
 * enough to move anything.
 */
export const COPIED_ACTION = 'Copied';

/**
 * The colophon under the two actions.
 *
 * The whole product promise in one line: permanent, unlimited, no bookkeeping.
 */
export const LINK_NOTE = 'One link, yours permanently. Send it to as many people as you like.';

/**
 * The colophon when THIS visit claimed the handle (ledger A54, 2026-09-13).
 * Says what happened and where to change it, nothing else; `handle` arrives
 * with its `@`. Copy from the 09-13 nightly §11.3, verbatim.
 */
export function seededNote(handle: string): string {
  return `You're ${handle} on Cinch. Change it any time in Profile.`;
}

/** The filled action on a seeded visit — the closet, not "your link". */
export const SEEDED_SHARE_ACTION = 'Share my closet';

// ---------------------------------------------------------------------------
// The roster
// ---------------------------------------------------------------------------

export const ARRIVALS_HEADING = 'Came in from your link';

/**
 * The mark a fresh arrival wears.
 *
 * A WORD, never a badge and never a number. It ages out on its own, nothing has
 * to be tapped to clear it, and no count of fresh arrivals exists anywhere —
 * a numeral here would be the "N new" badge this page refuses.
 */
export const FRESH_MARK = 'Just arrived';

/** The quieter heading the aged-out rows sit under, when both groups exist. */
export const EARLIER_HEADING = 'Earlier';

/** "Mara came in" — the fresh detail's title, built from the name we were given. */
export function freshArrivalTitle(firstName: string): string {
  return `${firstName} came in`;
}

/**
 * "They joined Cinch from your link."
 *
 * ── A DELIBERATE ONE-WORD DEVIATION FROM THE ACCEPTED COPY ──────────────────
 *
 * The accepted frame reads "She joined Cinch from your link." about Mara, who
 * is a person the designer invented and knew. This sentence is printed about a
 * REAL arrival, and nothing in `invite_arrivals()` — `user_id`, `display_name`,
 * `username`, `joined_at` — says how that person should be referred to. There
 * is no pronoun column anywhere in `profiles` to read.
 *
 * So shipping the frame's word literally would print "She" over every arrival
 * regardless of who they are, which is wrong about a large share of them and
 * wrong in a way the reader can see. "They" is the same sentence, the same
 * length, and true about everybody. Every other word is the accepted copy
 * exactly.
 *
 * If the founder wants the frame's word back, it is this one string.
 */
export const FRESH_DETAIL = 'They joined Cinch from your link.';

/**
 * The honest empty. Nobody has joined — and that is ALL it says.
 *
 * It does not say how many were invited, because the app does not know and
 * never will: there is no record of who the link went to, by design.
 */
export const EMPTY_TITLE = 'Nobody has come in yet';
export const EMPTY_BODY =
  'When someone joins Cinch through your link, they’ll appear here. The link is yours ' +
  'permanently — send it whenever you like.';

// ---------------------------------------------------------------------------
// The four ways this page can be less than whole — each independent
// ---------------------------------------------------------------------------

/**
 * The link read failed. The link itself did not change, because it cannot.
 *
 * This is the sentence that keeps a network failure from reading as a lost or
 * rotated invitation: there is no rotation to fear.
 */
export const LINK_FAILED_TITLE = 'Couldn’t load your link';
export const LINK_FAILED_BODY =
  'Your link hasn’t changed — this phone just couldn’t fetch it. Nothing about your invitation ' +
  'has been altered.';

/** A failed roster read says so, and never renders as "nobody has come in yet". */
export const ARRIVALS_FAILED_TITLE = 'Couldn’t load who came in';
export const ARRIVALS_FAILED_BODY =
  'This is a connection problem, not an empty list. Nobody has been removed.';

/**
 * Offline — the asymmetry that makes this page work.
 *
 * The link is permanent, so a cached one is still true and still shareable. The
 * roster can change, so it is withheld rather than shown stale.
 */
export const OFFLINE_TITLE = 'You’re offline';
export const OFFLINE_BODY =
  'Your link never changes, so it’s safe to share from here. Who came in is hidden until you’re ' +
  'back on a connection — it may have changed since.';

/**
 * There is no link until there is a handle, because the handle IS the link.
 *
 * AUDIT 100 #32 shortened the body. The shipped sentence restated the title
 * across two more clauses — "so it needs one before it can be shared" says
 * "choose a handle first" again, and the reassurance about permanence is the
 * profile screen's to make, where the handle is actually claimed. What is
 * left is the one new fact: why a handle is the ask at all.
 */
export const NO_HANDLE_TITLE = 'Choose a handle first';
export const NO_HANDLE_BODY = 'Your invitation link is built from your handle.';
export const NO_HANDLE_ACTION = 'Choose a handle';

/**
 * The share sheet would not open.
 *
 * NOTHING WAS SENT is the first clause, because a sheet that failed to present
 * is indistinguishable from one that was dismissed unless the page says which.
 */
export const SHARE_FAILED_TITLE = 'The share sheet didn’t open';
export const SHARE_FAILED_BODY =
  'Nothing was sent. You can copy the link instead, or read it straight off the card above.';
export const SHARE_RETRY_ACTION = 'Try the share sheet again';

export const TRY_AGAIN = 'Try again';

/** The page's own title, for the header and for VoiceOver. */
export const INVITE_TITLE = 'Invite a friend';

/**
 * How long Copy holds its confirmation. Exactly four seconds.
 *
 * Exported so the test asserts the shipped number rather than a copy of it, and
 * so the control's resting and confirming boxes can be proven to be the same
 * height — the confirmation must not move anything on the page.
 */
export const COPIED_HOLD_MS = 4000;

/**
 * How long an arrival wears its mark.
 *
 * Two days, because the mark answers "did anyone come in since I last looked",
 * and the honest window for that is a couple of days rather than a session.
 * Nothing clears it and nothing can be dismissed: it ages out by itself, which
 * is why it needs no read state on either side of the network.
 */
export const FRESH_WINDOW_MS = 48 * 60 * 60 * 1000;

/**
 * Whether an arrival still wears its mark.
 *
 * A missing or unparseable timestamp is NOT fresh: the row already declines to
 * claim a date, and a mark is a claim about a date.
 */
export function isFreshArrival(joinedAt: string | null | undefined, now: Date): boolean {
  if (!joinedAt) return false;
  const t = new Date(joinedAt).getTime();
  if (!Number.isFinite(t)) return false;
  return now.getTime() - t < FRESH_WINDOW_MS;
}

// ---------------------------------------------------------------------------
// Geometry — the accepted frame's measures, and their large-type pairs
//
// Here rather than in the component for the reason the module header gives:
// the test bundler cannot parse React Native's Flow source, so a constant a
// test needs to read must live where no component import can reach it.
// ---------------------------------------------------------------------------

/** The plate. 214pt at rest, shorter at AX where the type needs the room. */
export const PLATE_HEIGHT = 214;
export const PLATE_HEIGHT_AX = 150;
export const PLATE_RADIUS = 24;

/**
 * The two actions.
 *
 * The frame draws these as capsules (56/28 and 48/24). A labelled control in
 * this app is `md`, full stop — `tailwind.config.js` states the rule and gives
 * the reason — so the radius below is the type system's, and the HEIGHTS, which
 * are what the finger and the eye actually measure, are the frame's exactly.
 */
export const PRIMARY_HEIGHT = 56;
export const PRIMARY_HEIGHT_AX = 60;
export const SECONDARY_HEIGHT = 48;
export const SECONDARY_HEIGHT_AX = 56;
export const ACTION_RADIUS = 16;

/** The back control, and the page's gutter. */
export const BACK_SIZE = 44;
export const GUTTER_X = 20;

/** The accepted row: 60pt with a 38pt face, 76/48 at the accessibility sizes. */
export const ROW_HEIGHT = 60;
export const ROW_HEIGHT_AX = 76;
export const ROW_AVATAR = 38;
/**
 * 56, not the frame's 48.
 *
 * `Avatar` picks its monogram's size from the diameter and then lets Dynamic
 * Type scale the glyphs inside a disc that cannot grow — so at the largest
 * setting a two-letter monogram overflows a 48pt circle and the second letter
 * is sliced. Caught by holding the simulator against the PNG. Eight points of
 * diameter is the smallest change that fits the glyphs; the alternative was
 * capping the scale on a shared component every other screen also draws.
 */
export const ROW_AVATAR_AX = 56;
export const ROW_RADIUS = 18;

/**
 * Where this page recomposes instead of shrinking.
 *
 * The same threshold every other rebuilt page in this wave uses — one number
 * for the whole app, so two pages cannot disagree about what "large" is.
 */
export { AX_STACK_SCALE as INVITE_STACK_SCALE } from '@/features/closet/dynamic-type';
