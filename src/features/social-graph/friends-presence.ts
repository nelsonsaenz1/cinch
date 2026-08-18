/**
 * The one authorized fact a friend's card may carry. Redesign 08.
 *
 * ── THE WHOLE PRIVACY ARGUMENT, IN ONE PARAGRAPH ────────────────────────────
 *
 * This module decides NOTHING about who may be seen. It is handed rows that
 * already crossed `friend_worn_outfits` → `friend_worn_outfit_items` →
 * `friend_items`, and every one of those views has already applied, in SQL:
 * mutual friendship, both directions of blocking, the owner's opt-in
 * (`worn_outfits_shared_since`, null by default), the non-retroactive boundary
 * (`worn_at >= that instant`), the seven-day window, `closet_hidden`, and
 * archived-item omission. A row that reached this function is a row the server
 * decided the reader may see. A row the reader may not see never arrives, so
 * there is nothing here to filter and nothing here to leak.
 *
 * `supabase/tests/23_friends_presence.sql` proves those predicates against the
 * per-friend read shape this file consumes.
 *
 * ── WHY THIS IS NOT DERIVED FROM `friend_items.last_worn_at` ────────────────
 *
 * `friend_items` carries `last_worn_at` and `wear_count` per garment, and it is
 * mutual- and `closet_hidden`-gated — so it LOOKS like a cheaper source for
 * "worn today". It is not gated by `worn_outfits_shared_since`. Reading it
 * would print a wear for a friend who never turned Daily Social sharing on,
 * which is the exact authorization boundary this page exists to respect. The
 * only sharing-gated source is `friend_worn_outfits`, so that is the only
 * source used.
 *
 * ── WHY ABSENCE HAS NO SHAPE ────────────────────────────────────────────────
 *
 * There are three outcomes and the third is nothing at all. A friend who
 * revoked sharing, whose look aged past seven days, who hid the piece, or who
 * simply never wore anything, all produce the SAME result: no entry in the map.
 * The card then draws a name and no slot — not a dash, not a dimmed well, not
 * "nothing shared". Any of those would report a private state transition to the
 * reader, which is the inference the design forbids and the reason the server
 * returns rows rather than reasons.
 */

/** A garment the reader is authorized to see, on a look worn inside the window. */
export type PresencePiece = {
  kind: 'piece';
  /** The app's one garment naming derivation — never a second one for friends. */
  label: string;
  /** Already-authorized derivatives only. Never an original, never a public URL. */
  thumbPath: string | null;
  cutoutPath: string | null;
  platePath: string | null;
};

/**
 * The mark that stands alone when the day is visible but no piece on it is.
 *
 * This is not a lesser piece fact and it is not a count. It appears only when
 * the owner shared a look worn TODAY and every garment on it is one the reader
 * may not see — so the honest statement is the day, and only the day.
 */
export type PresenceWornToday = { kind: 'worn_today' };

export type PresenceFact = PresencePiece | PresenceWornToday;

/** The shapes the three reads hand back, narrowed to what this needs. */
export type PresenceOutfitRow = { id: string; user_id: string; worn_at: string };
export type PresenceLinkRow = { outfit_id: string; item_id: string };
export type PresencePieceRow = {
  id: string;
  label: string;
  thumbPath: string | null;
  cutoutPath: string | null;
  platePath: string | null;
};

/** Local midnight for the day a timestamp falls in, or null if unparseable. */
function dayOf(iso: string): number | null {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * One fact per friend, or no entry.
 *
 * The newest authorized look wins — and "newest" is computed over the rows that
 * ARRIVED, never over the rows that exist, so an expired look cannot displace a
 * live one by being more recent. That distinction is what
 * `23_friends_presence.sql` assertion 4 pins.
 *
 * `now` is passed in rather than read from the ambient clock so the day
 * boundary is testable at both edges.
 */
export function presenceByFriend(input: {
  outfits: readonly PresenceOutfitRow[];
  links: readonly PresenceLinkRow[];
  pieces: readonly PresencePieceRow[];
  now?: Date;
}): Map<string, PresenceFact> {
  const today = dayOf((input.now ?? new Date()).toISOString());

  // The newest arrived look per friend.
  const newest = new Map<string, PresenceOutfitRow>();
  for (const row of input.outfits) {
    if (!row.user_id || !row.worn_at) continue;
    const held = newest.get(row.user_id);
    if (!held || row.worn_at > held.worn_at) newest.set(row.user_id, row);
  }

  const piecesById = new Map(input.pieces.map((p) => [p.id, p]));
  const piecesByOutfit = new Map<string, PresencePieceRow[]>();
  for (const link of input.links) {
    const piece = piecesById.get(link.item_id);
    // A link whose garment did not come back is a garment the reader may not
    // see. It is simply not here — the same answer a piece hidden before the
    // first read gets, and nothing distinguishes the two.
    if (!piece) continue;
    const list = piecesByOutfit.get(link.outfit_id);
    if (list) list.push(piece);
    else piecesByOutfit.set(link.outfit_id, [piece]);
  }

  const out = new Map<string, PresenceFact>();
  for (const [friendId, outfit] of newest) {
    const visible = piecesByOutfit.get(outfit.id) ?? [];
    if (visible.length > 0) {
      const piece = visible[0]!;
      out.set(friendId, {
        kind: 'piece',
        label: piece.label,
        thumbPath: piece.thumbPath,
        cutoutPath: piece.cutoutPath,
        platePath: piece.platePath,
      });
      continue;
    }
    // The look crossed but none of its pieces did. Only today earns the mark:
    // "worn today" about a Tuesday four days ago is a false sentence, and there
    // is no truthful shorter one, so the friend simply has no fact.
    const worn = dayOf(outfit.worn_at);
    if (today !== null && worn !== null && worn === today) {
      out.set(friendId, { kind: 'worn_today' });
    }
  }
  return out;
}

/**
 * Muted friends carry no fact.
 *
 * A mute is local to one device and is never written to the server
 * (`features/social-graph/muted.ts` — "a mute that synced or notified would be
 * a soft unfollow, which is a different, heavier product"), so this is the one
 * exclusion the client is allowed to make and the only one it makes. It is
 * applied by REMOVING the entry, not by marking it: a muted friend's card must
 * be indistinguishable from a friend with nothing to show, or the mute becomes
 * visible on the page that performs it.
 */
export function withoutMuted(
  facts: ReadonlyMap<string, PresenceFact>,
  isMuted: (id: string) => boolean,
): Map<string, PresenceFact> {
  const out = new Map<string, PresenceFact>();
  for (const [id, fact] of facts) if (!isMuted(id)) out.set(id, fact);
  return out;
}

/**
 * Offline withholds every fact and keeps every name.
 *
 * A cached presence fact is the one thing on this page that cannot be served
 * stale: sharing can be revoked, a look can age out of the window, a piece can
 * be hidden, and the cache would go on asserting a permission that has already
 * been withdrawn. Names are identity and do not expire that way, so they stay.
 */
export function withheldOffline(): Map<string, PresenceFact> {
  return new Map();
}

/**
 * Where the friends page recomposes instead of shrinking.
 *
 * The same threshold the closet grid, the event poster, the trips shelf, the
 * packing plate and the profile all use — one number for the whole app, so two
 * rebuilt pages cannot disagree about what "large" is. This page had no
 * threshold at all before redesign 08; the accepted AX frame gives it one.
 */
export { AX_STACK_SCALE as FRIENDS_STACK_SCALE } from '@/features/closet/dynamic-type';
