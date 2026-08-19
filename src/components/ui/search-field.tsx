import { SymbolView } from 'expo-symbols';
import { useState, type RefObject } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { MAX_TEXT_SCALE } from '@/theme/type-scale';
import { useTheme } from '@/theme/tokens';

import {
  CLEAR_FILL,
  CLEAR_HIT_SLOP,
  CLEAR_SIZE,
  DOOR_HEIGHT,
  INPUT_FONT_SIZE,
  INPUT_LINE_HEIGHT,
  INPUT_PADDING_Y,
  PAGE_FOCUS_BORDER,
  PAGE_HEIGHT,
  PAGE_INPUT_FONT_SIZE,
  PAGE_INPUT_LINE_HEIGHT,
  PAGE_RADIUS,
  showsClear,
  showsFocusRing,
} from './search-field-spec';

export type SearchFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  /** Defaults to `placeholder` — every call site set them equal. */
  accessibilityLabel?: string;
  autoFocus?: boolean;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoCorrect?: boolean;
  inputRef?: RefObject<TextInput | null>;
  className?: string;
  /**
   * `'page'` is People Search's field: 50pt tall, set at 17, ringed in oxblood
   * while focused. Default `'door'` is the Closet/Lately/Friends field, which
   * this must keep rendering exactly as it did. See `search-field-spec.ts`.
   */
  size?: 'door' | 'page';
  /** Called on focus and blur, so a page can react to the caret arriving. */
  onFocusChange?: (focused: boolean) => void;
};

/** The clear control's disc — ink at 18%, a quiet occlusion rather than chrome. */

/**
 * The tray-filled search row — Closet, Lately and Friends each hand-typed
 * the same eight lines (down to the literal `paddingVertical: 11`) for the
 * identical field. The Lately atlas is the field's spec sheet: 16px text (a
 * half-step under body, so the field reads as a door rather than a page) and
 * its own 17pt clear disc in place of UIKit's grey one — the system control
 * is cool-toned on a warm page. The Lately atlas's focused-frame border is
 * deliberately not drawn: the Closet atlas shows the active field bare, and
 * one field keeps one grammar.
 */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  autoFocus,
  autoCapitalize,
  autoCorrect,
  inputRef,
  className = '',
  size = 'door',
  onFocusChange,
}: SearchFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const page = size === 'page';
  const ringed = page && showsFocusRing(focused);

  return (
    <View
      className={`flex-row items-center bg-tray ${page ? 'gap-2.5 px-4' : 'gap-2 rounded-md px-3.5'} ${className}`}
      style={
        page
          ? {
              borderRadius: PAGE_RADIUS,              // The ring is drawn as a border that is always present and only
              // sometimes coloured, so the field's inner width does not jump
              // by 3pt the moment the caret lands in it.
              borderWidth: PAGE_FOCUS_BORDER,
              borderColor: ringed ? theme.accent : 'transparent',
              // A minimum, never a fixed height: at large Dynamic Type the
              // field grows with its text rather than clipping it.
              minHeight: PAGE_HEIGHT,
            }
          : // The door stands 44 on its own type metrics now. Closet used to
            // pass `min-h-[44px]` at its call site to get here, which grew the
            // container without growing the input's text rect — the box looked
            // right and the placeholder was still shaved. A minimum, never a
            // fixed height: at large Dynamic Type the field grows with its text.
            { minHeight: DOOR_HEIGHT }
      }>
      <SymbolView
        name="magnifyingglass"
        size={page ? 17 : 15}
        tintColor={ringed ? theme.accent : theme.faint}
        resizeMode="scaleAspectFit"
      />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        autoFocus={autoFocus}
        placeholder={placeholder}
        // A placeholder is the only text in an empty field, so the constitution's
        // "NEVER #8A8578 as text" governs it. The glyph above stays faint: it
        // is an icon, and the rule is about type.
        placeholderTextColor={theme.muted}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        returnKeyType="search"
        accessibilityLabel={accessibilityLabel ?? placeholder}
        onFocus={() => {
          setFocused(true);
          onFocusChange?.(true);
        }}
        onBlur={() => {
          setFocused(false);
          onFocusChange?.(false);
        }}
        // A raw TextInput does not inherit `Text`'s cap, so it is set by hand.
        maxFontSizeMultiplier={MAX_TEXT_SCALE}
        style={{
          flex: 1,
          paddingVertical: INPUT_PADDING_Y,
          fontFamily: 'HelveticaNeue',
          fontSize: page ? PAGE_INPUT_FONT_SIZE : INPUT_FONT_SIZE,
          // STATED, not inherited. Without it the door field's text rect came
          // back as 19pt for a face whose own line box at 16 is 19.2, so the
          // placeholder was shaved along the bottom on every screen that
          // mounts this. See the long note in `search-field-spec.ts`.
          lineHeight: page ? PAGE_INPUT_LINE_HEIGHT : INPUT_LINE_HEIGHT,
          color: theme.ink,
        }}
      />
      {showsClear(value) ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          // 17pt drawn, 44pt touched.
          hitSlop={CLEAR_HIT_SLOP}
          onPress={() => onChangeText('')}
          className="items-center justify-center rounded-full active:opacity-60"
          style={{
            width: page ? 22 : CLEAR_SIZE,
            height: page ? 22 : CLEAR_SIZE,
            backgroundColor: CLEAR_FILL,
          }}>
          <SymbolView
            name="xmark"
            size={8}
            tintColor={theme.canvas}
            weight="semibold"
            resizeMode="scaleAspectFit"
          />
        </Pressable>
      ) : null}
    </View>
  );
}
