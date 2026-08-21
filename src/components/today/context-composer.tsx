import { SymbolView } from 'expo-symbols';
import { TextInput, View } from 'react-native';

import {
  ADD_CONTEXT_HINT,
  ADD_CONTEXT_LABEL,
  appliedLine,
  clearComposer,
  commitComposer,
  composerFace,
  openComposer,
  type ComposerState,
} from '@/components/today/context-composer-state';
import { PressableSurface } from '@/components/ui/pressable-surface';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

/**
 * THE DAY'S CONTEXT — one row, three faces (UX-03).
 *
 * The reducer beside this file carries every rule; this is the render tree and
 * the keyboard behaviour. See `context-composer-state.ts` for why the field
 * stays and only its permanence goes, and for the three refusals it keeps.
 *
 * ── WHAT THE PLATES GET BACK ──────────────────────────────────────────────
 *
 * Collapsed, this is a single 34pt line of quiet type instead of a filled tray
 * with a 44pt field in it and, once something was committed, a second line
 * under that. The three outfit plates are the first substantial thing on the
 * screen again, which is the whole of UX-03's brief: "keep the three outfit
 * plates as the first visual priority".
 *
 * ── WHAT DOES NOT CHANGE ──────────────────────────────────────────────────
 *
 * The committed string still goes to `useStyleContext` exactly as before, still
 * with no permission, no calendar read and no location. The applied sentence
 * still quotes the reader's own words, still announces politely, and still
 * carries a ✕ that clears. The lifecycle is unchanged: context lives as long as
 * the screen does and there is no midnight rule.
 */
export function ContextComposer({
  state,
  onChange,
  /** Suppress the affordance where there is nothing for context to change. */
  hidden = false,
}: {
  state: ComposerState;
  onChange: (next: ComposerState) => void;
  hidden?: boolean;
}) {
  const theme = useTheme();

  if (hidden) return null;

  const face = composerFace(state);

  if (face === 'editing') {
    return (
      <View className="mx-gutter mt-3 flex-row items-center gap-2 rounded-md bg-tray px-3.5 py-2.5">
        <SymbolView name="plus" size={15} tintColor={theme.accentWarm} resizeMode="scaleAspectFit" />
        <TextInput
          value={state.draft}
          onChangeText={(draft) => onChange({ ...state, draft })}
          onSubmitEditing={() => onChange(commitComposer(state))}
          // Blur commits, exactly as the always-open field did: tapping away
          // from a sentence you have finished typing should not throw it away,
          // and an emptied field committing to nothing is how "never mind" has
          // always been spelled here. This is the lifecycle UX-03 preserves.
          onBlur={() => onChange(commitComposer(state))}
          returnKeyType="done"
          // Opened on intent, so the keyboard comes with it — an affordance
          // that opens a field and then waits for a second tap is two taps.
          autoFocus
          placeholder="What’s on today?"
          placeholderTextColor={theme.muted}
          accessibilityLabel="Describe your plans today"
          className="flex-1 font-body text-callout text-ink"
        />
      </View>
    );
  }

  if (face === 'applied') {
    return (
      <View
        className="mx-gutter mt-3 flex-row items-center gap-2"
        accessibilityLiveRegion="polite">
        {/* The sentence is the way back IN. Re-opening seeds the field with
            what is committed, so changing "dinner at 7" to "dinner at 8" is an
            edit rather than a retype. */}
        <PressableSurface
          onPress={() => onChange(openComposer(state))}
          accessibilityRole="button"
          accessibilityLabel={`Styling for ${state.committed}`}
          accessibilityHint="Edit your plans for today"
          hitSlop={{ top: 12, bottom: 12 }}
          fill
          style={{ flex: 1, minHeight: 34 }}
          contentStyle={{ flex: 1, justifyContent: 'center' }}>
          <Text variant="note" numberOfLines={2}>
            {appliedLine(state.committed)}
          </Text>
        </PressableSurface>
        <PressableSurface
          onPress={() => onChange(clearComposer())}
          hitSlop={14}
          fill
          contentStyle={{}}
          accessibilityRole="button"
          accessibilityLabel="Clear your plans for today">
          <SymbolView name="xmark" size={11} tintColor={theme.muted} resizeMode="scaleAspectFit" />
        </PressableSurface>
      </View>
    );
  }

  // `add` — the resting state, and the one nearly every visit sees.
  return (
    <PressableSurface
      onPress={() => onChange(openComposer(state))}
      accessibilityRole="button"
      accessibilityLabel={ADD_CONTEXT_LABEL}
      accessibilityHint={ADD_CONTEXT_HINT}
      hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
      // 34pt drawn, padded past the 44pt floor by the hit slop — the same
      // arithmetic every other quiet control on these screens uses.
      fill
      style={{ minHeight: 34 }}
      contentStyle={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}
      className="mx-gutter mt-3 self-start">
      <SymbolView name="plus" size={13} tintColor={theme.accentWarm} resizeMode="scaleAspectFit" />
      <Text variant="label" className="text-ink">
        {ADD_CONTEXT_LABEL}
      </Text>
    </PressableSurface>
  );
}
