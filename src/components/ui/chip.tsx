import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Renders a count suffix in tabular numerals, e.g. filter result counts. */
  count?: number;
  accessibilityHint?: string;
  /**
   * `outline` (default) is the interactive chip: a hairline ring that fills
   * with the accent when selected. `fill` is the READ-ONLY descriptive tag the
   * approved closet frame draws — a sand ground with no ring at all.
   *
   * Scoped deliberately rather than made the global style: the category filter
   * needs the outlined/filled pair to carry its selected state, and a filled
   * resting chip would leave it nothing to change into. Radius stays 12 in
   * both tones — the frame's 999 capsule is a recorded deviation, and one
   * radius grammar beats a 2px match to a mock that broke its own scale.
   *
   * `dashed` is the ABSENCE of a tag drawn as one — item detail's "+ Tag" at
   * the end of the chip row (I-01). Scoped to that shape rather than offered as
   * a general "add" style: it is the only chip in the app whose label names an
   * action instead of a value, and the muted ring and label are exactly what
   * keep it from reading as a tag the garment already carries.
   */
  tone?: 'outline' | 'fill' | 'dashed';
  /**
   * What the selected outline chip fills with. `accent` is the app-wide
   * default; the Closet State Atlas draws its category row's active chip in
   * ink (C-01), so the closet passes `ink`. Additive — no existing call site
   * changes meaning.
   */
  selectedGround?: 'accent' | 'ink';
  /**
   * A 9px colour dot before the label — item detail's colour chips (I-01),
   * where "Cognac" is only half of what the tag says and the dot is the rest.
   *
   * A bare `View` rather than `Swatch`, and a prop rather than a leading slot:
   * `Swatch`'s size union is the five circles the app genuinely draws (14–30),
   * and 9 is under all of them because this is chip furniture sized to a 13px
   * label, not a swatch a finger ever goes near. Nullable on purpose — the
   * tagger writes name-only colours (see `itemColor` in schemas/item.ts), and a
   * chip with no hex is simply a labelled chip. Never an invented colour.
   */
  swatchHex?: string | null;
};

/**
 * The workhorse of tag editing. The review deck needs a correction to take one
 * tap, so tags are always chips — never a picker, never a dropdown, never a
 * form field.
 */
export function Chip({
  label,
  selected = false,
  onPress,
  count,
  accessibilityHint,
  tone = 'outline',
  selectedGround = 'accent',
  swatchHex,
}: ChipProps) {
  const theme = useTheme();
  const filled = tone === 'fill';
  const dashed = tone === 'dashed';
  const inkGround = selectedGround === 'ink';

  // The selection tick every other control in the app gives a tap. Best-effort:
  // haptics no-op in Low Power Mode, and a failure must never eat the press.
  const press = useCallback(() => {
    if (!onPress) return;
    void Haptics.selectionAsync().catch(() => {});
    onPress();
  }, [onPress]);

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      // Reported only for a chip that can actually be pressed. `selected` is a
      // state a control is IN, and item detail draws its category chip in the
      // selected ink treatment purely as a look — announcing "selected" on a tag
      // nobody can toggle describes an affordance that is not there.
      accessibilityState={onPress ? { selected } : undefined}
      accessibilityHint={accessibilityHint}
      onPress={onPress ? press : undefined}
      // Visual height stays compact; the touch target is padded out to 44pt.
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      style={{
        minHeight: MIN_TAP_TARGET - 12,
        // The one alpha the atlas raises above `rule`, and inline because no
        // token holds it: a dashed ring at 12% breaks into dots that read as
        // dirt rather than as an outline. I-01 draws it at warm ink 30%.
        ...(dashed ? { borderColor: 'rgba(28,26,22,0.30)' } : null),
      }}
      className={[
        'flex-row items-center justify-center rounded-chip px-3.5',
        onPress ? 'active:opacity-60' : '',
        filled
          ? 'bg-sand dark:bg-sand-dark'
          : dashed
            ? 'border border-dashed bg-transparent'
            : selected
              ? inkGround
                ? 'border border-ink bg-ink dark:border-ink-dark dark:bg-ink-dark'
                : 'border border-accent bg-accent dark:border-accent-dark dark:bg-accent-dark'
              : 'border border-hairline bg-transparent dark:border-hairline-dark',
      ].join(' ')}>
      {/* Inline geometry rather than a class: 9px has no spacing step, and it
          should not get one for a single dot. `mr-1.5` is the atlas's 6px gap. */}
      {swatchHex ? (
        <View
          className="mr-1.5"
          style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: swatchHex }}
        />
      ) : null}
      {/* Inline style, not a className: `variant="label"` already carries
          `text-muted`, and NativeWind gives no guaranteed precedence between
          two `text-*` utilities on one element — so a `text-canvas` class here
          lost and the selected chip read muted-on-accent. */}
      <Text
        variant="label"
        style={{ color: selected ? theme.canvas : dashed ? theme.muted : theme.ink }}>
        {label}
      </Text>
      {/* `statSmall`, not `stat` + a `text-label` override: two size utilities
          on one element have no defined precedence in NativeWind — the same
          hazard as the colours above. The variant names the size once. */}
      {count !== undefined ? (
        <Text
          variant="statSmall"
          className="ml-1.5"
          style={{ color: selected ? `${theme.canvas}B3` : theme.muted }}>
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}
