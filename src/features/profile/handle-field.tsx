import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';

import { SectionHeader, Text } from '@/components/ui';
import { useTheme } from '@/theme/tokens';

import { fieldFrame } from './field-frame';
import { HANDLE_MAX, handleHintFor } from './handle';
import type { HandleAvailability } from './queries';

/** Field height, per the atlas — shared with the sheet's name and bio fields. */
const FIELD_HEIGHT = 46;

/**
 * The `@handle` claim field — EP-02's four states (checking, taken, not
 * allowed, and the quiet default) in one place: the verdict glyph inside the
 * field, and the helper sentence underneath that carries the fix.
 *
 * Pulled out of `edit-profile-sheet.tsx` so `dev-account.tsx` can drive the
 * exact same markup with fixed props — no live `useHandleAvailability` query,
 * no typing required to land on "Taken". The real sheet and the fixture strip
 * are drawing the same component, not two descriptions of it.
 */
export function HandleField({
  value,
  onChangeText,
  focused,
  onFocus,
  onBlur,
  handleError,
  availability,
  suggestions,
  onPressSuggestion,
}: {
  value: string;
  onChangeText: (next: string) => void;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  handleError: string | null;
  availability: HandleAvailability;
  suggestions: string[];
  onPressSuggestion: (suggestion: string) => void;
}) {
  const theme = useTheme();
  const state = handleError || availability === 'taken' ? 'error' : focused ? 'focus' : 'rest';
  const hint = handleHintFor(value, handleError, availability);

  return (
    <View>
      <SectionHeader title="Handle" className="mb-2 mt-5" />
      <View
        className="rounded-md bg-surface flex-row items-center px-3.5"
        style={[{ minHeight: FIELD_HEIGHT }, fieldFrame(theme, state)]}>
        {/* The `@` belongs to the field, not to the value — storing it would
            break the format constraint on the column. */}
        <Text variant="callout" className="text-faint">
          @
        </Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder="handle"
          placeholderTextColor={theme.faint}
          maxLength={HANDLE_MAX}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Handle"
          style={{
            flex: 1,
            minHeight: FIELD_HEIGHT - 3, // inside the widest border
            paddingLeft: 2,
            fontFamily: 'HelveticaNeue',
            fontSize: 16,
            color: theme.ink,
          }}
        />
        {/* The verdict lives IN the field — a check, a spinner, or the one
            word "Taken" — with the helper below carrying the fix. */}
        {availability === 'free' ? (
          <View className="flex-row items-center gap-1.5" accessibilityLiveRegion="polite">
            <SymbolView name="checkmark" size={12} tintColor={theme.ink} resizeMode="scaleAspectFit" />
            <Text variant="label" className="text-ink">
              Available
            </Text>
          </View>
        ) : availability === 'checking' ? (
          <View className="flex-row items-center gap-1.5" accessibilityLiveRegion="polite">
            <ActivityIndicator size="small" color={theme.faint} />
            <Text variant="label" className="text-faint">
              Checking
            </Text>
          </View>
        ) : availability === 'taken' ? (
          <Text variant="label" accessibilityLiveRegion="polite" style={{ color: theme.accent }}>
            Taken
          </Text>
        ) : null}
      </View>
      <Text
        variant="caption"
        accessibilityLiveRegion={hint.tone === 'quiet' ? 'none' : 'polite'}
        className={hint.tone === 'error' ? 'mt-2' : 'mt-2 text-muted'}
        style={hint.tone === 'error' ? { color: theme.accent } : undefined}>
        {hint.text}
      </Text>
      {suggestions.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-2.5"
          contentContainerStyle={{ gap: 7 }}>
          {/* Alternatives that fill the field on tap. `rounded-chip` rather
              than the atlas's 15px capsule: labelled controls in this app are
              12px rectangles by rule (tailwind.config.js on `full`), and one
              radius grammar beats a 3px match. */}
          {suggestions.map((s) => (
            <Pressable
              key={s}
              onPress={() => onPressSuggestion(s)}
              accessibilityRole="button"
              accessibilityLabel={`Use handle ${s}`}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              style={{ height: 30, justifyContent: 'center' }}
              className="rounded-chip border border-rule px-3 active:opacity-60">
              <Text variant="label" style={{ color: theme.ink }}>
                @{s}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}
