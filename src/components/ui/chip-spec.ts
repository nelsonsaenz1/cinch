import { MIN_TAP_TARGET } from '@/theme/metrics';

import type { ThemeColors } from '@/theme/tokens';

/**
 * Chip's visual contract, as data. Audit item 49.
 *
 * Chip has the widest state space of the six components — tone × selected ×
 * selectedGround × size is 24 combinations, and the component resolves them
 * inline in a ternary chain inside `className`. That chain is unreadable at a
 * glance and untestable at all, and its comments record two bugs that shipped
 * from exactly that shape:
 *
 *   - the selected chip read muted-on-accent, because `variant="label"`
 *     carries `text-muted` and a `text-canvas` class has no defined precedence
 *     over it in NativeWind;
 *   - the `tap` chip rendered its ring at `hairline` (.09) when the atlas
 *     draws it a step STRONGER than the fields above it (.18) — an inversion
 *     of the emphasis the row exists to have.
 *
 * Both are facts about which token a combination resolves to. So the
 * combination is what gets pinned.
 *
 * `chipSpec` returns exactly what the component needs and nothing derived from
 * a hook, so it is callable from a test with a stand-in palette.
 */

export type ChipTone = 'outline' | 'fill' | 'dashed';
export type ChipSelectedGround = 'accent' | 'ink';
export type ChipSize = 'compact' | 'tap';

export const CHIP_TONES: readonly ChipTone[] = ['outline', 'fill', 'dashed'] as const;
export const CHIP_SIZES: readonly ChipSize[] = ['compact', 'tap'] as const;

/** The one alpha the atlas raises above `rule`. No token holds it. */
export const DASHED_RING = 'rgba(28,26,22,0.30)';

/** The compact chip's drawn height. Its touch target is padded out to 44. */
export const COMPACT_HEIGHT = MIN_TAP_TARGET - 12;

export type ChipInput = {
  tone?: ChipTone;
  selected?: boolean;
  selectedGround?: ChipSelectedGround;
  size?: ChipSize;
  pressable?: boolean;
};

export type ChipSpec = {
  /** Real drawn geometry, not the touch target. */
  minHeight: number;
  /**
   * A compact chip borrows the rest of the 44pt floor with vertical slop. A
   * `tap` chip already IS 44 and takes none: in a wrapped row the slop of one
   * line would reach into the next and make the boundary a coin toss.
   */
  hitSlop: { top: number; bottom: number; left: number; right: number };
  /** The ground and ring, as the class list the component joins. */
  ground: string;
  /** Horizontal padding class — 16px at `tap`, the atlas's own figure. */
  padding: 'px-4' | 'px-3.5';
  /** Inline border colour, when a tone needs one no class can express. */
  borderColor?: string;
  /** Label colour, applied inline because a class would lose to the variant. */
  label: keyof ThemeColors;
  /** The count suffix's colour. `null` when it inherits nothing special. */
  count: { token: keyof ThemeColors; alpha?: string };
};

export function chipSpec({
  tone = 'outline',
  selected = false,
  selectedGround = 'accent',
  size = 'compact',
  pressable = true,
}: ChipInput = {}): ChipSpec {
  const filled = tone === 'fill';
  const dashed = tone === 'dashed';
  const tapSized = size === 'tap';

  const ground = filled
    ? 'bg-sand'
    : dashed
      ? 'border border-dashed bg-transparent'
      : selected
        ? selectedGround === 'ink'
          ? 'border border-ink bg-ink'
          : 'border border-accent bg-accent'
        : // `rule` at `tap`, `hairline` when compact — see the docblock.
          `border bg-transparent ${tapSized ? 'border-rule' : 'border-hairline'}`;

  return {
    minHeight: tapSized ? MIN_TAP_TARGET : COMPACT_HEIGHT,
    hitSlop: tapSized
      ? { top: 0, bottom: 0, left: 4, right: 4 }
      : { top: 8, bottom: 8, left: 4, right: 4 },
    ground: [ground, pressable ? 'active:opacity-60' : ''].filter(Boolean).join(' '),
    padding: tapSized ? 'px-4' : 'px-3.5',
    ...(dashed ? { borderColor: DASHED_RING } : null),
    label: selected ? 'canvas' : dashed ? 'muted' : 'ink',
    count: selected ? { token: 'canvas', alpha: 'B3' } : { token: 'muted' },
  };
}

/** Every combination, for a test that wants to sweep the space. */
export function everyChipCombination(): ChipInput[] {
  const out: ChipInput[] = [];
  for (const tone of CHIP_TONES)
    for (const size of CHIP_SIZES)
      for (const selected of [false, true])
        for (const selectedGround of ['accent', 'ink'] as const)
          out.push({ tone, size, selected, selectedGround });
  return out;
}
