/**
 * UX-01 — the semantic role table, and the maths that proves it.
 *
 * The palette is nine warm colours and a handful of derived ones. What it never
 * had was a statement of WHICH of them may carry a sentence. So `faint` (3.52:1
 * on canvas) was set as type in 26 files, `byline` (2.61:1) in seven, and the
 * only thing standing against it was one scanner in `tests/constitution.test.ts`
 * that knew about `faint` alone. A colour is not accessible or inaccessible in
 * itself — it is accessible *as a role, on a ground* — and that pairing is the
 * thing this file names.
 *
 * ── What this file is NOT ─────────────────────────────────────────────────────
 *
 * It is not a new palette. Not one hex moves. UX-01's instruction is "preserve
 * the warm palette; remap text roles to compliant semantic tokens and reserve
 * low-contrast colors for nonessential decoration, disabled states, and
 * skeletons", and every remap it needed had already been made by hand: the
 * eyebrow and colophon variants went `faint` → `muted` in the 2026-08-06 pass,
 * and `positive`/`warning` were never set as type anywhere. What was missing was
 * the RULE, written down and enforced, so the next person reaching for `byline`
 * on a caption finds a red test instead of a plausible-looking screen.
 *
 * ── Why 4.5:1 and not 3:1 ────────────────────────────────────────────────────
 *
 * WCAG 2.2 exempts text at 18.66px regular or 14px bold, and this app has no
 * bold cut at all (TY-01) and sets its quiet roles at 10–13px. `eyebrow` is 10,
 * `caption`/`noteSmall` are 11, `label`/`note` are 13. Not one of the roles a
 * low-contrast colour was reached for is large text, so the large-text exemption
 * never applies to the cases that matter and `AA_TEXT` is the only threshold
 * worth encoding. `AA_LARGE` is here to be pointed at, not spent.
 *
 * ── The two honest exemptions ────────────────────────────────────────────────
 *
 * WCAG exempts disabled controls and purely decorative marks. Both exist here
 * and both are named rather than assumed: `disabled` is Button's `filled` tone
 * (a `byline` label on `sand`, with the reason printed underneath at full
 * strength), and `decorative` is the skeleton shimmer, the example-content
 * furniture on the Plan atlas, and the unpickable past days in the date sheet.
 * Naming them is what stops "it is decorative" becoming the universal excuse:
 * a role in this table declares `text: false`, and the census in
 * `tests/constitution.test.ts` then refuses to let a new file set it as type.
 */

import { light } from './palette';

/** WCAG 2.2 §1.4.3 for text below the large-text threshold. */
export const AA_TEXT = 4.5;

/**
 * WCAG 2.2 §1.4.3 for text at 18.66px regular or 14px bold. Recorded for
 * completeness; nothing in this app is set large enough to earn it, and no role
 * below claims it. See the header.
 */
export const AA_LARGE = 3;

/** WCAG 2.2 §1.4.11 for the boundary of a control or a meaningful graphic. */
export const AA_NON_TEXT = 3;

const channel = (hex: string, index: number) => {
  const v = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

/** WCAG 2.2 relative luminance. Opaque `#RRGGBB` only — see `contrastRatio`. */
export function relativeLuminance(hex: string): number {
  return 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
}

/**
 * The WCAG 2.2 contrast ratio between two OPAQUE colours, 1–21.
 *
 * Deliberately refuses `rgba(...)`: a translucent colour has no contrast ratio
 * until you say what is behind it, and the app's three alpha tokens
 * (`hairline`, `rule`, `ruleStrong`) are all borders, none of them text. A
 * function that silently accepted them would return a number for a question
 * nobody asked, which is worse than throwing.
 */
export function contrastRatio(a: string, b: string): number {
  for (const hex of [a, b]) {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
      throw new Error(`contrastRatio needs opaque #RRGGBB, got "${hex}"`);
    }
  }
  const [x, y] = [relativeLuminance(a), relativeLuminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/**
 * The grounds a role can land on, light-only.
 *
 * `sand` is the hardest of them (13.84:1 against ink, versus canvas's 16.63) and
 * is therefore the one a role has to clear — a token that passes on canvas and
 * fails on the disabled button's ground is a token that fails in the one place
 * anyone looks closely. `ink` is the fifth ground and the inverted one: the
 * toast, the camera chrome, and The Reveal's first beats.
 */
export const GROUNDS = {
  canvas: light.canvas,
  surface: light.surface,
  tray: light.tray,
  sand: light.sand,
  blush: light.blush,
} as const;

export type GroundName = keyof typeof GROUNDS;

/** The one dark ground. Type on it is `canvas`, never a palette grey. */
export const INK_GROUND = light.ink;

export type Role = {
  /** The palette key this role paints with. */
  token: keyof typeof light;
  /**
   * May this role carry meaningful text at 10–17pt?
   *
   * `true` is a promise the test below keeps: the token clears `AA_TEXT` on
   * every ground in `GROUNDS`. `false` is a refusal with a stated reason — see
   * `why`.
   */
  text: boolean;
  /** Why a `text: false` role is allowed to exist at the contrast it has. */
  why: string;
};

/**
 * DE-01's token-role table.
 *
 * Eight roles, because that is what the brief asks for — primary, secondary,
 * tertiary/decorative, disabled, border, accent, destructive, success — plus the
 * two the app actually has that the brief's eight collapse (`warning` is not
 * `success`, and `onInk` is a real role with a real ground).
 *
 * Read a row as a sentence: "the SECONDARY role paints with `muted` and may
 * carry text." The test that follows this file turns every `text: true` into an
 * assertion and every `text: false` into a census entry.
 */
export const ROLES = {
  /** Headlines, body copy, data figures. 16.63:1 on canvas. */
  primary: { token: 'ink', text: true, why: '' },
  /**
   * Body-secondary, and since the 2026-08-06 contrast pass the tone eyebrows
   * and colophons are set in as well. 5.46:1 on canvas, 4.55:1 on sand — it
   * clears on every ground, which is the whole reason `Text`'s quiet variants
   * were moved onto it rather than onto `faint`.
   */
  secondary: { token: 'muted', text: true, why: '' },
  /**
   * The tertiary tone. 3.52:1 on canvas — below AA — so it is a MARK, not a
   * voice: a rule-adjacent tick, a chevron whose meaning is carried by the row
   * it sits on, type on a dark ground where it is a different colour problem.
   */
  tertiary: {
    token: 'faint',
    text: false,
    why: '3.52:1 on canvas. Decorative marks and dark grounds only.',
  },
  /**
   * The attribution voice as a DECORATION. 2.61:1. Its remaining text uses are
   * the census below, not a permission — the Lately ledger's credit lines are
   * meaningful text and belong on `muted`.
   */
  decorative: {
    token: 'byline',
    text: false,
    why: '2.61:1 on canvas. Never a sentence; the debt census tracks what is left.',
  },
  /**
   * Example content and skeletons. 1.72:1, and deliberately so: the Plan
   * atlas's ghost weekday and ghost trip label must read as furniture at a
   * glance precisely because they are NOT the reader's data. WCAG's decorative
   * exemption is doing real work here rather than covering for a mistake.
   */
  example: {
    token: 'ghost',
    text: false,
    why: '1.72:1. Explicitly-not-your-data furniture and skeleton fills.',
  },
  /**
   * Button's `filled` disabled tone — a `byline` label on `sand`, 2.17:1.
   * WCAG 2.2 exempts an inactive control, and the atlas pairs this one with a
   * sentence underneath at full strength saying why it is off. The exemption is
   * only honest because of that sentence; a disabled control with no stated
   * reason should use the `dim` tone instead.
   */
  disabled: {
    token: 'byline',
    text: false,
    why: 'WCAG 2.2 exempts inactive controls; N-07 prints the reason at full strength.',
  },
  /**
   * The strongest border in the ramp, and still 1.5-ish against canvas.
   * Borders are §1.4.11 territory, not §1.4.3, and these are alpha values —
   * `contrastRatio` refuses them by design, so this row is a NAME rather than a
   * measurement. It exists so that "border" is not silently absent from the
   * table the brief asked for.
   */
  border: {
    token: 'ruleStrong',
    text: false,
    why: 'A border is never text. Alpha over an unknown ground; §1.4.11, not §1.4.3.',
  },
  /** Oxblood. 9.84:1 on canvas — the accent is a legitimate text colour. */
  accent: { token: 'accent', text: true, why: '' },
  /**
   * Warm clay. 2.98:1 — a FILL and a chart half, never type. It is not used as
   * type anywhere today and this row is what keeps that true.
   */
  accentDecorative: {
    token: 'accentWarm',
    text: false,
    why: '2.98:1. Fills, chart halves and `blush`; never type.',
  },
  /** The deeper brick. 8.04:1 — destructive copy and destructive labels. */
  destructive: { token: 'critical', text: true, why: '' },
  /**
   * Success. 4.34:1 on canvas — SHORT of AA, which is the finding UX-01 turned
   * up that nobody had written down.
   *
   * It costs nothing today because `positive` is not set as type in a single
   * file: it is a dot, a check glyph and a fill. So the fix is not to darken the
   * green — that would spend a new hex to solve a problem the app does not have
   * — it is to record the measurement and forbid the use. A success SENTENCE
   * belongs in the toast (canvas on ink, 16.63:1) or in `muted` beside a
   * positive mark, per UX-08.
   */
  success: {
    token: 'positive',
    text: false,
    why: '4.34:1 on canvas — below AA. A dot or a fill; a success sentence goes to the toast.',
  },
  /**
   * Warning. 2.85:1, and the same rule as `success` for the same reason: it is
   * a mark. NoticeBand carries the warning SENTENCE, and it carries it in `ink`
   * on `tray` with the cause spelled out as a word — "the cause is a WORD,
   * never a colour or an icon" is already that component's stated refusal.
   */
  warning: {
    token: 'warning',
    text: false,
    why: '2.85:1. A mark; NoticeBand carries the sentence in ink on tray.',
  },
  /**
   * Type on the one dark ground. `canvas` on `ink` is 16.63:1 — the same
   * headroom the light side has, inverted. Checked against `INK_GROUND` rather
   * than `GROUNDS`, so it has its own assertion in the test.
   */
  onInk: { token: 'canvas', text: true, why: '' },
} as const satisfies Record<string, Role>;

export type RoleName = keyof typeof ROLES;

/** Every role that may carry meaningful text, by palette key. */
export const TEXT_TOKENS = Object.values(ROLES)
  .filter((r) => r.text)
  .map((r) => r.token);

/**
 * Every token the table forbids as text, by palette key, de-duplicated.
 *
 * This is the list `tests/constitution.test.ts` runs its census against —
 * `faint`, `byline` and `ghost` today. Adding a role with `text: false` above
 * automatically widens the census, which is the point: the table is the source,
 * the scanner is downstream of it.
 */
export const NON_TEXT_TOKENS = [
  ...new Set(
    Object.values(ROLES)
      .filter((r) => !r.text)
      .map((r) => r.token),
  ),
];

/** Does `token` clear AA as text on every ground in `GROUNDS`? */
export function passesOnEveryGround(token: keyof typeof light): boolean {
  return Object.values(GROUNDS).every((ground) => contrastRatio(light[token], ground) >= AA_TEXT);
}
