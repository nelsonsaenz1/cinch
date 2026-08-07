import { SymbolView } from 'expo-symbols';
import type { RefObject } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme/tokens';

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
};

/** The clear control's disc — ink at 18%, a quiet occlusion rather than chrome. */
const CLEAR_FILL = 'rgba(28,26,22,0.18)';

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
}: SearchFieldProps) {
  const theme = useTheme();

  return (
    <View className={`flex-row items-center gap-2 rounded-md bg-tray px-3.5 ${className}`}>
      <SymbolView
        name="magnifyingglass"
        size={15}
        tintColor={theme.faint}
        resizeMode="scaleAspectFit"
      />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        autoFocus={autoFocus}
        placeholder={placeholder}
        placeholderTextColor={theme.faint}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        returnKeyType="search"
        accessibilityLabel={accessibilityLabel ?? placeholder}
        style={{
          flex: 1,
          paddingVertical: 11,
          fontFamily: 'HelveticaNeue',
          fontSize: 16,
          color: theme.ink,
        }}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          // 17pt drawn, 44pt touched.
          hitSlop={14}
          onPress={() => onChangeText('')}
          className="items-center justify-center rounded-full active:opacity-60"
          style={{ width: 17, height: 17, backgroundColor: CLEAR_FILL }}>
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
