/**
 * The wear confirmation, as drawn and as wired. Redesign 13.
 *
 * The decisions are `tests/wear-confirm-spec.test.ts`. What is left — and what
 * this file holds — is the SHEET and its two ends: that opening writes nothing,
 * that the write is one atomic idempotent call, that a failure leaves no
 * partial row, and that the favourite never crosses into a social payload.
 *
 * Asserted as text where it must be, because esbuild cannot parse React
 * Native's Flow source and there is no renderer here. Every regex is written
 * against a line somebody would have to deliberately delete.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const SHEET_RAW = readFileSync('src/components/today/wear-confirmation-sheet.tsx', 'utf8');
const ROUTE_RAW = readFileSync('src/app/(tabs)/index.tsx', 'utf8');
const MUTATION_RAW = readFileSync('src/features/styling/mutations.ts', 'utf8');
const MIGRATION = readFileSync(
  'supabase/migrations/20260816190545_today_ratings_favorites.sql',
  'utf8',
);

/** Comments are prose about the code, not the code. Strip before grepping. */
const stripped = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const SHEET = stripped(SHEET_RAW);
const ROUTE = stripped(ROUTE_RAW);
const MUTATION = stripped(MUTATION_RAW);

// ---------------------------------------------------------------------------
// Opening writes nothing
// ---------------------------------------------------------------------------

test('the sheet performs no write of any kind', () => {
  // No mutation, no rpc, no supabase client, no analytics. It is a form until
  // the CTA is pressed, and the CTA hands its two values upward.
  assert.doesNotMatch(SHEET, /mutate\(|\.rpc\(|supabase|useMutation|track\(/);
  assert.match(SHEET, /onConfirm\(\{ rating, favorite \}\)/);
});

test('the sheet owns exactly two pieces of state, plus one presentational flag', () => {
  const states = [...SHEET.matchAll(/useState[<(]/g)];
  assert.equal(states.length, 3, `the sheet grew to ${states.length} pieces of state`);
  assert.match(SHEET, /const \[rating, setRating\] = useState<number \| null>\(initialRating\)/);
  assert.match(SHEET, /const \[favorite, setFavorite\] = useState\(initialFavorite\)/);
  // `cleared` separates "Optional" from "Cleared"; both are `null`.
  assert.match(SHEET, /const \[cleared, setCleared\] = useState\(false\)/);
});

test('the defaults are the unrated, unfavourited wear', () => {
  // Opening chooses nothing on the reader's behalf.
  assert.match(SHEET, /initialRating = null,/);
  assert.match(SHEET, /initialFavorite = false,/);
  assert.match(SHEET, /useState<number \| null>\(initialRating\)/);
  assert.match(SHEET, /useState\(initialFavorite\)/);
});

test('the shipping route passes neither seed, so production is unchanged', () => {
  // `initialRating` and `initialFavorite` exist so the dev fixtures can reach
  // five states a finger would otherwise be the only way into — `simctl` opens
  // URLs and cannot tap. The route must never use them: a sheet that opened
  // with a star already lit would be choosing on the reader's behalf, which is
  // the one thing this step may not do.
  const at = ROUTE.indexOf('<WearConfirmationSheet');
  const block = ROUTE.slice(at, ROUTE.indexOf('/>', at));
  assert.doesNotMatch(block, /initialRating|initialFavorite/, block);
});

// ---------------------------------------------------------------------------
// Cancel writes nothing
// ---------------------------------------------------------------------------

test('cancel reaches no mutation from either end', () => {
  const sheetCancel = SHEET.slice(SHEET.indexOf('onPress={onCancel}'));
  assert.doesNotMatch(sheetCancel.slice(0, 300), /mutate|onConfirm/);
  const close = ROUTE.slice(ROUTE.indexOf('const closeWearSheet'));
  assert.doesNotMatch(close.slice(0, 400), /mutate|track\(|rpc/);
});

test('every close path resets the sheet completely', () => {
  // A `wearSettled` left true would show the NEXT wear as already logged
  // before it had been.
  const close = ROUTE.slice(ROUTE.indexOf('const closeWearSheet'), ROUTE.indexOf('const handleWear'));
  for (const setter of [
    'setWearSelection(null)',
    'setWearSheetError(null)',
    'setWearSettled(false)',
    'setWearRetried(false)',
  ]) {
    assert.ok(close.includes(setter), `${setter} is missing from the close path`);
  }
});

test('all three exits go through the one close path', () => {
  for (const handler of ['onCancel', 'onSignIn', 'onDone']) {
    const at = ROUTE.indexOf(`${handler}={`);
    assert.ok(at > -1, `${handler} is not wired`);
    assert.match(ROUTE.slice(at, at + 220), /closeWearSheet/, handler);
  }
});

// ---------------------------------------------------------------------------
// Pending locks everything
// ---------------------------------------------------------------------------

test('the dismissal is withdrawn while confirming, not merely refused', () => {
  // `undefined` rather than a no-op handler: a control that looks live and
  // refuses is the dead control this app forbids.
  assert.match(SHEET, /onRequestClose=\{dismissible \? onCancel : undefined\}/);
  assert.match(SHEET, /disabled=\{!dismissible\}/);
});

test('every mutating control is disabled while confirming', () => {
  // The stars and the heart both read the same guard, so they cannot drift.
  assert.equal((SHEET.match(/disabled=\{!editable\}/g) ?? []).length, 2);
  assert.match(SHEET, /const editable = mayEdit\(phase\)/);
});

test('the route refuses a dismissal mid-write as well', () => {
  // Belt and braces: two guards, because the cost of a dismissal landing
  // mid-write is a transaction nobody is waiting for the answer to.
  const at = ROUTE.indexOf('onCancel={');
  assert.match(ROUTE.slice(at, at + 240), /if \(wear\.isPending\) return/);
});

test('the CTA swallows a second tap rather than firing twice', () => {
  assert.match(SHEET, /if \(!mayConfirm\(phase\)\) return;\s*\n\s*onConfirm/);
  assert.match(SHEET, /disabled=\{phase === 'confirming'\}/);
});

// ---------------------------------------------------------------------------
// One atomic write, one operation id
// ---------------------------------------------------------------------------

test('the write is a single transaction, not three calls', () => {
  // It used to be insert-outfit, insert-items, log-wear. A dropped connection
  // could leave an outfit with no garments in it or a wear that was never
  // counted, and a retry created a second outfit while incrementing twice.
  assert.match(MUTATION, /runCommand\('wear_outfit_tx'/);
  assert.equal((MUTATION.match(/runCommand\('wear_outfit_tx'/g) ?? []).length, 1);
  assert.doesNotMatch(MUTATION, /log_outfit_wear/);
});

test('the operation id is held across renders and settled only on success', () => {
  // The retry reuses it, which is the only thing that makes the command
  // idempotent: a repeat returns the original outfit id instead of creating a
  // second wear and double-incrementing every count.
  assert.match(MUTATION, /useRef\(createOperationIds\(\)\)\.current/);
  assert.match(MUTATION, /p_op_id: opIds\.for\(actionKey\)/);
  const settleAt = MUTATION.indexOf('opIds.settle(actionKey)');
  const throwAt = MUTATION.indexOf('throw new WearMutationError(classifyWearFailure(error), error)');
  assert.ok(throwAt > -1 && settleAt > throwAt, 'the id is settled before the call can fail');
  assert.equal((MUTATION.match(/opIds\.settle\(actionKey\)/g) ?? []).length, 1);
});

test('the operation key is the garments, so the same outfit twice is one retry', () => {
  assert.match(MUTATION, /const actionKey = itemIds\.join\('\.'\)/);
});

test('a retry is reported to the reader as one wear', () => {
  assert.match(ROUTE, /if \(wearSheetError !== null\) setWearRetried\(true\)/);
  assert.match(ROUTE, /idempotent=\{wearRetried\}/);
});

test('an unrated confirm sends null rather than a manufactured rating', () => {
  // `?? undefined` reaches the RPC's own default, which is null. A zero here
  // would be a rating nobody gave.
  assert.match(MUTATION, /p_wear_rating: rating \?\? undefined/);
  assert.match(MUTATION, /rating = null,/);
  assert.match(MUTATION, /favorite = false,/);
  assert.doesNotMatch(MUTATION, /rating \?\? 0|rating \|\| 0|rating \?\? 3/);
});

// ---------------------------------------------------------------------------
// The server is the authority
// ---------------------------------------------------------------------------

test('the RPC is security-invoker and refuses anon', () => {
  // Security INVOKER, so RLS still authorises every row against the caller —
  // a definer function here would make the client's guard the only guard.
  assert.doesNotMatch(MIGRATION, /security definer/i);
  assert.match(MIGRATION, /revoke execute on function public\.wear_outfit_tx/);
  assert.match(MIGRATION, /grant execute on function public\.wear_outfit_tx/);
});

test('the rating range is enforced in the column AND in the function', () => {
  assert.match(MIGRATION, /check \(wear_rating between 1 and 5\)/);
  assert.match(MIGRATION, /p_wear_rating not between 1 and 5/);
  // Zero is outside the range on purpose: it can never be read as the low end.
  assert.doesNotMatch(MIGRATION, /between 0 and 5/);
});

test('the client preflight is named as a preflight, not as the authority', () => {
  // Asserted on the raw source: this one IS a comment, and it is load-bearing
  // — the next person to read `getSession()` here needs to know it is a
  // courtesy refusal and not the gate.
  assert.match(MUTATION_RAW, /not the write authority/i);
  assert.match(MUTATION_RAW, /Postgres RLS still authorizes every row/i);
  // And the real authority is the RPC carrying the JWT, not this check.
  assert.match(MUTATION, /runCommand\('wear_outfit_tx'/);
});

// ---------------------------------------------------------------------------
// The favourite never becomes social
// ---------------------------------------------------------------------------

test('favorited_at is owner-private and indexed as such', () => {
  assert.match(MIGRATION, /favorited_at timestamptz/);
  assert.match(MIGRATION, /on public\.outfits \(user_id, favorited_at desc\)/);
});

test('no social view in any migration ever selects rating or favourite', () => {
  // Verified against the live database too: `public_outfits` carries
  // (id, user_id, name, occasion, created_at) and `friend_worn_outfits`
  // carries (id, user_id, name, worn_at). Neither has ever had these columns.
  //
  // What this asserts is the thing a schema check cannot: that no migration in
  // the repo ADDS one to a social surface. It reads every view definition that
  // mentions a social view name and refuses either column inside it.
  const SOCIAL = ['public_outfits', 'friend_worn_outfits', 'daily_look', 'public_items'];
  const files = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql'));
  const offenders: string[] = [];
  for (const f of files) {
    const sql = readFileSync(`supabase/migrations/${f}`, 'utf8');
    // Each `create ... view <name> as ...` block, up to the statement end.
    for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?view\s+(?:public\.)?(\w+)([\s\S]*?);/gi)) {
      const [, name, body] = m;
      if (!SOCIAL.some((v) => name!.includes(v))) continue;
      if (/wear_rating|favorited_at/i.test(body!)) offenders.push(`${f} → ${name}`);
    }
  }
  assert.deepEqual(offenders, [], `a social view exposes owner-private fields:\n${offenders.join('\n')}`);
  assert.ok(files.length > 50, 'the migration sweep found almost nothing to check');
});

test('neither value reaches an analytics payload', () => {
  // `rating_set` and `favorite_set` carry booleans. The NUMBER never travels,
  // and neither does the outfit it belongs to.
  assert.match(ROUTE, /ratingSetProps\(rating !== null\)/);
  assert.match(ROUTE, /favoriteSetProps\(favorite\)/);
  assert.doesNotMatch(ROUTE, /ratingSetProps\(rating\)/);
  const calls = ROUTE.match(/track\([\s\S]{0,160}?\)/g) ?? [];
  for (const c of calls) {
    assert.doesNotMatch(c, /outfitName|garment|\.id\b|resolve\(|note|wear_rating|favorited/, c);
  }
});

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

test('the sheet announces itself as a modal with a name', () => {
  assert.match(SHEET, /accessibilityViewIsModal/);
  assert.match(SHEET, /accessibilityLabel=\{WEAR_COPY\.sheetTitle\}/);
});

test('the focus order runs outfit → rating → favourite → commit → cancel', () => {
  // ── THE ACCEPTED ARTIFACT DISAGREES WITH ITSELF HERE ────────────────────
  //
  // Twenty-seven frames draw Cancel BELOW the filled CTA. The VoiceOver
  // overlay frame numbers it 2, before the collage. Both cannot be true: on
  // iOS, reading order follows layout, and RN core offers no supported way to
  // reorder VoiceOver independently of it.
  //
  // The drawn frames win, because they are what was accepted twenty-seven
  // times over and what the simulator evidence is compared against. The cost
  // is smaller than it looks: `onRequestClose` is wired, so VoiceOver's
  // two-finger scrub dismisses the sheet from ANY element — a reader has an
  // escape at every point in the list, which is a stronger guarantee than
  // having the button second in it.
  const at = (needle: string) => {
    const i = SHEET.indexOf(needle);
    assert.ok(i > -1, `${needle} is not on the sheet`);
    return i;
  };
  const collage = at('accessibilityRole="image"');
  const rating = at('accessibilityRole="radiogroup"');
  const favorite = at('accessibilityRole="switch"');
  const cta = at('onConfirm({ rating, favorite })');
  const cancel = at('accessibilityLabel={WEAR_COPY.cancel}');
  assert.ok(collage < rating, 'the rating is read before the outfit');
  assert.ok(rating < favorite, 'the favourite is read before the rating');
  assert.ok(favorite < cta, 'the commit is read before the favourite');
  assert.ok(cta < cancel, 'cancel is drawn above the commit');

  // The sheet still NAMES itself on presentation — that is the overlay's
  // item 1, and it is an announcement rather than a drawn heading.
  assert.match(SHEET, /accessibilityLabel=\{WEAR_COPY\.sheetTitle\}/);
  assert.doesNotMatch(SHEET, /accessibilityRole="header"/, 'the title was drawn as a heading');

  // And the escape works from anywhere while the sheet is dismissible.
  assert.match(SHEET, /onRequestClose=\{dismissible \? onCancel : undefined\}/);
});

test('the outfit is one element rather than five cells', () => {
  assert.match(SHEET, /accessible\s*\n\s*accessibilityRole="image"\s*\n\s*accessibilityLabel=\{collageLabel/);
});

test('each star announces its value and whether it is chosen', () => {
  assert.match(SHEET, /accessibilityLabel=\{`\$\{star\} of 5 stars`\}/);
  assert.match(SHEET, /accessibilityState=\{\{ selected: rating === star, disabled: !editable \}\}/);
});

test('the favourite announces its state and its privacy in one breath', () => {
  assert.match(SHEET, /accessibilityRole="switch"/);
  assert.match(SHEET, /accessibilityLabel=\{`\$\{WEAR_COPY\.favorite\}\. \$\{WEAR_COPY\.favoritePrivate\}`\}/);
  assert.match(SHEET, /accessibilityState=\{\{ checked: favorite/);
});

test('progress is announced and the settled wear is announced exactly once', () => {
  assert.match(SHEET, /accessibilityState=\{\{ busy: phase === 'confirming'/);
  assert.match(SHEET, /announced\.current = true/);
  assert.match(SHEET, /AccessibilityInfo\.announceForAccessibility\(/);
  assert.equal((SHEET.match(/announceForAccessibility\(/g) ?? []).length, 1);
});

test('both the failure and the settled mark are alerts', () => {
  assert.equal((SHEET.match(/accessibilityRole="alert"/g) ?? []).length, 2);
});

// ---------------------------------------------------------------------------
// Motion and haptics
// ---------------------------------------------------------------------------

test('Reduce Motion replaces the settle travel with a cross-fade', () => {
  assert.match(SHEET, /const reduced = useReducedMotion\(\)/);
  assert.match(SHEET, /animationType=\{reduced \? 'fade' : 'slide'\}/);
});

test('the composition and the feedback are identical under Reduce Motion', () => {
  // Only the arriving changes. Nothing branches on `reduced` except the
  // animation type — no state, no copy, no haptic, no layout.
  const uses = [...SHEET.matchAll(/\breduced\b/g)];
  assert.equal(uses.length, 2, `reduced is read ${uses.length} times`);
});

test('three haptics, each on an authoritative transition and none before one', () => {
  const calls = SHEET.match(/haptics\.\w+\(\)/g) ?? [];
  assert.deepEqual(calls.sort(), ['haptics.selection()', 'haptics.selection()', 'haptics.success()']);
  // The commit buzz fires AFTER the transaction settles, never on the tap.
  assert.match(SHEET, /if \(!settled\)[\s\S]{0,300}haptics\.success\(\)/);
  // Nothing on open, cancel, error or retry start.
  const cancelAt = SHEET.indexOf('onPress={onCancel}');
  assert.doesNotMatch(SHEET.slice(cancelAt, cancelAt + 200), /haptics\./);
});

test('haptics go through the policy module, never expo-haptics directly', () => {
  assert.match(SHEET_RAW, /from '@\/lib\/haptics'/);
  assert.doesNotMatch(SHEET_RAW, /from 'expo-haptics'/);
});

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

test('no new package, permission, vendor or billing surface', () => {
  assert.doesNotMatch(SHEET_RAW, /expo-location|expo-notifications|expo-contacts|Superwall|Placement|useGate/);
  assert.doesNotMatch(SHEET_RAW, /requestPermission|Permissions\./);
});

test('the CTA is pinned outside the scroll region', () => {
  // What a 667pt screen and an AX-XXXL reader both depend on: the sheet
  // scrolls and the commit does not.
  const scrollEnd = SHEET.indexOf('</ScrollView>');
  const ctaAt = SHEET.lastIndexOf('onConfirm({ rating, favorite })');
  assert.ok(scrollEnd > -1 && ctaAt > scrollEnd, 'the CTA can scroll off screen');
});
