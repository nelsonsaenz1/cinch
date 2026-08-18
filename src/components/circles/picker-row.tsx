import { SymbolView } from 'expo-symbols';
import { Pressable, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';
import {
  ineligibilityReason,
  PICKER_HINT,
  pickerRowAccessibilityLabel,
} from '@/features/circles/copy';
import { type InviteIneligibility } from '@/features/circles/types';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * ONE PERSON IN THE INVITE PICKER — PC-03, in both its variants.
 *
 * ══ THE RULE THIS ROW EXISTS TO KEEP ═══════════════════════════════════════
 *
 * PC-10 states it about the whole surface: "Every unavailable row states its
 * reason on the row itself. Nothing is hidden and nothing is explained by
 * colour alone." Two halves, and both are structural here rather than
 * conventional:
 *
 * 1. **The unavailable row is still on the list.** It is not filtered out.
 *    Somebody looking for a friend who is not there learns nothing from an
 *    absence; a row that says "No longer a mutual friend" answers the question
 *    they actually have. (And it answers it without disclosing a block: a block
 *    severs both follow edges, so the pair genuinely stop being mutual friends
 *    and there is no third state to leak.)
 * 2. **The reason is a WORD, printed on the row, and spoken in the label.** Not
 *    a tint, not an opacity, not a missing checkbox. `reason` being non-null is
 *    the ONLY thing that disables the row, so an unavailable row without a
 *    printed reason is unreachable by construction rather than by review.
 *
 * ══ AND THE CHOSEN ROW IS A SHAPE, NOT A COLOUR ════════════════════════════
 *
 * Selection is drawn as a checkmark glyph and announced as
 * `accessibilityState.selected`. A filled row or an accent name would put the
 * whole of "chosen" into hue, which is the same failure one channel down. The
 * label is NOT changed to "…, selected": a reader with both VoiceOver and the
 * visual state would hear the change announced twice.
 *
 * ══ AND THE PLATE IS THE OTHER HALF OF THE SAME DISTINCTION ════════════════
 *
 * Redesign 27 draws a CHOOSABLE row as a warm slab and an unavailable one as
 * bare canvas. That is a third channel agreeing with the two above, never a
 * replacement for either: the reason is still printed as a word, the state is
 * still `accessibilityState.disabled`, and a reader who cannot see the ground
 * loses nothing. What the ground buys is that the rows a person can actually
 * act on are findable at a glance in a list that deliberately keeps the ones
 * they cannot.
 *
 * The empty ring on a chooseable row follows the same rule and is why it is
 * drawn ONLY there. An unavailable row gets no ring, because an empty box
 * beside "No longer a mutual friend" would read as "not chosen yet" rather
 * than "not available" — which is exactly the confusion the printed reason
 * exists to end.
 *
 * Presentational only. `onToggle` is a callback; nothing here sends anything,
 * and PC-03's own copy says so ("Nothing is sent until you confirm").
 */
/** The unticked ring. Matches the checkmark's optical size, not its box. */
const RING = 22;

export function PickerRow({
  name,
  avatarUrl,
  selected,
  /** `null` when the person can be invited. Non-null disables the row AND prints. */
  reason,
  onToggle,
}: {
  name: string;
  avatarUrl?: string | null;
  selected: boolean;
  reason: InviteIneligibility;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const why = ineligibilityReason(reason);
  const unavailable = why !== null;

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={pickerRowAccessibilityLabel({ name, reason })}
      // The hint is dropped on an unavailable row: "choose who to invite" is a
      // promise the row cannot keep, and the reason is already in the label.
      accessibilityHint={unavailable ? undefined : PICKER_HINT}
      accessibilityState={{ checked: selected, disabled: unavailable }}
      disabled={unavailable}
      onPress={onToggle}
      style={{ minHeight: MIN_TAP_TARGET }}
      className={`mb-2 flex-row items-center gap-3 rounded-plate px-4 py-3 active:opacity-60 ${
        unavailable ? '' : 'bg-tray'
      }`}>
      <Avatar name={name} size={44} imageUri={avatarUrl} />

      <View className="flex-1" style={{ minWidth: 0 }}>
        {/* The name keeps full ink strength even when the row is off. WCAG's
            exemption for a disabled control has never covered the prose beside
            one, and this row's prose is the whole explanation. */}
        <Text variant="body">{name}</Text>
        {why ? (
          <Text variant="note" className="mt-0.5">
            {why}
          </Text>
        ) : null}
      </View>

      {/* A shape, and only drawn when chosen. `flex-none` so the checkmark
          never squeezes the name; no reserved well when it is absent, because
          an empty box beside an unavailable row would read as "not chosen yet"
          rather than "not available". */}
      {selected ? (
        <View style={{ flexGrow: 0, flexShrink: 0 }}>
          <SymbolView
            name="checkmark"
            size={18}
            tintColor={theme.ink}
            resizeMode="scaleAspectFit"
          />
        </View>
      ) : unavailable ? null : (
        // The empty ring — the frames' own affordance, and only ever on a row
        // that can be chosen. See the header for why an unavailable row has
        // none. A border rather than a glyph, so nothing about it needs a
        // second colour or a second symbol.
        <View
          className="rounded-full"
          style={{
            flexGrow: 0,
            flexShrink: 0,
            width: RING,
            // Never a height: the kit forbids a fixed one around anything
            // sharing a row with a sentence that grows.
            aspectRatio: 1,
            borderWidth: 1.5,
            borderColor: theme.ruleStrong,
          }}
        />
      )}
    </Pressable>
  );
}
