/**
 * Redesign 30 — the two membership pages, and the things neither may say.
 *
 * ── WHY THIS TEST IS THE LOAD-BEARING ONE ─────────────────────────────────
 *
 * This is the only page pair in the app that is about somebody's money, and
 * every rule on it is a rule of ABSENCE: no price, no term, no per-month
 * arithmetic, no saving, no proration figure, no trial promise, no guessed
 * date, and no "free" drawn over a read that failed. Absence is exactly the
 * kind of rule that rots silently — a currency symbol typed into a layout
 * reads perfectly and ships, and it is wrong in every country but one.
 *
 * `tests/upgrade-delta.test.ts` already sweeps MB-09's own strings. This
 * sweeps the redesign's NEW surface: the spec module, both parts files, both
 * bodies, both routes, and every `dev-mm-*` fixture.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

import { PLANS } from '../src/features/billing/plans';
import { canUpgrade, upgradeDelta } from '../src/features/billing/upgrade-delta';
import {
  CANCEL_ROW_MARK,
  CAPACITY_KICKER,
  capacityAdvice,
  capacityRows,
  CHANGE_KICKER,
  deltaSpoken,
  endingNote,
  freeLinePhrase,
  MASTHEAD_CHECKING,
  MASTHEAD_UNREAD,
  mastheadTier,
  membershipDateLong,
  NEAR_LIMIT_SLOTS,
  PAID_MARK_PREFIX,
  PRO_IS_LARGEST,
  RESTORE_FAILED,
  RESTORE_NONE,
  restoreRestored,
  termMark,
  TRIAL_MARK_PREFIX,
  UNCONFIRMED_BODY,
  UNCONFIRMED_TITLE,
  UPGRADE_DECLINED,
  UPGRADE_HEADLINE,
  UPGRADE_OPENING,
  UPGRADE_PRORATION_TITLE,
  UPGRADE_REFUSED_TITLE,
  upgradeRefusedBody,
  UPGRADE_ROW_SUBLABEL,
} from '../src/features/membership/manage-membership-spec';

const STANDARD = PLANS.standard;

// ---------------------------------------------------------------------------
// 1 · The masthead states nothing it has not read
// ---------------------------------------------------------------------------

test('the term mark is dropped whole when no date has been read', () => {
  // Not softened into "until the end of your term" — that sounds like a fact
  // and is a paraphrase of a value nobody has.
  assert.equal(termMark({ trialing: false, trialEndsAt: null, currentPeriodEnd: null }), '');
  assert.equal(termMark({ trialing: true, trialEndsAt: null, currentPeriodEnd: null }), '');
});

test('a paid term and a trial term are told apart, and both carry the year', () => {
  const end = new Date('2026-09-14T12:00:00Z');
  const paid = termMark({ trialing: false, trialEndsAt: null, currentPeriodEnd: end });
  assert.ok(paid.startsWith(PAID_MARK_PREFIX), paid);
  assert.ok(paid.includes('2026'), paid);

  const trial = termMark({ trialing: true, trialEndsAt: end, currentPeriodEnd: end });
  assert.ok(trial.startsWith(TRIAL_MARK_PREFIX), trial);
  // A trialing account still has a `currentPeriodEnd` in flight; the trial's
  // own clock is the one that governs, and the paid mark must not win.
  assert.ok(!trial.startsWith(PAID_MARK_PREFIX), trial);
});

test('the trial mark reports a stored date and never offers one', () => {
  // Correction 06, and independently true of the products: all four are
  // `trial_period_days: null`. The only trial this app may name is the one the
  // SERVER already granted and wrote down.
  assert.doesNotMatch(TRIAL_MARK_PREFIX, /start|free|days|offer/i);
  assert.match(TRIAL_MARK_PREFIX, /^TRIAL THROUGH$/);
});

test('the plate never guesses a tier', () => {
  assert.equal(mastheadTier(PLANS.pro), `Cinch ${PLANS.pro.name}`);
  // Neither of the two unread plates names a tier at all, and neither says
  // "Free" — `usePlan()` resolves a missing row to free as a least-privilege
  // default, and printing it would present that default as a confirmed fact.
  for (const s of [MASTHEAD_CHECKING, MASTHEAD_UNREAD]) {
    assert.doesNotMatch(s, /free|standard|pro/i, s);
  }
});

test('the long date carries a year where the settings row deliberately does not', () => {
  const s = membershipDateLong(new Date('2027-03-02T12:00:00Z'));
  assert.match(s, /2027/);
});

// ---------------------------------------------------------------------------
// 2 · The counts, and the ceilings they are measured against
// ---------------------------------------------------------------------------

test('every figure derives from PLANS rather than being typed', () => {
  const rows = capacityRows({ copy: STANDARD, used: 88, stored: 214 });
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.value, `88 of ${STANDARD.items.toLocaleString('en-US')}`);
  assert.equal(rows[1]!.value, `214 of ${STANDARD.storedItems.toLocaleString('en-US')}`);
  assert.equal(rows[0]!.limit, STANDARD.items);
  assert.equal(rows[1]!.limit, STANDARD.storedItems);
});

test('a count in flight draws no row at all — a pending count is not a zero', () => {
  assert.deepEqual(capacityRows({ copy: STANDARD, used: null, stored: null }), []);
  assert.equal(capacityRows({ copy: STANDARD, used: 4, stored: null }).length, 1);
});

test('only the two entitlements the client can count are drawn', () => {
  // Correction 36. Stylist chats and hosted events are real product promises
  // with no client-side counter behind them, and a counter with no read is a
  // number the screen makes up.
  const labels = capacityRows({ copy: STANDARD, used: 1, stored: 1 }).map((r) => r.label);
  assert.deepEqual(labels, ['Active pieces', 'Stored pieces']);
});

test('the meter fraction is clamped and never divides by a zero ceiling', () => {
  // An over-ceiling closet is a real state — a downgrade leaves one — and a
  // fill wider than its track is a layout bug in a billing surface.
  const over = capacityRows({ copy: STANDARD, used: STANDARD.items * 2, stored: 0 });
  assert.equal(over[0]!.fraction, 1);
  assert.equal(capacityRows({ copy: STANDARD, used: 0, stored: 0 })[0]!.fraction, 0);
});

test('each capacity row speaks as one composed sentence', () => {
  const [active] = capacityRows({ copy: STANDARD, used: 88, stored: 214 });
  assert.equal(active!.spoken, `Active pieces, 88 of ${STANDARD.items}.`);
});

// ---------------------------------------------------------------------------
// 3 · The advice, and the remedy that actually exists
// ---------------------------------------------------------------------------

test('no advice is offered until a ceiling is genuinely close', () => {
  assert.equal(capacityAdvice({ copy: STANDARD, used: 10, stored: 20 }), null);
  assert.equal(capacityAdvice({ copy: STANDARD, used: null, stored: null }), null);
});

test('the active card names the remedy that works, and implies no deletion', () => {
  const advice = capacityAdvice({
    copy: STANDARD,
    used: STANDARD.items - 2,
    stored: 0,
  });
  assert.match(advice!.title, /^Two active slots left$/);
  assert.match(advice!.body, /Storing a piece frees an active slot/);
  assert.doesNotMatch(advice!.body, /delete|remove from|lost/i);
});

test('the stored card offers no remedy, because storing more does not help', () => {
  // The stored ceiling counts every piece on the account, so "make room" is
  // the dead end `use-capacity.ts` split its two counts to remove.
  const advice = capacityAdvice({
    copy: STANDARD,
    used: 0,
    stored: STANDARD.storedItems - 3,
  });
  assert.match(advice!.title, /^Three stored slots left$/);
  assert.doesNotMatch(advice!.body, /storing|make room/i);
});

test('the stored ceiling wins when both are close — it is the one with no exit', () => {
  const advice = capacityAdvice({
    copy: STANDARD,
    used: STANDARD.items - 1,
    stored: STANDARD.storedItems - 1,
  });
  assert.match(advice!.title, /stored/);
});

test('an over-ceiling closet is not told it has slots left', () => {
  assert.equal(
    capacityAdvice({ copy: STANDARD, used: STANDARD.items + 40, stored: 0 }),
    null,
  );
  assert.ok(NEAR_LIMIT_SLOTS > 0);
});

// ---------------------------------------------------------------------------
// 4 · What ending a membership does — correction 35, unchanged
// ---------------------------------------------------------------------------

test('the free line is quoted from PLANS.free and nowhere else', () => {
  assert.equal(
    freeLinePhrase(),
    `${PLANS.free.items} active and ${PLANS.free.storedItems} stored`,
  );
  assert.ok(endingNote().includes(freeLinePhrase()));
});

test('nothing is deleted, and no auto-archive or chooser is promised', () => {
  const note = endingNote();
  assert.match(note, /nothing is deleted/i);
  // The atlas's "Cinch will ask, and will not choose for you" promises a
  // chooser flow, and no such screen, mutation or job exists anywhere.
  assert.doesNotMatch(note, /we will ask|choose for you|automatically|archived for you/i);
});

// ---------------------------------------------------------------------------
// 5 · The refusals
// ---------------------------------------------------------------------------

test('a failed read is never drawn as free, and never as an alarm', () => {
  assert.match(UNCONFIRMED_TITLE, /can’t be confirmed/);
  assert.match(UNCONFIRMED_BODY, /Nothing has changed and nothing is locked/);
  assert.doesNotMatch(`${UNCONFIRMED_TITLE} ${UNCONFIRMED_BODY}`, /\bfree\b|expired|cancelled/i);
});

/**
 * REPLACES 'the free refusal carries no upsell' (2026-09-02).
 *
 * That test pinned `NO_MEMBERSHIP_LINE` — "There is no membership on this
 * account to manage." — and its rule was right about upsell-on-a-refusal and
 * wrong that this was a refusal at all. The founder's audit found the sentence
 * shown to an account that Today and Closet were actively selling to, beside
 * an Upgrade route telling the same account it was already on Pro. The state
 * is a confirmed free account, not a rejection, and it now draws the
 * comparison and one door. The constant is deleted;
 * `tests/membership-surface.test.ts` owns what that state may say.
 *
 * What survives from the old rule is the part that was about copy rather than
 * about the state: no page in this pair sells on an error or an absence. The
 * failed read above still carries no offer, and the assertion below still
 * holds the ONE refusal that remains to naming the tier it is refusing for.
 */
test('the upgrade refusal is only ever true, and offers a way back', () => {
  assert.equal(canUpgrade('pro'), false);
  assert.equal(canUpgrade('free'), false);
  assert.equal(canUpgrade('standard'), true);
  assert.ok(upgradeRefusedBody().includes(PLANS.pro.name));
  assert.match(UPGRADE_REFUSED_TITLE, /Nothing to move to/);
  // And it is now reached only by a PAYING Pro member — `canUpgrade('free')`
  // being false no longer routes a free account into Pro's sentence. See
  // `upgradeSurface` in tests/membership-surface.test.ts.
  const body = readFileSync('src/components/membership/upgrade-body.tsx', 'utf8');
  assert.match(body, /surface\.kind === 'at-top'/);
});

// ---------------------------------------------------------------------------
// 6 · Restore — four distinct endings
// ---------------------------------------------------------------------------

test('the three drawn endings are distinct, and only two offer a retry', () => {
  const restored = restoreRestored(PLANS.standard);
  const titles = [restored.title, RESTORE_NONE.title, RESTORE_FAILED.title];
  assert.equal(new Set(titles).size, 3);
  assert.equal(restored.action, undefined);
  assert.ok(RESTORE_NONE.action);
  assert.ok(RESTORE_FAILED.action);
});

test('a restore names the tier that came back, from the read', () => {
  assert.ok(restoreRestored(PLANS.pro).body.includes(`Cinch ${PLANS.pro.name}`));
});

test('"nothing found" is not dressed as a failure', () => {
  assert.match(RESTORE_NONE.body, /Nothing has changed/);
  assert.doesNotMatch(RESTORE_NONE.body, /error|problem|failed|wrong/i);
});

// ---------------------------------------------------------------------------
// 7 · MB-09's deltas — the routing and the derivation are untouched
// ---------------------------------------------------------------------------

test('the deltas still come from upgradeDelta, and speak as one node each', () => {
  const rows = upgradeDelta('standard');
  assert.equal(deltaSpoken(rows[0]!), `Active pieces. Now 150. On ${PLANS.pro.name}, 1,000.`);
  // The arrow is read as the words it means, never as a symbol.
  assert.doesNotMatch(deltaSpoken(rows[2]!), /→/);
});

test('the headline is the deltas summary, not a sales line', () => {
  assert.doesNotMatch(UPGRADE_HEADLINE, /best|save|only|now|limited|upgrade today/i);
});

test('the opening label says loading, never that a purchase began', () => {
  assert.match(UPGRADE_OPENING, /^Loading terms…$/);
  assert.doesNotMatch(UPGRADE_OPENING, /purchas|buy|charg/i);
});

test('a decline confirms and does not ask again', () => {
  assert.match(UPGRADE_DECLINED.body, /Nothing was started and nothing was charged/);
  assert.doesNotMatch(
    `${UPGRADE_DECLINED.title} ${UPGRADE_DECLINED.body}`,
    /are you sure|instead|last chance|before you go/i,
  );
});

test('proration is titled and never computed', () => {
  assert.doesNotMatch(UPGRADE_PRORATION_TITLE, /\d/);
});

// ---------------------------------------------------------------------------
// 8 · billing/ is untouched by this redesign
// ---------------------------------------------------------------------------

test('the upgrade routing is the shipped routing, opened through the gate alone', () => {
  const screen = readFileSync('src/app/membership-upgrade.tsx', 'utf8');
  // Placement, and only through `useGate`. A second way to summon a paywall is
  // a second contract with a dashboard campaign that nobody is auditing.
  assert.match(screen, /Placement\.MembershipUpgrade/);
  assert.match(screen, /gate\s*\n?\s*\.present\(/);
  assert.match(screen, /outcome === 'unavailable'/);
  // The manage path for an existing subscriber is Apple's list and nothing
  // else — Cinch cannot cancel or refund and must not appear to.
  const manage = readFileSync('src/app/membership.tsx', 'utf8');
  assert.match(manage, /apps\.apple\.com\/account\/subscriptions/);
});

test('the upgrade row still renders only for a member who can move', () => {
  const body = readFileSync('src/components/membership/membership-body.tsx', 'utf8');
  // WAS `canUpgrade(plan)`, read straight in the layout. It now reads
  // `surface.upgradable`, which is `canUpgrade` applied to a PAID account
  // inside `membershipSurface()` — the same rule, asked once, so that MB-08
  // and MB-09 cannot answer it differently for the same reader. The
  // eligibility function is still the only implementation of the rule;
  // tests/membership-surface.test.ts holds that.
  assert.match(body, /surface\.upgradable/);
  assert.doesNotMatch(body, /canUpgrade\(/);
  // And the row's own label is still the one `manage-membership.ts` owns,
  // rather than a second copy of the string in a layout.
  assert.match(body, /UPGRADE_ROW_LABEL/);
  assert.ok(UPGRADE_ROW_SUBLABEL.length > 0);
});

test('the redesign added no second canUpgrade', () => {
  // A copy of the eligibility rule in a presentation module is the drift bug
  // that ships as a row offered to somebody who cannot take it.
  const spec = readFileSync('src/features/membership/manage-membership-spec.ts', 'utf8');
  assert.doesNotMatch(spec.replace(/\/\*[\s\S]*?\*\//g, ''), /plan === 'standard'/);
});

// ---------------------------------------------------------------------------
// 9 · THE SWEEP — no typed price, term, saving or trial promise, anywhere
// ---------------------------------------------------------------------------

const SURFACES = [
  'src/features/membership/manage-membership-spec.ts',
  'src/components/membership/membership-parts.tsx',
  'src/components/membership/membership-body.tsx',
  'src/components/membership/upgrade-body.tsx',
  'src/components/membership/index.ts',
  'src/app/membership.tsx',
  'src/app/membership-upgrade.tsx',
  'src/dev-fixtures/mm-frames.tsx',
  ...readdirSync('src/dev-fixtures')
    .filter((f) => f.startsWith('dev-mm-') && f.endsWith('.tsx'))
    .map((f) => `src/dev-fixtures/${f}`),
];

/** Comments strippedcode only: this file's own prose, and theirs, stays legal. */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

test('every new membership surface exists — the sweep cannot pass by reading nothing', () => {
  assert.ok(SURFACES.length >= 29, `swept ${SURFACES.length} files`);
  for (const path of SURFACES) assert.ok(code(path).length > 0, path);
});

test('no currency symbol and no price-shaped figure in any layout', () => {
  for (const path of SURFACES) {
    const src = code(path);
    // `${` is a template literal, not a dollar amount — the digit is what
    // makes a `$` a price, which is why this pattern and not a bare symbol.
    assert.doesNotMatch(src, /[$£€¥]\s?\d/, `currency literal in ${path}`);
    assert.doesNotMatch(src, /\b\d+\.\d{2}\b/, `price-shaped figure in ${path}`);
    assert.doesNotMatch(src, /\bUSD\b|\bEUR\b|\bGBP\b/, `currency code in ${path}`);
  }
});

test('no period, per-month arithmetic or saving is typed into a layout', () => {
  for (const path of SURFACES) {
    const src = code(path);
    assert.doesNotMatch(src, /\/\s*(mo|month|yr|year)\b/i, `period in ${path}`);
    assert.doesNotMatch(src, /per month|a month|per year|a year|monthly|annually/i, `period in ${path}`);
    assert.doesNotMatch(src, /save \d|% off|discount|best value|cheaper/i, `saving in ${path}`);
  }
});

test('the price HINTS in plans.ts are never read by a membership layout', () => {
  // They exist for the paywall's own convenience and are hints by their own
  // docblock. A layout reaching for one is the exact regression D-5 forbids.
  for (const path of SURFACES) {
    assert.doesNotMatch(code(path), /PriceHint/, `price hint read in ${path}`);
  }
});

test('no trial is promised or offered on any purchase surface', () => {
  for (const path of SURFACES) {
    const src = code(path);
    assert.doesNotMatch(src, /free trial|start.{0,12}trial|days free|try free/i, `trial offer in ${path}`);
  }
});

test('the one permitted trial word reports a server-granted date', () => {
  // `TRIAL_MARK_PREFIX` and the `trialing` / `trialEndsAt` reads are the whole
  // of the trial vocabulary on these pages, and all of it is a report of
  // `subscriptions.trial_ends_at` — never an offer, never an eligibility claim.
  const spec = code('src/features/membership/manage-membership-spec.ts');
  const quoted = [...spec.matchAll(/'([^']*trial[^']*)'/gi)].map((m) => m[1]!);
  for (const s of quoted) assert.doesNotMatch(s, /start|offer|eligib|free/i, s);
});

// ---------------------------------------------------------------------------
// 10 · The kickers, and one last check that nothing shouts
// ---------------------------------------------------------------------------

test('the section kickers are the frames', () => {
  assert.equal(CAPACITY_KICKER, 'WHAT YOU HAVE');
  assert.equal(CHANGE_KICKER, 'CHANGE');
});

test('Pro states its absence rather than drawing a control that cannot act', () => {
  assert.match(PRO_IS_LARGEST.body, /no upgrade row is drawn/);
});

test('the cancel row names where it actually goes', () => {
  // The frame prints "Opens Settings"; the link is the App Store's own
  // subscription list, so the frame's literal would name the wrong
  // destination. Listed as a deviation in the build report.
  assert.match(CANCEL_ROW_MARK, /App Store/);
});

test('no layout carries a weight class — TY-01 / TY-02', () => {
  for (const path of SURFACES) {
    assert.doesNotMatch(code(path), /font-(semibold|bold|medium)/, `weight class in ${path}`);
  }
});
