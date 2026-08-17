/**
 * The daily read: what it contains, in what order, where it ends, and what it
 * is forbidden to say.
 *
 * Three of these are ordinary list logic and the fourth is the reason the file
 * exists. A look whose pieces were hidden by their owner renders short, and the
 * one thing this surface must never do is count what is missing — no "1 piece
 * hidden", no "and more", no VoiceOver label that mentions it. That is not a
 * rendering preference: a count of hidden pieces is an inference about somebody
 * else's privacy settings, delivered to the exact person they hid them from.
 * The assertions below execute the real functions and then read the real source
 * for the words that would give it away.
 *
 * The pure half of the unit lives in `feed.ts` and `analytics.ts` deliberately,
 * for the reason `visibility-flags.ts` is separate from `use-closet-visibility.
 * ts`: `queries.ts` imports the Supabase client and `reactions.ts` imports the
 * analytics client, and neither can be executed by this runner. What cannot be
 * executed is asserted against its source instead, which is the weaker of the
 * two and used only where the stronger is unavailable.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  closetVisibilityChangedProps,
  DAILY_SOCIAL_EVENTS,
  dailySocialCompletedProps,
  dailySocialEmptyProps,
  dailySocialOpenedProps,
  dailySocialReactedProps,
  wornSharingChangedProps,
} from '@/features/daily-social/analytics';
import {
  assembleDailyLooks,
  CAUGHT_UP_LINE,
  DAILY_LOOKS_LIMIT,
  reachedDailyEnd,
  showsDailyCaughtUp,
  type WornLookEntry,
  type WornPieceEntry,
} from '@/features/daily-social/feed';
import { DAILY_REACTIONS, isDailyReaction } from '@/features/daily-social/types';

/** Source with comments stripped — the prose explains the traps, the code is the claim. */
const body = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

const raw = (path: string) => readFileSync(path, 'utf8');

/**
 * The migration WITHOUT its `--` prose.
 *
 * Not fastidiousness. That file's comments quote the schema it rejected —
 * "`outfit_reactions` … its domain is `check (reaction in (-1, 1))`" — so a
 * structural assertion read against the raw text matches the counter-example
 * instead of the constraint, passes or fails for the wrong reason, and would
 * have let a `(-1, 1)` domain through while reporting green.
 */
const MIGRATION = raw('supabase/migrations/20260817000000_daily_social.sql')
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n');
const FEATURE_DIR = 'src/features/daily-social';
const FEATURE_FILES = readdirSync(FEATURE_DIR).map((name) => `${FEATURE_DIR}/${name}`);

const look = (outfitId: string, wornAt: string, ownerId = `owner-${outfitId}`): WornLookEntry => ({
  outfitId,
  ownerId,
  name: null,
  wornAt,
});

const piece = (outfitId: string, itemId: string): WornPieceEntry => ({
  outfitId,
  itemId,
  // Named, because the atlas's outfit line names them and the collage is hidden
  // from VoiceOver so that it cannot. A name is not a count.
  name: `A ${itemId}`,
  thumbPath: `${itemId}/thumb.jpg`,
  cutoutPath: null,
  platePath: null,
});

// ---------------------------------------------------------------------------
// 1 · Ordering — most recently WORN first
// ---------------------------------------------------------------------------

test('looks come back most recently worn first', () => {
  const looks = [
    look('a', '2026-08-14T09:00:00+00:00'),
    look('b', '2026-08-16T09:00:00+00:00'),
    look('c', '2026-08-15T09:00:00+00:00'),
  ];
  assert.deepEqual(
    assembleDailyLooks(looks, []).map((l) => l.outfitId),
    ['b', 'c', 'a'],
  );
});

test('the order is worn_at and nothing else — arrival order is not a tiebreak', () => {
  // The rows arrive from a view with no `created_at` on it. A list that
  // silently fell back to arrival order would look right on a server that
  // happened to order by worn_at and wrong the day it stopped.
  const looks = [look('z', '2026-08-10T00:00:00+00:00'), look('a', '2026-08-11T00:00:00+00:00')];
  assert.deepEqual(
    assembleDailyLooks(looks, []).map((l) => l.outfitId),
    ['a', 'z'],
  );
});

test('two looks worn in the same instant order deterministically', () => {
  // Not cosmetic. Without a tiebreak the pair lands in whatever order the sort
  // happened to be stable in, and a list that reshuffles between refetches of
  // identical data reads as a list that is changing.
  const same = '2026-08-16T09:00:00+00:00';
  const forwards = assembleDailyLooks([look('b', same), look('a', same)], []);
  const backwards = assembleDailyLooks([look('a', same), look('b', same)], []);
  assert.deepEqual(
    forwards.map((l) => l.outfitId),
    ['a', 'b'],
  );
  assert.deepEqual(
    backwards.map((l) => l.outfitId),
    forwards.map((l) => l.outfitId),
  );
});

test('sub-second precision still sorts chronologically as text', () => {
  // Postgres serialises timestamptz to a fixed-width ISO string in one
  // timezone, which is why the sort compares strings rather than parsing dates
  // — the same reasoning `laterOf` in social-graph/queries.ts relies on.
  const looks = [
    look('early', '2026-08-16T09:00:00+00:00'),
    look('late', '2026-08-16T09:00:00.5+00:00'),
  ];
  assert.deepEqual(
    assembleDailyLooks(looks, []).map((l) => l.outfitId),
    ['late', 'early'],
  );
});

// ---------------------------------------------------------------------------
// 2 · One look per outfit
// ---------------------------------------------------------------------------

test('an outfit repeated in the response is one look, not several', () => {
  const repeated = look('a', '2026-08-16T09:00:00+00:00');
  const assembled = assembleDailyLooks([repeated, repeated, repeated], []);
  assert.equal(assembled.length, 1);
  assert.equal(assembled[0].outfitId, 'a');
});

test('a look carries its own pieces and nobody else’s', () => {
  const looks = [look('a', '2026-08-16T09:00:00+00:00'), look('b', '2026-08-15T09:00:00+00:00')];
  const pieces = [piece('a', 'shirt'), piece('b', 'boot'), piece('a', 'coat')];
  const assembled = assembleDailyLooks(looks, pieces);
  assert.deepEqual(
    assembled[0].pieces.map((p) => p.itemId),
    ['shirt', 'coat'],
  );
  assert.deepEqual(
    assembled[1].pieces.map((p) => p.itemId),
    ['boot'],
  );
});

test('pieces keep the order they arrived in — the owner assembled the look', () => {
  const pieces = [piece('a', 'third'), piece('a', 'first'), piece('a', 'second')];
  assert.deepEqual(
    assembleDailyLooks([look('a', '2026-08-16T09:00:00+00:00')], pieces)[0].pieces.map(
      (p) => p.itemId,
    ),
    ['third', 'first', 'second'],
  );
});

test('the same garment twice in one look is drawn once', () => {
  const pieces = [piece('a', 'shirt'), piece('a', 'shirt')];
  assert.equal(assembleDailyLooks([look('a', '2026-08-16T09:00:00+00:00')], pieces)[0].pieces.length, 1);
});

// ---------------------------------------------------------------------------
// 3 · Finiteness — the unit ends
// ---------------------------------------------------------------------------

test('the day is bounded, and the bound keeps the most recent looks', () => {
  // The seven-day window and the mutual-only gate are SQL's job. This bound is
  // the finiteness one: the contract forbids pagination, so a ceiling the
  // reader can actually reach is what makes "it ends" true rather than meant.
  const looks = Array.from({ length: 60 }, (_, i) =>
    look(`o${String(i).padStart(2, '0')}`, `2026-06-${String(i + 1).padStart(2, '0')}T09:00:00+00:00`),
  );
  const assembled = assembleDailyLooks(looks, []);
  assert.equal(assembled.length, DAILY_LOOKS_LIMIT);
  // The newest survive, not the first forty the server happened to send.
  assert.equal(assembled[0].outfitId, 'o59');
  assert.equal(assembled[DAILY_LOOKS_LIMIT - 1].outfitId, `o${60 - DAILY_LOOKS_LIMIT}`);
});

test('a limit of zero or below is an empty day rather than an unbounded one', () => {
  const looks = [look('a', '2026-08-16T09:00:00+00:00')];
  assert.deepEqual(assembleDailyLooks(looks, [], 0), []);
  assert.deepEqual(assembleDailyLooks(looks, [], -5), []);
});

test('pieces belonging to no surviving look are dropped, not left loose', () => {
  const looks = [look('a', '2026-08-16T09:00:00+00:00'), look('b', '2026-08-15T09:00:00+00:00')];
  const assembled = assembleDailyLooks(looks, [piece('a', 'shirt'), piece('b', 'boot')], 1);
  assert.equal(assembled.length, 1);
  assert.deepEqual(
    assembled[0].pieces.map((p) => p.itemId),
    ['shirt'],
  );
});

test('duplicate rows cannot consume a slot under the limit', () => {
  const a = look('a', '2026-08-16T09:00:00+00:00');
  const b = look('b', '2026-08-15T09:00:00+00:00');
  assert.deepEqual(
    assembleDailyLooks([a, a, b], [], 2).map((l) => l.outfitId),
    ['a', 'b'],
  );
});

// ---------------------------------------------------------------------------
// 4 · A short look is just a short look
// ---------------------------------------------------------------------------

test('a look whose every piece is hidden is still a look', () => {
  // `friend_worn_outfit_items` routes through `friend_items`, so an owner who
  // has hidden their closet contributes a look with no pieces at all. Dropping
  // it would be a count of one, told by omission.
  const assembled = assembleDailyLooks([look('a', '2026-08-16T09:00:00+00:00')], []);
  assert.equal(assembled.length, 1);
  assert.deepEqual(assembled[0].pieces, []);
});

test('a partially hidden look carries only what crossed, and no record of the rest', () => {
  const assembled = assembleDailyLooks(
    [look('a', '2026-08-16T09:00:00+00:00')],
    [piece('a', 'shirt')],
  );
  // The returned object's own keys are the whole interface. Anything naming a
  // hidden, missing or total count would have to be here to be rendered.
  assert.deepEqual(Object.keys(assembled[0]).sort(), [
    'name',
    'outfitId',
    'ownerId',
    'pieces',
    'wornAt',
  ]);
});

test('nothing in the feature counts, infers or names a hidden piece', () => {
  for (const file of FEATURE_FILES) {
    const src = body(file);
    assert.doesNotMatch(
      src,
      /hiddenCount|hiddenPieces|missingCount|piecesHidden|andMore|totalPieces/i,
      `${file} names a count of what is missing`,
    );
  }
});

// ---------------------------------------------------------------------------
// 5 · The caught-up boundary
// ---------------------------------------------------------------------------

test('the closure line prints only under a loaded, non-empty day', () => {
  assert.equal(showsDailyCaughtUp({ isError: false, isLoading: false, lookCount: 3 }), true);
  // Over a failed read it would assert a quiet circle when the circle could
  // not be read at all — S-5 is not S-2.
  assert.equal(showsDailyCaughtUp({ isError: true, isLoading: false, lookCount: 3 }), false);
  assert.equal(showsDailyCaughtUp({ isError: false, isLoading: true, lookCount: 0 }), false);
  // The empty states have their own sentences; an ending over nothing is furniture.
  assert.equal(showsDailyCaughtUp({ isError: false, isLoading: false, lookCount: 0 }), false);
});

test('the ending is Explore’s sentence, not a second one that starts identical', () => {
  assert.equal(CAUGHT_UP_LINE, 'You’re caught up with your circle.');
  assert.match(body('src/features/daily-social/feed.ts'), /from '@\/features\/explore\/feed'/);
  // No count, no urgency, nothing suggesting more exists.
  assert.doesNotMatch(CAUGHT_UP_LINE, /\d/);
  assert.doesNotMatch(CAUGHT_UP_LINE, /more|load|new posts/i);
});

test('reaching the end of nothing is not completion', () => {
  assert.equal(reachedDailyEnd(0, 0), false);
  assert.equal(reachedDailyEnd(3, 3), true);
  assert.equal(reachedDailyEnd(1, 3), false);
  assert.equal(reachedDailyEnd(4, 3), true);
});

// ---------------------------------------------------------------------------
// 6 · Exactly three reactions, and the database agrees
// ---------------------------------------------------------------------------

test('there are exactly three reactions, in a fixed order', () => {
  assert.deepEqual([...DAILY_REACTIONS], ['sharp', 'cozy', 'noted']);
});

test('the three the client knows are the three the check constraint allows', () => {
  const match = MIGRATION.match(/check \(reaction in \(([^)]*)\)\)/);
  assert.ok(match, 'the migration no longer constrains `reaction`');
  const allowed = match[1].split(',').map((part) => part.trim().replace(/'/g, ''));
  assert.deepEqual(allowed.sort(), [...DAILY_REACTIONS].sort());
});

test('a fourth reaction, and anything negative, is not one of the three', () => {
  for (const value of ['meh', 'dislike', -1, 1, '', null, undefined]) {
    assert.equal(isDailyReaction(value), false, `${String(value)} was accepted`);
  }
  for (const value of DAILY_REACTIONS) assert.equal(isDailyReaction(value), true);
});

test('changing your mind is one row — no count column, no aggregate view', () => {
  assert.match(MIGRATION, /primary key \(outfit_id, reactor_id\)/);
  assert.doesNotMatch(MIGRATION, /create view daily_social_reaction/i);
  assert.doesNotMatch(MIGRATION, /count\b[^)]*\bfrom public\.daily_social_reactions/i);

  const src = body('src/features/daily-social/reactions.ts');
  assert.match(src, /onConflict: 'outfit_id,reactor_id'/);
  // Nothing tallies. `.length`, a count column or a group-by here would be the
  // audience this unit exists not to build.
  assert.doesNotMatch(src, /\.length|reactionCount|totalReactions|group\(/);
});

// ---------------------------------------------------------------------------
// 7 · Four columns cross, and nothing else can
// ---------------------------------------------------------------------------

test('the read path selects the four columns the view projects, and no fifth', () => {
  assert.match(
    MIGRATION,
    /select o\.id,\s*\n\s*o\.user_id,\s*\n\s*o\.name,\s*\n\s*o\.worn_at\s*\n\s*from outfits o/,
  );
  assert.match(body('src/features/daily-social/queries.ts'), /'id, user_id, name, worn_at'/);
});

test('no module in the feature names a column the contract keeps private', () => {
  // Every one of these is attached to the same outfit somewhere else in the
  // app, which is exactly why the list is written out rather than trusted to
  // the view: a widened select is one word, and this fails on it.
  const forbidden =
    /reasoning|context_snapshot|wear_rating|favorited_at|saved_at|board_id|origin_outfit_id|cost_per_wear|\bweather\b|\boccasion\b/;
  for (const file of FEATURE_FILES) {
    assert.doesNotMatch(body(file), forbidden, `${file} reaches for a private column`);
  }
});

test('pieces come from friend_items and from nowhere else', () => {
  const src = body('src/features/daily-social/queries.ts');
  assert.match(src, /\.from\('friend_items'\)/);
  // `items` is the owner's own table and carries no friendship gate at all.
  assert.doesNotMatch(src, /\.from\('items'\)|\.from\('outfits'\)|\.from\('outfit_items'\)/);
});

test('the client applies no friendship, sharing or expiry predicate of its own', () => {
  // All four are in the view. A client-side date filter would be a courtesy —
  // the house rule from `unwear_outfit_tx` — and a client-side friendship test
  // would be a second source of truth for a thing `is_friend()` already
  // decides per row.
  const src = body('src/features/daily-social/queries.ts');
  assert.doesNotMatch(src, /\.gte\(|\.lte\(|\.gt\(|\.lt\(|is_friend|Date\.now\(\)|interval/);
});

test('the two views are read through the cast client, never invented locally', () => {
  const client = body('src/features/daily-social/client.ts');
  assert.match(client, /'friend_worn_outfits'/);
  assert.match(client, /'friend_worn_outfit_items'/);
  // The generated types are not hand-edited; the cast is the interim.
  for (const file of FEATURE_FILES) {
    assert.doesNotMatch(body(file), /database\.types|types\/database/, `${file} edits generated types`);
  }
});

// ---------------------------------------------------------------------------
// 8 · Analytics — six events, and not one identifier
// ---------------------------------------------------------------------------

test('the six events are the six the contract names', () => {
  assert.deepEqual([...Object.values(DAILY_SOCIAL_EVENTS)].sort(), [
    'closet_visibility_changed',
    'daily_social_completed',
    'daily_social_empty',
    'daily_social_opened',
    'daily_social_reacted',
    'worn_outfits_sharing_changed',
  ]);
});

test('every one of them is a member of the closed AppEvent union', () => {
  const posthog = raw('src/lib/posthog.tsx');
  for (const event of Object.values(DAILY_SOCIAL_EVENTS)) {
    assert.match(posthog, new RegExp(`\\| '${event}'`), `${event} is not in AppEvent`);
  }
});

test('no property carries a user, friend, outfit or item id', () => {
  // Executed, not described: these are the real builders, and the assertion is
  // on the key set they produce.
  const payloads: Record<string, unknown>[] = [
    dailySocialOpenedProps({ state: 'S-3', lookCount: 4 }),
    dailySocialCompletedProps({ itemsSeen: 4, reachedEnd: true }),
    dailySocialReactedProps('sharp'),
    closetVisibilityChangedProps('costPerWearVisible', false),
    wornSharingChangedProps(true),
    dailySocialEmptyProps('nobody_sharing'),
  ];
  for (const payload of payloads) {
    for (const [key, value] of Object.entries(payload)) {
      assert.doesNotMatch(key, /_id$|^id$|user|friend|outfit|item_id|owner/i, `${key} names a person or a thing`);
      assert.ok(
        typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean',
        `${key} is not a bounded scalar`,
      );
    }
  }
});

test('each event carries exactly the properties §5.6 specifies', () => {
  assert.deepEqual(Object.keys(dailySocialOpenedProps({ state: 'S-1b', lookCount: 0 })).sort(), [
    'item_count',
    'state',
  ]);
  assert.deepEqual(
    Object.keys(dailySocialCompletedProps({ itemsSeen: 2, reachedEnd: false })).sort(),
    ['items_seen', 'reached_end'],
  );
  assert.deepEqual(Object.keys(dailySocialReactedProps('cozy')), ['reaction']);
  assert.deepEqual(Object.keys(closetVisibilityChangedProps('closetVisible', true)).sort(), [
    'flag',
    'hidden',
  ]);
  assert.deepEqual(Object.keys(wornSharingChangedProps(false)), ['shared']);
  assert.deepEqual(Object.keys(dailySocialEmptyProps('quiet_day')), ['reason']);
});

test('the reaction event carries which of the three and nothing about who', () => {
  assert.deepEqual(dailySocialReactedProps('noted'), { reaction: 'noted' });
});

test('the visibility event reports the column, and inverts the switch exactly once', () => {
  assert.deepEqual(closetVisibilityChangedProps('costPerWearVisible', false), {
    flag: 'stat_cost_per_wear_hidden',
    hidden: true,
  });
  assert.deepEqual(closetVisibilityChangedProps('closetVisible', true), {
    flag: 'closet_hidden',
    hidden: false,
  });
});

test('the three emptinesses stay three, because only one of them is a content problem', () => {
  for (const reason of ['no_friends', 'nobody_sharing', 'quiet_day'] as const) {
    assert.deepEqual(dailySocialEmptyProps(reason), { reason });
  }
});

test('nothing fires on viewing a particular friend’s look', () => {
  // The absence is the design. Such an event would rebuild a record of who
  // looks at whom, in a third-party analytics store.
  const posthog = raw('src/lib/posthog.tsx');
  assert.doesNotMatch(posthog, /'daily_social_look_viewed'|'daily_social_viewed'|'friend_look_/);
  for (const file of FEATURE_FILES) {
    assert.doesNotMatch(body(file), /look_viewed|look_seen|profile_viewed/i, `${file} measures a look view`);
  }
});
