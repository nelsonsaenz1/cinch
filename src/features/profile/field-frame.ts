import type { ThemeColors } from '@/theme/tokens';

/**
 * The one border every field in the edit-profile form shares, in its three
 * states: a 1px rule at rest, 1.5px ink while focused, 1.5px oxblood when the
 * field holds something that cannot save.
 *
 * Pulled out of `edit-profile-sheet.tsx` so `HandleField` (its own file, so
 * the dev fixture can drive it without a live query) draws the identical
 * border rather than a hand-retyped copy. Pure and side-effect free — the
 * width has to change WITH the state, which is why this stays an inline style
 * object rather than a class pair: a NativeWind class pair would leave a seam
 * where its precedence resolves, not where the state does.
 */
export type FieldFrameState = 'rest' | 'focus' | 'error';

export function fieldFrame(
  theme: Pick<ThemeColors, 'accent' | 'ink' | 'rule'>,
  state: FieldFrameState,
): { borderWidth: number; borderColor: string } {
  if (state === 'error') return { borderWidth: 1.5, borderColor: theme.accent };
  if (state === 'focus') return { borderWidth: 1.5, borderColor: theme.ink };
  return { borderWidth: 1, borderColor: theme.rule };
}
