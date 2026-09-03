/**
 * What a saved look is allowed to tell the analytics store.
 *
 * ── THE RULE, FROM THE HANDOFF'S §6, WORD FOR WORD ────────────────────────
 *
 * "No user, friend, source-owner, look, item, collection, or note identifiers,
 * names, image URLs, or free text are ever sent. Counts and enums only;
 * collection identity is reduced to its ordinal position, never its name."
 *
 * Two clauses there are stricter than they look, and both are kept below rather
 * than merely quoted:
 *
 * · **A COLLECTION NEVER APPEARS AT ALL.** The handoff permits an ordinal, and
 *   this file does not send one. `saved_filter_applied` carries `is_all` and
 *   nothing else, because that is the only fact the funnel wants — do people
 *   filter — and an ordinal is a stable per-person handle on a specific private
 *   shelf. "Collection 3, four times a week, from this device" is a shape, and a
 *   shape a year deep in history cannot be taken back. The handoff's own event
 *   table asks for exactly `is_all` and the ordinal survives only in its
 *   preamble, so this follows the table.
 * · **A SAVE COUNT IS A BUCKET, NEVER A NUMBER.** `save_count_bucket` bands to
 *   four values. Daily Social sends `item_count` raw quite safely because a feed
 *   is other people's content arriving; a saved list is a private collection
 *   whose exact size is an attribute of one person.
 *
 * `tests/saved-looks-client.test.ts` executes every builder here and fails if
 * any key or value could carry an identifier, a name, a URL or free text.
 *
 * ── WHY THIS FILE HAS NO `track` IMPORT ───────────────────────────────────
 *
 * `@/lib/posthog` pulls in expo-updates and the PostHog React Native SDK, and a
 * module that imports it cannot be executed by the node suite. The property
 * shapes are the part worth testing — they are where an id would leak in — so
 * they are built by pure functions here and handed to `track()` in
 * `mutations.ts` and in the screens. Same split, same reason, as
 * `features/daily-social/analytics.ts` and `features/circles/analytics.ts`.
 *
 * ── WHY THE NAMES ARE NOT THE HANDOFF'S ───────────────────────────────────
 *
 * §6 writes them dotted: `saved.save_created`. The union in `lib/posthog.tsx` is
 * snake_case throughout, and its own comment says why — "that is what PostHog's
 * own UI, its SQL surface and every insight builder assume". A dot is legal in
 * an event name and is a nuisance in every one of those places. So the namespace
 * survives as a prefix and the separator becomes an underscore, one-to-one and
 * reversibly: `saved.save_created` → `saved_save_created`. Fifteen events in,
 * fifteen out, and `tests/saved-looks-client.test.ts` reads the handoff's table
 * back to prove the mapping is total.
 */

import type { SavedAvailability, SavedLookSource } from './types';

/**
 * The fifteen event names. Each is also a member of `AppEvent` in
 * `lib/posthog.tsx`, which is the closed union that makes a typo a compile error
 * rather than a second event that looks real and splits the funnel.
 *
 * There is deliberately no `saved_look_opened`-per-source and no
 * `saved_source_owner_seen`. Which particular looks a person keeps, and whose,
 * is the single most revealing thing this feature knows, and it is not a thing
 * to reconstruct inside a third-party store. `saved_detail_viewed` carries the
 * availability and whether a note exists, which is what the funnel actually asks.
 */
export const SAVED_EVENTS = {
  saveCreated: 'saved_save_created',
  saveRemoved: 'saved_save_removed',
  confirmationUndo: 'saved_confirmation_undo',
  listViewed: 'saved_list_viewed',
  collectionCreated: 'saved_collection_created',
  collectionRenamed: 'saved_collection_renamed',
  collectionDeleted: 'saved_collection_deleted',
  filterApplied: 'saved_filter_applied',
  detailViewed: 'saved_detail_viewed',
  sourceUnavailableSeen: 'saved_source_unavailable_seen',
  planCreated: 'saved_plan_created',
  stateShown: 'saved_state_shown',
  retryTapped: 'saved_retry_tapped',
} as const;

/** How a save was removed. Three doors, one result — OS-07's whole point. */
export type RemoveVia = 'swipe' | 'button' | 'detail';

/** What was done about a piece the closet does not have — OS-08. */
export type MissingAction = 'find_similar' | 'add_manual' | 'skip';

/** The three states OS-09 draws in place of a list. */
export type SavedNonContentState = 'loading' | 'offline' | 'error';

/**
 * The four bands, and they are the handoff's own for `save_count_bucket`.
 *
 * Reused unchanged for every other count this file sends — collections, members,
 * matched, missing, pieces used. One band table rather than five: five would
 * drift, and a chart that has to remember which event uses which bands is a
 * chart nobody trusts. The boundaries are the handoff's because they are already
 * the ones a product question is asked in ("do people with more than twenty
 * saves behave differently").
 */
export type CountBucket = '0' | '1-5' | '6-20' | '21+';

export function countBucket(n: number): CountBucket {
  const c = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  if (c === 0) return '0';
  if (c <= 5) return '1-5';
  if (c <= 20) return '6-20';
  return '21+';
}

// ---------------------------------------------------------------------------
// Saving
// ---------------------------------------------------------------------------

/**
 * A save was made — or met one that already existed.
 *
 * `was_duplicate` rides on the SAME event rather than getting its own, because
 * the pair is only ever read against each other: how often somebody taps save on
 * a look they already have is a question about the affordance, and a chart that
 * has to union two names to ask it is a chart nobody builds. It is also the
 * database's answer, not the interface's — the unique constraint is what decides
 * it.
 *
 * `had_image` is the closest thing to content here and it is a boolean about
 * presence, never the URL. The reason it is worth sending is OS-03: the no-image
 * card is a real, drawn state, and how often it is reached decides whether it
 * deserves the space it takes.
 */
export function saveCreatedProps(input: {
  sourceType: SavedLookSource;
  hadImage: boolean;
  wasDuplicate: boolean;
}): { source_type: SavedLookSource; had_image: boolean; was_duplicate: boolean } {
  return {
    source_type: input.sourceType,
    had_image: input.hadImage,
    was_duplicate: input.wasDuplicate,
  };
}

/**
 * A save was removed, and by which of the three doors.
 *
 * `via` is the measurement OS-07 exists for. The atlas requires every gesture to
 * have a visible control — "there is no action reachable only by gesture" — and
 * this is how the claim gets checked in the field rather than only in a test: if
 * `swipe` is the overwhelming majority, the visible control is not discoverable,
 * whatever the component tree says.
 */
export function saveRemovedProps(input: { sourceType: SavedLookSource; via: RemoveVia }): {
  source_type: SavedLookSource;
  via: RemoveVia;
} {
  return { source_type: input.sourceType, via: input.via };
}

/** Undo, inside the five-second window. No properties: the count is the event. */
export function confirmationUndoProps(): Record<string, never> {
  return {};
}

// ---------------------------------------------------------------------------
// The list
// ---------------------------------------------------------------------------

/**
 * The list was genuinely on screen with content in it.
 *
 * A DENOMINATOR, and it follows the rule `outfit_set_viewed` set: fire when the
 * thing is genuinely rendered, never when the query returned. Four of this
 * screen's states — loading, offline-with-nothing, error, empty — are reads that
 * produced no list, and counting them would inflate the denominator with exactly
 * the sessions where the product showed nothing.
 */
export function listViewedProps(input: { saveCount: number; hasCollections: boolean }): {
  save_count_bucket: CountBucket;
  has_collections: boolean;
} {
  return {
    save_count_bucket: countBucket(input.saveCount),
    has_collections: input.hasCollections,
  };
}

/**
 * A filter chip was chosen. `is_all` and nothing else.
 *
 * NOT THE COLLECTION, NOT ITS NAME, AND NOT ITS ORDINAL — see the header. The
 * question this answers is whether the filter row earns its place at all, and
 * that is a boolean.
 */
export function filterAppliedProps(isAll: boolean): { is_all: boolean } {
  return { is_all: isAll };
}

/**
 * One of the three states that stand in for a list.
 *
 * Named states rather than three events, so "how often does this screen fail to
 * show anything" is one number. `offline` and `error` are separated because they
 * are different products — one is the reader's network and one is ours.
 */
export function stateShownProps(state: SavedNonContentState): { state: SavedNonContentState } {
  return { state };
}

/** Retry, from the error screen. The numerator for whether recovery works. */
export function retryTappedProps(): Record<string, never> {
  return {};
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

/**
 * A collection was made, banded by how many the person now has.
 *
 * The bucket rather than the count, and never the name: a collection name is
 * free text somebody typed about their own life ("Wedding guest", "Interviews"),
 * which is the single most obviously identifying string in this feature.
 */
export function collectionCreatedProps(collectionCount: number): {
  collection_count_bucket: CountBucket;
} {
  return { collection_count_bucket: countBucket(collectionCount) };
}

/** A collection was renamed. No before, no after — both are user content. */
export function collectionRenamedProps(): Record<string, never> {
  return {};
}

/**
 * A collection was deleted, banded by how many looks were in it.
 *
 * The size is worth having because it is the direct read on whether the "the
 * looks inside stay in Saved" promise is doing any work: a feature whose
 * collections are always deleted empty never needed the sentence.
 */
export function collectionDeletedProps(memberCount: number): { member_count_bucket: CountBucket } {
  return { member_count_bucket: countBucket(memberCount) };
}

// ---------------------------------------------------------------------------
// The detail, and the source that went away
// ---------------------------------------------------------------------------

/**
 * A saved look was opened.
 *
 * `availability` is the reason this event exists: it is the only way to know how
 * often OS-06 is actually reached, which is the number that decides whether the
 * whole revocation path was worth building. `has_note` says whether the private
 * half of the card has anything in it — never the note.
 */
export function detailViewedProps(input: {
  availability: SavedAvailability;
  hasNote: boolean;
}): { availability: SavedAvailability; has_note: boolean } {
  return { availability: input.availability, has_note: input.hasNote };
}

/**
 * An unavailable source was SEEN — in the grid or on the detail.
 *
 * Distinct from `saved_detail_viewed` with `availability: 'unavailable'`,
 * because the grid tile counts too and never opens a detail. `source_type` is
 * the useful split: a daily look expires by design after seven days, an event
 * look does not, and an own outfit only goes when it is deleted — so three very
 * different stories arrive under one word on screen.
 */
export function sourceUnavailableSeenProps(sourceType: SavedLookSource): {
  source_type: SavedLookSource;
} {
  return { source_type: sourceType };
}

// ---------------------------------------------------------------------------
// Turning a save into a plan
// ---------------------------------------------------------------------------

/**
 * A plan was created from a save. `had_missing` is the completion question —
 * whether people go ahead with a partial look or only with a complete one.
 */
export function planCreatedProps(input: { piecesUsed: number; hadMissing: boolean }): {
  pieces_used_bucket: CountBucket;
  had_missing: boolean;
} {
  return {
    pieces_used_bucket: countBucket(input.piecesUsed),
    had_missing: input.hadMissing,
  };
}

