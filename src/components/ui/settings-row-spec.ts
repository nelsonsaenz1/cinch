import { MIN_TAP_TARGET } from '@/theme/metrics';

import type { ThemeColors } from '@/theme/tokens';

/**
 * SettingsRow's visual contract, as data. Audit item 49.
 *
 * Four inputs (tone, external, loading, disabled) decide five outputs, and two
 * of them are promises to the reader rather than decoration:
 *
 *   - `chevron.right` means "further in". A row that hands you to Safari is
 *     not further in, and iOS marks that with the up-right arrow. Two glyphs
 *     for two different promises — getting this wrong tells the reader the
 *     app is about to do something it is not.
 *   - `tone="accent"` is spent on exactly ONE row in the whole app (Delete
 *     account). The atlas says so in as many words. A second accent row
 *     silently breaks the rule that makes the first one mean anything.
 *
 * Neither is visible in a rendered tree without knowing which row you are
 * looking at, and both are pure functions of the props.
 */

export type SettingsTone = 'ink' | 'accent';

export type SettingsRowInput = {
  tone?: SettingsTone;
  external?: boolean;
  loading?: boolean;
  disabled?: boolean;
  /**
   * The THIRD promise, added by redesign 29.
   *
   * `chevron.right` says "further in" and `arrow.up.right` says "out of the
   * app". Restore purchases says neither: it acts in place and reports into a
   * toast or a notice band on this same page. It shipped wearing a chevron
   * anyway, which promised a destination that never existed, and the redesign's
   * frames draw it bare. A row with no glyph is a row making no promise —
   * which is the honest drawing of a row that does something rather than
   * leading somewhere.
   */
  affordance?: 'chevron' | 'none';
};

export type SettingsRowSpec = {
  /** Which SF Symbol the trailing glyph draws, or null for a row that acts in place. */
  glyph: 'chevron.right' | 'arrow.up.right' | null;
  /** Token for the glyph (and the spinner that replaces it). */
  icon: keyof ThemeColors;
  /** The label's colour class. */
  labelClass: 'text-accent' | 'text-ink';
  minHeight: number;
  /** Dimmed only by `disabled`. A loading row stays at full opacity. */
  opacity: number;
  /** The row refuses taps while loading as well as while disabled. */
  inert: boolean;
  accessibilityState: { busy: boolean; disabled: boolean };
  /** Announced only when the row leaves the app. */
  accessibilityHint?: string;
};

export function settingsRowSpec({
  tone = 'ink',
  external = false,
  loading = false,
  disabled = false,
  affordance = 'chevron',
}: SettingsRowInput = {}): SettingsRowSpec {
  const inert = disabled || loading;
  return {
    // `external` still wins if a caller ever asks for both: leaving the app is
    // the louder promise, and a bare row that opened Safari would be silent
    // about the one thing that must never be silent.
    glyph: external ? 'arrow.up.right' : affordance === 'none' ? null : 'chevron.right',
    icon: tone === 'accent' ? 'accent' : external ? 'byline' : 'faint',
    labelClass: tone === 'accent' ? 'text-accent' : 'text-ink',
    minHeight: MIN_TAP_TARGET,
    // `disabled`, not `inert`: a row mid-request must not dim, or every tap
    // flashes the row grey and reads as a rejection.
    opacity: disabled ? 0.4 : 1,
    inert,
    accessibilityState: { busy: loading, disabled: inert },
    ...(external ? { accessibilityHint: 'Opens in your browser' } : null),
  };
}
