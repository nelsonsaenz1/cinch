/**
 * Redesign 29 — Settings, as data.
 *
 * The page is administration, and administration is the one surface where a
 * layout decision and a truth claim are the same decision: a detail line that
 * says "0" when a read has not landed is a lie about somebody's block list, and
 * a summary that drops a diagnostic is a capability that quietly stopped being
 * reachable. So every string the redesigned page prints that is DERIVED rather
 * than typed lives here, pure, and `tests/settings-layout.test.ts` pins it
 * without a renderer.
 *
 * What is deliberately NOT here:
 *
 * · `membershipRowFor` (features/billing/membership-row.ts). The plan door's
 *   five reads are byte-identical to what shipped; redesign 29 changes the
 *   PLATE the row is drawn on and nothing about the derivation. Re-expressing
 *   it here would be a second membership state machine, which is the one thing
 *   a billing surface must never have.
 * · `SHOW_WHERE_TO_BUY_DETAIL` (features/commerce/copy.ts). That sentence is
 *   governed by commerce-directive.md, not by this atlas. The redesign draws
 *   the frame's shorter state lines and hands the governed disclosure to
 *   VoiceOver — see `whereToBuyHint`.
 * · The capability reconciliation, which stays in `features/profile/
 *   settings-copy.ts` because it spans Profile as well as this page.
 */

import type { UpdateDiagnostic } from '@/features/updates/diagnostics';

// ---------------------------------------------------------------------------
// The card heads
// ---------------------------------------------------------------------------

/**
 * The five groupings the frames draw, and the order they appear in.
 *
 * Membership has no head, on purpose and per the frames: it is a plate about
 * THIS account rather than a group of controls, and a kicker over a single
 * blush row would file the reader's own membership under a heading like a
 * setting they might go looking for.
 *
 * "Update diagnostics" was the shipped head and is now DIAGNOSTICS, with
 * "Update diagnostics" demoted to the row label — the head names the group and
 * the row names the thing, which is how every other group on the page reads.
 */
export const SETTINGS_KICKERS = {
  styling: 'Styling',
  people: 'People',
  utility: 'Utility',
  account: 'Account',
  diagnostics: 'Diagnostics',
} as const;

// ---------------------------------------------------------------------------
// The one real switch
// ---------------------------------------------------------------------------

/**
 * ON / OFF, drawn beside the switch in oxblood.
 *
 * The shipped row printed "On — <disclosure>" under the label, which was the
 * same refusal as this one (a preference must never be carried by track colour
 * alone) in the position the settled row had available. The frames move the
 * word to the trailing edge and set it in caps, so the state is legible in the
 * same glance as the switch rather than one line under it.
 */
export function switchStateWord(on: boolean): 'ON' | 'OFF' {
  return on ? 'ON' : 'OFF';
}

/**
 * The line under "Show where to buy", which changes with the state.
 *
 * Three readings, and the third is the one that matters: while the write is in
 * flight the row says `Saving…` rather than asserting either state, because the
 * server has not agreed yet and a settings row that reports an unconfirmed
 * write is the failure mode the toggle's own notice exists to clean up after.
 */
export function whereToBuyDetail({ on, writing }: { on: boolean; writing: boolean }): string {
  if (writing) return 'Saving…';
  return on ? 'Merchant suggestions appear on gaps.' : 'Gaps stay silent. Nothing is suggested to buy.';
}

/**
 * What VoiceOver gets instead of the shortened line.
 *
 * The directive's own constraint: "VoiceOver labels preserve any removed
 * prose." The frames cut the governed commerce disclosure down to seven words
 * of visible detail; the full sentence is still the truth about what the switch
 * does app-wide, so it goes into the hint rather than out of the app.
 */
export function whereToBuyHint(disclosure: string): string {
  return disclosure;
}

/**
 * The write failed, and the switch is back where it was.
 *
 * Stated as a NoticeBand rather than a toast because it carries a recovery, and
 * worded as a fact about the server rather than about the control: the reader's
 * fear on seeing a switch move back is that it half-saved.
 */
export const WHERE_TO_BUY_FAILED = {
  cause: 'NOT SAVED',
  title: 'Not saved',
  body: 'The setting is exactly as it was. Nothing changed on the server.',
  action: 'Try again',
} as const;

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** The external policy's trailing value — the host, so the arrow has a subject. */
export const PRIVACY_POLICY_DETAIL = 'cinchstyle.com';

/**
 * The restore row's second line.
 *
 * Resting, it explains what the row is FOR without promising a purchase exists
 * — "Bring back a purchase made on another device", not "Restore your
 * membership". In flight it names who is being asked, because the wait is the
 * App Store's and a row that just spins looks like the app hung.
 */
export function restoreRowDetail(restoring: boolean): string {
  return restoring ? 'Checking with the App Store…' : 'Bring back a purchase made on another device.';
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

/**
 * "Channel production · runtime 1.8.0 · update 4c1f2ab" — three of the five
 * facts, as the collapsed row's second line.
 *
 * `updateDiagnostics()` answers FIVE (Build, Update channel, Runtime, Running
 * update, Updates) and the frames draw one row carrying three. That is a
 * summary, not a replacement: the row expands in place and every fact the
 * function returned is drawn underneath, in the same `ValueRow` the shipped
 * page used. A summary that swallowed two facts would be exactly the quiet
 * capability loss this redesign is forbidden from causing.
 *
 * Every value is read from `updateDiagnostics()`; nothing here is a literal.
 * A fact the function did not return is DROPPED from the line rather than
 * printed as "unknown" — the row is a summary, and a summary with holes named
 * in it is a worse summary than a shorter one.
 *
 * "Running update" is already prose when the launch is embedded ("Embedded in
 * build"), so it is lowercased into the sentence rather than prefixed: "update
 * Embedded in build" reads as a broken template.
 */
export function diagnosticsSummary(facts: readonly UpdateDiagnostic[]): string {
  const byLabel = new Map(facts.map((f) => [f.label, f.value]));
  const parts: string[] = [];

  const channel = byLabel.get('Update channel');
  if (channel) parts.push(`Channel ${channel}`);

  const runtime = byLabel.get('Runtime');
  if (runtime) parts.push(`runtime ${runtime}`);

  const update = byLabel.get('Running update');
  if (update) parts.push(update === 'Embedded in build' ? 'embedded update' : `update ${update}`);

  return parts.join(' · ');
}

/** The row's own label. The head above it says which group it belongs to. */
export const DIAGNOSTICS_ROW_LABEL = 'Update diagnostics';

// ---------------------------------------------------------------------------
// The edition mark
// ---------------------------------------------------------------------------

/**
 * "Cinch 1.8.0 (412)", or "Cinch 1.8.0" where EAS has stamped no build number.
 *
 * Never padded with a placeholder: "(unknown)" in the edition mark is the one
 * string on this page a support conversation would quote back verbatim.
 */
export function versionMark(version: string | null, build: string | null): string | null {
  if (!version) return null;
  return `Cinch ${version}${build ? ` (${build})` : ''}`;
}
