import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import {
  FEEL_OPTIONS,
  OCCASION_OPTIONS,
  TODAY_COPY,
  feelLabel,
  occasionLabel,
  type ContextFacet,
  type FeelId,
  type OccasionId,
} from '@/features/today/today-spec';
import { useTheme } from '@/theme/tokens';

/**
 * Today's context — a chip row that opens in place. Redesign 11.
 *
 * ── WHAT THIS REPLACES ──────────────────────────────────────────────────────
 *
 * `context-composer.tsx` — a single free-text field with three faces. It stays
 * in the tree for the surfaces that still mount it; Today no longer does. The
 * field's problem was never the typing: it was that the words it collected
 * could not reach the scorer. `StyleContext.note` is read by the naming hash
 * and by the enhancement gate and by nothing else, so an occasion typed into
 * it re-rolled three names and changed no outfit.
 *
 * These chips ask questions the engine already knows how to answer. Occasion
 * becomes `targetOccasion`, which `occasionRule` matches against each garment's
 * own tags; feel becomes `targetFormality`, which `resolveTargetFormality`
 * already prefers over the calendar. So a chip changes the outfits, which is
 * what the row appears to promise and what the field never did.
 *
 * ── NEVER A FORM, NEVER A MODAL ─────────────────────────────────────────────
 *
 * Options open beneath the row and commit on tap. There is no confirm step, no
 * sheet and no keyboard: every value is one of a closed list, which is also why
 * nothing here can send free text anywhere.
 */

/** The accepted measures: 44pt tall, 14pt corner, 8pt gap. */
export const CHIP_HEIGHT = 44;
export const CHIP_HEIGHT_AX = 56;
export const CHIP_RADIUS = 14;
export const CHIP_GAP = 8;

export type ContextChipsView = {
  /** "Grey, 63°" — or null, in which case the chip offers the setting. */
  weatherChip: string | null;
  occasion: OccasionId;
  feel: FeelId;
  /** Which facet is open, or null for the resting row. */
  open: ContextFacet | null;
  large: boolean;
  onOpen: (facet: ContextFacet | null) => void;
  onOccasion: (id: OccasionId) => void;
  onFeel: (id: FeelId) => void;
  /** Weather is the one chip whose tap leaves the page. */
  onWeather: () => void;
};

function Chip({
  label,
  open,
  large,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  open: boolean;
  large: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      className={open ? 'items-center justify-center bg-sand' : 'items-center justify-center bg-tray'}
      style={{
        minHeight: large ? CHIP_HEIGHT_AX : CHIP_HEIGHT,
        borderRadius: CHIP_RADIUS,
        paddingHorizontal: 16,
        justifyContent: 'center',
      }}>
      <Text variant="label" style={{ color: theme.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

function Option({
  label,
  selected,
  large,
  onPress,
}: {
  label: string;
  selected: boolean;
  large: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      className={selected ? 'items-center justify-center bg-accent' : 'items-center justify-center bg-tray'}
      style={{
        minHeight: large ? CHIP_HEIGHT_AX : CHIP_HEIGHT,
        borderRadius: CHIP_RADIUS,
        paddingHorizontal: 16,
        justifyContent: 'center',
      }}>
      <Text variant="label" style={{ color: selected ? theme.canvas : theme.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ContextChips({ view }: { view: ContextChipsView }) {
  const { large } = view;

  return (
    // A labelled group, so the three chips are heard as one thing with three
    // current values rather than as three unrelated buttons.
    <View accessibilityRole="radiogroup" accessibilityLabel="Today’s context">
      <View className="flex-row" style={{ gap: CHIP_GAP, flexWrap: 'wrap' }}>
        <Chip
          label={view.weatherChip ?? TODAY_COPY.weatherOff}
          open={false}
          large={large}
          onPress={view.onWeather}
          // The chip announces its current value, so a reader knows what the
          // day is being styled for without opening anything.
          accessibilityLabel={
            view.weatherChip ? `Weather, ${view.weatherChip}` : TODAY_COPY.weatherOff
          }
        />
        <Chip
          label={occasionLabel(view.occasion)}
          open={view.open === 'occasion'}
          large={large}
          onPress={() => view.onOpen(view.open === 'occasion' ? null : 'occasion')}
          accessibilityLabel={`Occasion, ${occasionLabel(view.occasion)}`}
        />
        <Chip
          label={feelLabel(view.feel)}
          open={view.open === 'feel'}
          large={large}
          onPress={() => view.onOpen(view.open === 'feel' ? null : 'feel')}
          accessibilityLabel={`Feel, ${feelLabel(view.feel)}`}
        />
      </View>

      {/* Opened in place, beneath the row it belongs to. No confirmation step:
          the tap is the choice and the plates recompose under it. */}
      {view.open === 'occasion' ? (
        <View style={{ paddingTop: 12, gap: 8 }}>
          <Text variant="eyebrow">{TODAY_COPY.occasionHeading}</Text>
          <View className="flex-row" style={{ gap: CHIP_GAP, flexWrap: 'wrap' }}>
            {OCCASION_OPTIONS.map((option) => (
              <Option
                key={option.id}
                label={option.label}
                selected={option.id === view.occasion}
                large={large}
                onPress={() => view.onOccasion(option.id)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {view.open === 'feel' ? (
        <View style={{ paddingTop: 12, gap: 8 }}>
          <View className="flex-row" style={{ gap: CHIP_GAP, flexWrap: 'wrap' }}>
            {FEEL_OPTIONS.map((option) => (
              <Option
                key={option.id}
                label={option.label}
                selected={option.id === view.feel}
                large={large}
                onPress={() => view.onFeel(option.id)}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
