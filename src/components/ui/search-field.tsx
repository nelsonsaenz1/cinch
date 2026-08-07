import { SymbolView } from 'expo-symbols';
import type { RefObject } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

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

/**
 * The tray-filled search row — Closet, Lately and Friends each hand-typed
 * the same eight lines (down to the literal `paddingVertical: 11` and
 * `fontSize: 17`) for the identical field.
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
        clearButtonMode="while-editing"
        accessibilityLabel={accessibilityLabel ?? placeholder}
        // 17 = the `body` size on the type scale — the precedent every
        // free-text field in the app follows.
        style={{
          flex: 1,
          paddingVertical: 11,
          fontFamily: 'HelveticaNeue',
          fontSize: 17,
          color: theme.ink,
        }}
      />
    </View>
  );
}
