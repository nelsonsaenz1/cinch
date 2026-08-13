/**
 * CPV2-01 and CPV2-03 — the field, the microphone beside it, and the one action.
 *
 * Presentational, like `listening-screen.tsx` and for the same reason: the live
 * route and the fixture routes must render the SAME pixels, and the only way to
 * be sure of that is for there to be one component and for it to own no state.
 * Everything here is a prop; there is not a hook in the file except `useTheme`.
 *
 * CPV2-01 AND CPV2-03 ARE ONE COMPONENT because they are one screen. The atlas
 * draws them separately to show the transition, but the difference between them
 * is a transcript in the field and a line above it — not a different layout,
 * not a different action position. Building two would guarantee they drifted.
 */

import type { RefObject } from 'react';
import { Pressable, View, type TextInput } from 'react-native';

import { Notice } from '@/components/ui/notice';
import { Button } from '@/components/ui/button';
import { SearchField } from '@/components/ui/search-field';
import { Text } from '@/components/ui/text';
import {
  FIELD_HELP,
  FIELD_LABEL,
  FIND_ACTION,
  FROM_YOUR_WORDS,
  HELD_WALKTHROUGH,
  HELD_WALKTHROUGH_HEADING,
  heardLine,
  saidLine,
  SEARCH_AGAIN_ACTION,
  TRANSCRIPT_EDIT_HELP,
  WALKTHROUGH_PRIVACY,
} from '@/features/catalogue/copy';
import { useTheme } from '@/theme/tokens';

/** Atlas CPV2-01: the microphone is a 56 pt square beside the field. */
const MIC = 56;

export type SearchHeaderProps = {
  text: string;
  onChangeText: (next: string) => void;
  /** Enabled state of the one forward action. */
  canSearch: boolean;
  onSubmit: () => void;
  onSpeak: () => void;
  /** True once a transcript has landed — swaps the action and adds the heard line. */
  transcribed?: boolean;
  /** Disables the microphone while a transcript is being made. */
  micBusy?: boolean;
  /** CPV2-V02: the verbatim utterance, quoted under the extracted words. */
  said?: string;
  fromWalkthrough?: boolean;
  /** A settled state with its own recovery, never an error row. */
  permissionDenied?: boolean;
  /** A transient failure, with the one action that fixes it. */
  failureMessage?: string | null;
  failureAction?: { label: string; onPress: () => void } | null;
  inputRef?: RefObject<TextInput | null>;
};

export function SearchHeader({
  text,
  onChangeText,
  canSearch,
  onSubmit,
  onSpeak,
  transcribed = false,
  micBusy = false,
  said,
  fromWalkthrough = false,
  permissionDenied = false,
  failureMessage = null,
  failureAction = null,
  inputRef,
}: SearchHeaderProps) {
  const theme = useTheme();

  return (
    <View className="gap-2 px-gutter pb-3">
      {fromWalkthrough ? (
        <View className="gap-1 pb-1">
          <Text variant="eyebrow">{FROM_YOUR_WORDS}</Text>
          {said ? <Text variant="noteSmall">{saidLine(said)}</Text> : null}
        </View>
      ) : (
        <Text variant="noteSmall">{FIELD_HELP}</Text>
      )}

      <Text variant="label">{FIELD_LABEL}</Text>

      {/* CPV2-03's heard line tracks the FIELD, not the transcript, so editing
          updates it and the screen never shows two different queries. */}
      {transcribed && text ? (
        <View className="gap-0.5">
          <Text variant="noteSmall">{heardLine(text)}</Text>
          <Text variant="noteSmall">{TRANSCRIPT_EDIT_HELP}</Text>
        </View>
      ) : null}

      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <SearchField
            value={text}
            onChangeText={onChangeText}
            placeholder={FIELD_LABEL}
            autoCapitalize="none"
            autoCorrect={false}
            inputRef={inputRef}
          />
        </View>

        {/* The 56 pt square. A peer of the field, inside the same group — "both
            inputs are one control set rather than two features". */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Say it instead"
          accessibilityState={{ disabled: micBusy }}
          disabled={micBusy}
          onPress={onSpeak}
          className="items-center justify-center rounded-xl bg-surface active:opacity-70"
          style={{
            width: MIC,
            height: MIC,
            borderWidth: 1,
            borderColor: theme.rule,
            opacity: micBusy ? 0.5 : 1,
          }}>
          <Text variant="body" style={{ color: theme.accent }}>
            ●
          </Text>
        </Pressable>
      </View>

      {permissionDenied ? (
        <Notice message="Cinch cannot hear the microphone. You can turn it on in Settings, or type it instead." />
      ) : null}

      {failureMessage ? (
        <Notice
          tone="critical"
          message={failureMessage}
          action={failureAction ?? undefined}
        />
      ) : null}

      <Button
        title={transcribed ? SEARCH_AGAIN_ACTION : FIND_ACTION}
        disabled={!canSearch}
        onPress={onSubmit}
      />

      {fromWalkthrough ? (
        <View className="gap-1 rounded-2xl bg-tray p-4">
          <Text variant="eyebrow">{HELD_WALKTHROUGH_HEADING}</Text>
          <Text variant="noteSmall">{HELD_WALKTHROUGH}</Text>
          <Text variant="noteSmall">{WALKTHROUGH_PRIVACY}</Text>
        </View>
      ) : null}
    </View>
  );
}
