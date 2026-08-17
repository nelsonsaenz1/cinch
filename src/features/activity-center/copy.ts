/**
 * Every string the Activity Center says, in one file.
 *
 * ── THIS IS A TRANSCRIPTION, NOT AN AUTHORSHIP ────────────────────────────
 *
 * §9 of `design-refs/ACTIVITY-CENTER-IMPLEMENTATION.md` is a copy TABLE with
 * keys, and the keys below are those keys. Nothing here was improved, softened
 * or expanded on the way past. Where a string needed a companion the atlas
 * draws but the table does not name — the subtitle under a row, the provenance
 * line on AC-05, the two lines under the detail buttons — it is marked and its
 * source frame is cited, so a reader can tell a transcribed string from a
 * derived one at a glance.
 *
 * ── THE REGISTER ──────────────────────────────────────────────────────────
 *
 * Plain, present tense, no exclamation marks, and no engagement grammar
 * anywhere: nothing here says "Don't miss", nothing counts, nothing implies
 * falling behind. Three of these strings exist purely to say what CANNOT
 * happen — `FOOTER_PRIVACY`, `REACTION_PRIVACY`, `DISMISS_SCOPE` — because the
 * single most common question about an inbox is who else can see it, and a
 * surface that answers it once in small type at the foot of the page answers
 * it better than a settings screen nobody opens.
 *
 * ── NO REACT, NO REACT-NATIVE ─────────────────────────────────────────────
 *
 * The node suite asserts against these directly (`tests/activity-center-copy
 * .test.ts`), which it can only do while this file imports nothing that needs a
 * native module. The same split `features/circles/copy.ts` makes.
 */

// ---------------------------------------------------------------------------
// Chrome
// ---------------------------------------------------------------------------

/** `nav.title`. The large title, and the back label every detail screen shows. */
export const NAV_TITLE = 'Activity';

/**
 * `footer.privacy`. The foot of a populated timeline (AC-02).
 *
 * It answers the two questions an inbox raises and answers both in the
 * negative: nobody else sees this, and nothing in it came from a public feed.
 * Both are structural rather than promised — `activity_events` is readable by
 * one `recipient_id`, and every producer is a private action inside a group or
 * between two mutual friends.
 */
export const FOOTER_PRIVACY =
  'Only you can see your activity. It comes from people in your circles and never from public feeds.';

/** `retention.note`. AC-08's foot, and the only place the window is stated. */
export const RETENTION_NOTE = 'Activity older than 30 days is grouped, then cleared automatically.';

/**
 * `footer.mark`. The same two claims as a colophon, which is what a data line
 * under a list is set as — the timeline's rows are already 13px, so ending in
 * two centred 13px paragraphs ends the page in prose rather than in a mark.
 *
 * It sits BESIDE the two strings above rather than replacing them: AC-02 draws
 * this, and hangs `FOOTER_PRIVACY` and `RETENTION_NOTE` on the same element's
 * `accessibilityLabel`, so both claims still reach a screen reader verbatim.
 */
export const FOOTER_MARK = 'PRIVATE TO YOU · KEPT 30 DAYS';

// ---------------------------------------------------------------------------
// AC-01 · empty
// ---------------------------------------------------------------------------

/** `empty.title`. */
export const EMPTY_TITLE = 'You’re all caught up';
/** `empty.body`. */
export const EMPTY_BODY =
  'When someone in your circles invites you or reacts to a look you shared, it’ll appear here — only for you.';

// ---------------------------------------------------------------------------
// AC-06 · loading  ·  AC-07 · offline and error
// ---------------------------------------------------------------------------

/**
 * `loading.status`. Announced through `accessibilityLiveRegion="polite"`, which
 * is why it is a sentence rather than the word "Loading": a live region that
 * fires mid-navigation should say what is happening, not merely that something
 * is.
 */
export const LOADING_STATUS = 'Loading your activity…';

/** `offline.banner`. Sits ABOVE the last-cached list, never instead of it. */
export const OFFLINE_BANNER = 'You’re offline. Showing your last saved activity.';

/** `error.title` / `error.body` / `error.retry`. */
export const ERROR_TITLE = 'Couldn’t refresh';
export const ERROR_BODY =
  'We couldn’t reach Cinch just now. Check your connection and try again.';
export const ERROR_RETRY = 'Retry';

// ---------------------------------------------------------------------------
// Row sentences · §5's templates
//
// Each takes the pieces already resolved and returns the whole sentence. They
// live here rather than in `sentence.ts` so that the STRINGS are in the copy
// file and the SEGMENTATION — which run is bold — is in the module that draws
// rows. A template that returned JSX would put copy in a component file, and a
// component that concatenated its own strings would put copy in three of them.
// ---------------------------------------------------------------------------

/** The neutral name, matching `profileName`'s own fallback exactly. */
export const NEUTRAL_NAME = 'A Cinch member';

/** The neutral group name, for a row whose group is gone and whose payload predates it. */
export const NEUTRAL_CIRCLE = 'a private group';

/** `invite.row`. */
export const inviteRow = (name: string, circle: string) =>
  `${name} invited you to the circle ${circle}.`;

/** `invite.accepted`. */
export const inviteAccepted = (name: string, circle: string) =>
  `${name} accepted your invitation to ${circle}.`;

/**
 * `invite.declined`. Marked "quiet, no CTA" in §5, and the full stop is the
 * whole of that instruction: the sentence ends, nothing is offered, and the row
 * carries no action. It does NOT name the group — a decline is about the
 * person, and repeating the group's name turns a quiet fact into a second
 * mention of a thing that did not happen.
 */
export const inviteDeclined = (name: string) => `${name} declined your invitation.`;

/** §5's `circle.member.joined`. AC-02 draws it as "Priya joined Weeknight Wins." */
export const memberJoined = (name: string, circle: string) => `${name} joined ${circle}.`;

/** §5's `circle.member.left`. */
export const memberLeft = (name: string, circle: string) => `${name} left ${circle}.`;

/**
 * §5's `circle.self.left`. AC-08 draws it as "You left Coffee Club."
 *
 * Second person, and it is the only row in the surface that has one — every
 * other sentence is about somebody else. That is correct: this is the one event
 * whose actor and recipient are the same person, and a third-person rendering
 * ("Ada left Coffee Club") would read as news about a stranger who happens to
 * share your name.
 */
export const selfLeft = (circle: string) => `You left ${circle}.`;

/**
 * `reaction.row`.
 *
 * `{text}` IS ONE OF THREE WORDS, not free text. `daily_social_reactions`
 * carries `check (reaction in ('sharp','cozy','noted'))` and the client union
 * `DailyReaction` says the same; the atlas's illustrative "Love this" is a
 * drawing of the shape, not a claim that reactions are typed. So the quotation
 * marks in the template quote a fixed label, and there is no path by which a
 * stranger's prose reaches this sentence.
 */
export const reactionRow = (name: string, reaction: string) =>
  `${name} reacted “${reaction}” to a look you shared.`;

// ---------------------------------------------------------------------------
// Row subtitles · drawn in AC-02 and AC-08, not keyed in §9
//
// Marked as derived. Each one answers "where is this, and what does it mean for
// me" in four or five words, which is the whole job of the second line in the
// atlas's rows.
// ---------------------------------------------------------------------------

/** AC-02's reaction rows: "In Daily Social · Tap to view". */
export const REACTION_SUBTITLE = 'In Daily Social';
/** AC-02's accepted-invitation row: "Now in your circle". */
export const ACCEPTED_SUBTITLE = 'Now in your circle';

// ---------------------------------------------------------------------------
// AC-03 · the invitation detail
// ---------------------------------------------------------------------------

export const INVITATION_TITLE = 'Invitation';
/** AC-03's line under the group name. The count comes from `circle_member_count`. */
export const invitationMembers = (count: number) =>
  `Private circle · ${count} ${count === 1 ? 'person' : 'people'}`;
/** AC-03's "Maya invited you" card. */
export const invitedYou = (name: string) => `${name} invited you`;
/** AC-03's line beside the stacked avatars. */
export const INVITATION_PROMISE = 'You’ll see looks shared inside this circle.';

/** `invite.accept` / `invite.decline`, and AC-03's longer primary. */
export const INVITE_ACCEPT = 'Accept';
export const INVITE_DECLINE = 'Decline';
export const INVITE_ACCEPT_LONG = 'Accept invitation';

/** `invite.reversible`. The reason the primary is safe to tap. */
export const INVITE_REVERSIBLE =
  'Accepting is reversible — you can leave the circle at any time from its settings.';

// ---------------------------------------------------------------------------
// AC-04 · the reaction detail
// ---------------------------------------------------------------------------

export const REACTION_TITLE = 'Reaction';
/** AC-04's line under the reactor's name. */
export const REACTION_RELATION = 'In your circle';
/** AC-04's card: `Reacted “Sharp”`. */
export const reactedWith = (reaction: string) => `Reacted “${reaction}”`;
/** AC-04's eyebrow over the look. */
export const REACTION_LOOK_HEADING = 'The look you shared';

/** `reaction.view`. */
export const REACTION_VIEW = 'View in Daily Social';
/** `reaction.mute`. Reuses the existing Circles mute — no new setting store. */
export const reactionMute = (name: string) => `Mute reactions from ${name}`;
/** `reaction.privacy`. The second half is the read-receipt refusal, in words. */
export const REACTION_PRIVACY =
  'Reactions are private to you. No one can see whether you’ve opened this.';

// ---------------------------------------------------------------------------
// AC-05 · revoked
// ---------------------------------------------------------------------------

/** `revoked.title`. */
export const REVOKED_TITLE = 'No longer available';
/** `revoked.body`, for an invitation. */
export const revokedInvitationBody = (circle: string) =>
  `This invitation to ${circle} was withdrawn or has expired. There’s nothing left to accept.`;
/**
 * The reaction half of AC-05. Derived: §9 keys only the invitation body, and a
 * withdrawn reaction is the other subject a deep link can land on.
 */
export const REVOKED_REACTION_BODY =
  'This reaction was taken back. There’s nothing left to open.';
/** `revoked.dismiss`. */
export const REVOKED_DISMISS = 'Dismiss';
/**
 * AC-05's provenance card, minus its name and date.
 *
 * The frame draws "Withdrawn by Maya · Aug 15." ahead of this sentence; the
 * name is prepended at render when the actor resolves, and dropped when they do
 * not, because a provenance line that says "Withdrawn by A Cinch member" is
 * worse than one that simply says the record is kept briefly.
 */
export const REVOKED_PROVENANCE =
  'We keep the record for a moment so the change makes sense, then remove it.';
/** AC-05's line under Dismiss. Derived from AC-05's own footer. */
export const DISMISS_SCOPE = 'Dismissing removes this from your activity only.';

// ---------------------------------------------------------------------------
// AC-08 · grouped
// ---------------------------------------------------------------------------

/** `group.joined`. */
export const groupJoined = (count: number) => `${count} people joined your circles`;
/** `group.reactions`. */
export const groupReactions = (count: number) => `${count} reactions to your looks`;

// ---------------------------------------------------------------------------
// Sections
//
// Four headings, and the set is closed. `grouping.ts` decides which a row lands
// under; these are what it lands under. "New" is the only one that is not about
// elapsed time — it means unseen — and that difference is the reason it is
// named rather than dated.
// ---------------------------------------------------------------------------

export const SECTION_NEW = 'New';
export const SECTION_EARLIER = 'Earlier';
export const SECTION_EARLIER_WEEK = 'Earlier this week';
export const SECTION_EARLIER_MONTH = 'Earlier this month';

// ---------------------------------------------------------------------------
// AC-10 · edit mode and clear all
// ---------------------------------------------------------------------------

/**
 * The nav-bar toggle. `Edit` reveals per-row Remove and the Clear All control;
 * `Done` puts them away.
 *
 * THIS PAIR IS AN ACCESSIBILITY REQUIREMENT, not a convenience. §11's gesture
 * rule: swipe-to-dismiss and long-press each need a visible equivalent, and
 * this is it. A surface whose only way to remove a row is a swipe is a surface
 * a VoiceOver user cannot clear.
 */
export const EDIT = 'Edit';
export const EDIT_DONE = 'Done';
/** The per-row affordance Edit reveals. */
export const ROW_REMOVE = 'Remove';
/** The Clear All control Edit reveals, and the sheet's own confirm. */
export const CLEAR_ALL = 'Clear All';

/** `clear.title`. */
export const CLEAR_TITLE = 'Clear all activity?';
/**
 * `clear.body`.
 *
 * Three sentences, and the middle one is the one that matters: clearing the
 * NOTICE is not declining the INVITE. `activity_events` and `circle_members`
 * are different tables and Clear All touches only the first, so a pending
 * invitation survives it and is still answerable from the group. Saying so here
 * is what stops somebody clearing an inbox and believing they have refused
 * something.
 */
export const CLEAR_BODY =
  'This permanently removes every item from your Activity. Pending invitations stay in your circles. This can’t be undone.';
/** `clear.confirm` / `clear.cancel`. */
export const CLEAR_CONFIRM = 'Clear All Activity';
export const CLEAR_CANCEL = 'Cancel';

/** `undo.dismissed`, split into its two halves — the toast draws them separately. */
export const UNDO_DISMISSED = 'Removed';
export const UNDO = 'Undo';

// ---------------------------------------------------------------------------
// VoiceOver
//
// §11: each row is ONE element with a composed label plus a hint. The label
// ends with the elapsed time and, when it applies, the word "unread" — because
// unread is conveyed as TEXT and not by the dot's colour, which is the colour-
// independence rule in the one place it is easiest to break.
// ---------------------------------------------------------------------------

export const UNREAD_SPOKEN = 'unread';
export const OPEN_HINT = 'Double-tap to open';

/**
 * The composed row label. "Maya invited you to the circle Sunday Roasts, 2
 * hours ago, unread."
 *
 * Commas rather than full stops between the clauses: VoiceOver treats a period
 * as a sentence break and pauses long enough that the timestamp reads as a new
 * announcement.
 */
export function rowAccessibilityLabel(
  sentence: string,
  elapsed: string,
  unread: boolean,
): string {
  const stem = sentence.replace(/\.$/, '');
  return unread ? `${stem}, ${elapsed}, ${UNREAD_SPOKEN}` : `${stem}, ${elapsed}`;
}
