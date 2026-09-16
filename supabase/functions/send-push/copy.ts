/**
 * What each notification actually says.
 *
 * Atlas 37's rule is that "the description is the promise", and this file is
 * where the promise is either kept or quietly broken. Every sentence below is
 * answerable against the row it belongs to on the preferences screen, and there
 * is nothing here that a reader could not have predicted from that row.
 *
 * ── THE MORNING EDIT DOES NOT CONTAIN THE LOOK ─────────────────────────────
 *
 * It cannot. `generateOutfits()` runs on the phone, and `generate-outfits` only
 * re-ranks a shortlist the client has already assembled and sent — the server
 * has never held a wardrobe and has no way to know what today's outfit is. So
 * the payload is a nudge, in the words the shipping copy uses:
 *
 *   > One notification at 7:30am, when the day's look is ready to read.
 *
 * No garment, no colour, no temperature. The atlas's own footnote already
 * settles the direction — "if the weather has not come in by then, the edit
 * waits rather than sending a guess" — and it is worth being exact about what
 * that footnote can and cannot mean here. The server does not know whether the
 * weather came in; weather is fetched on the device. What it can guarantee is
 * the thing the footnote is protecting: nothing in this payload is a guess,
 * because nothing in this payload is a claim about the day at all.
 *
 * ── NO USER-WRITTEN TEXT, WITH ONE BOUNDED EXCEPTION ───────────────────────
 *
 * A push renders on a locked screen, to whoever is holding the phone. Comment
 * bodies, borrow messages and event notes never cross into a payload; only
 * counts do. The exceptions are names and event titles, which are unavoidable
 * — "someone asked to borrow something" is not a notification, it is a shrug —
 * and both are already moderated (20260808100000) and are clipped here so a
 * long one cannot push the sentence off the end of the screen.
 */

/** Long enough for a real name, short enough to leave the sentence readable. */
const MAX_NAME_CHARS = 24;
/** An event title is the subject of its own sentence, so it gets more room. */
const MAX_TITLE_CHARS = 48;
/** `subcategory ?? category` — "chore jacket", not a paragraph. */
const MAX_LABEL_CHARS = 24;

/**
 * Clip user-written text to one line of a given length.
 *
 * Newlines are folded before the length check, not after: a name of "Ada\n\n\n"
 * is short enough to pass a naive test and still renders as three blank lines
 * inside a notification body.
 */
function clip(raw: string | null | undefined, max: number, fallback: string): string {
  const flat = (raw ?? '').replace(/\s+/gu, ' ').trim();
  if (!flat) return fallback;
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

export type Payload = { title: string; body: string; data: Record<string, string> };

/**
 * Where a tap lands.
 *
 * `/activity` is the page the contract assigns to Unit V (§8), and it is the
 * right destination for four of the five: atlas 37 promises in as many words
 * that "requests, borrows and invitations still arrive — they wait for you on
 * Activity", so the notification and the page it opens are the same
 * information. The morning edit opens Today, which is where the edit is.
 */
const TODAY = '/';
const ACTIVITY = '/activity';

export function morningEditPayload(input: { floor: boolean } = { floor: false }): Payload {
  if (input.floor) {
    // The one note a closet under the floor ever gets (12.13 / ledger A77):
    // sent once, the morning after the grant, and never again until the
    // tenth piece is in — the claim keys it 'floor', not by date. It says
    // what the closet is waiting for; it does not promise a look the server
    // knows it cannot have. Copy from the 09-11 nightly §11.3, verbatim.
    return {
      title: 'Ten photos, then Cinch dresses you.',
      body: 'Your closet is waiting for its first ten — a coat, a top, a pair of jeans is a start.',
      data: { channel: 'morning_edit', url: TODAY },
    };
  }
  return {
    title: 'Today’s edit',
    // Not "your look is X". See the docblock: the server does not have one.
    // Lifted from the contract's shipping line verbatim, typographic apostrophe
    // and all — every user-facing string in this app uses U+2019, and a payload
    // is as user-facing as a screen.
    body: 'The day’s look is ready to read.',
    data: { channel: 'morning_edit', url: TODAY },
  };
}

export function friendActivityPayload(input: {
  followBacks: number;
  newPieces: number;
  leadName: string | null;
}): Payload {
  const name = clip(input.leadName, MAX_NAME_CHARS, 'A friend');
  const backs = input.followBacks;
  const pieces = input.newPieces;

  // Written as two whole sentences rather than one clause with a conjunction,
  // because the two halves are genuinely different news and a reader should be
  // able to stop after the first.
  const backsLine = backs === 1
    ? `${name} added you back.`
    : `${backs} friends added you back.`;

  const piecesLine = pieces === 1
    ? `${name} added a piece to their closet.`
    : `${pieces} new pieces in your friends’ closets.`;

  let body: string;
  if (backs && pieces) {
    // The lead name belongs to whichever half it actually came from, and we
    // cannot tell from here — so the combined sentence uses neither.
    const arrived = pieces === 1 ? 'a piece' : `${pieces} pieces`;
    body = backs === 1
      ? `Someone added you back, and ${arrived} arrived in a friend’s closet.`
      : `${backs} friends added you back, and ${arrived} arrived in a friend’s closet.`;
  } else if (backs) {
    body = backsLine;
  } else {
    body = piecesLine;
  }

  return { title: 'Friends', body, data: { channel: 'friend_activity', url: ACTIVITY } };
}

export function borrowPayload(input: {
  kind: string;
  actorName: string | null;
  itemLabel: string | null;
}): Payload {
  const name = clip(input.actorName, MAX_NAME_CHARS, 'A friend');
  const label = clip(input.itemLabel, MAX_LABEL_CHARS, 'a piece');
  const returned = input.kind === 'returned';

  return {
    title: returned ? 'Returned' : 'Borrow request',
    body: returned
      ? `${name} returned your ${label}.`
      : `${name} asked to borrow your ${label}.`,
    data: { channel: 'borrow_requests', url: ACTIVITY },
  };
}

export function eventReminderPayload(input: {
  eventTitle: string | null;
  eventId: string;
}): Payload {
  const title = clip(input.eventTitle, MAX_TITLE_CHARS, 'Something you said yes to');
  return {
    title: 'Tomorrow',
    body: `${title} is tomorrow.`,
    // The one channel that opens the thing itself rather than the feed: the
    // route already exists and the reader is being told about one event.
    data: { channel: 'event_reminders', url: `/event/${input.eventId}` },
  };
}

export function votesCommentsPayload(input: {
  votes: number;
  comments: number;
  postId: string;
}): Payload {
  let body: string;
  if (input.votes && input.comments) {
    // Two kinds of response, aggregated two different ways — votes are one per
    // friend, comments are not — so the mixed case counts neither rather than
    // inventing a total that is true of neither.
    body = 'Friends weighed in on your look.';
  } else if (input.votes) {
    body = input.votes === 1
      ? 'One friend voted on your look.'
      : `${input.votes} friends voted on your look.`;
  } else {
    body = input.comments === 1
      ? 'One new comment on your look.'
      : `${input.comments} new comments on your look.`;
  }

  return {
    title: 'Your look',
    body,
    data: { channel: 'votes_comments', url: ACTIVITY, postId: input.postId },
  };
}
