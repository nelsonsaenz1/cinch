import { useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DateRangePicker } from '@/components/plan/date-range-picker';
import { Button, KeyboardAvoidingScreen, Text } from '@/components/ui';
import { BOARD_NAME_MAX, boardDraftProblem, formatBoardRange } from '@/features/boards/board-lines';
import type { Board, IsoDay } from '@/features/boards/types';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * KP-03's `Edit`, and everything a board is allowed to be.
 *
 * The atlas draws the control and states its whole contents in prose: "a name,
 * and optionally two dates. Nothing else. No cover image to choose, no
 * description, no colour." So this sheet has exactly two fields, and the third
 * thing it can do is delete the board — which keeps the plates, because
 * `outfits.board_id` is `on delete set null` and that declaration IS the rule.
 *
 * DATES ARE OPTIONAL TOGETHER. `boards_dates_paired` refuses a half-range in
 * the database; here the calendar simply cannot express one — the range picker
 * sets a start and then an end, and "Remove dates" clears both. The reason is
 * printed rather than merely enforced: a board with dates grows Send to
 * Packing, and a reader deciding whether to add dates deserves to know that is
 * what they are deciding.
 *
 * The calendar is `components/plan/date-range-picker`, imported rather than
 * re-drawn. It is the app's one calendar, it already refuses a range longer
 * than a trip, and a second hand-built month grid is how two screens end up
 * disagreeing about which day a week starts on.
 */

export type BoardEditSheetProps = {
  visible: boolean;
  board: Board | null;
  onSave: (write: { name: string; startsOn: IsoDay | null; endsOn: IsoDay | null }) => void;
  busy?: boolean;
  /** The caller confirms. Deleting a board is a decision about their data. */
  onDelete: () => void;
  deleting?: boolean;
  onDismiss: () => void;
};

export function BoardEditSheet({
  visible,
  board,
  onSave,
  busy = false,
  onDelete,
  deleting = false,
  onDismiss,
}: BoardEditSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState(board?.name ?? '');
  const [startsOn, setStartsOn] = useState<IsoDay | null>(board?.startsOn ?? null);
  const [endsOn, setEndsOn] = useState<IsoDay | null>(board?.endsOn ?? null);
  const [picking, setPicking] = useState(false);

  // Re-seed from the board in the render pass that opens the sheet, so editing
  // a second board never opens on the first one's name. Derivation, not an
  // effect — lint refuses `setState` inside `useEffect`, and an effect here
  // would show one frame of stale text besides.
  const [seededFor, setSeededFor] = useState<string | null>(visible ? (board?.id ?? null) : null);
  const openFor = visible ? (board?.id ?? null) : null;
  if (openFor !== seededFor) {
    setSeededFor(openFor);
    setName(board?.name ?? '');
    setStartsOn(board?.startsOn ?? null);
    setEndsOn(board?.endsOn ?? null);
    setPicking(false);
  }

  const problem = boardDraftProblem({ name, startsOn, endsOn });
  const dated = startsOn != null && endsOn != null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <KeyboardAvoidingScreen style={{ flex: 1 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onDismiss}
          style={{ flex: 1, backgroundColor: theme.scrim }}
        />

        <View
          className="rounded-t-plate bg-canvas"
          style={{ maxHeight: '90%', paddingBottom: insets.bottom + 16 }}>
          <View className="items-center pb-1 pt-2.5">
            <View className="h-[5px] w-9 rounded-full bg-sand" />
          </View>

          <ScrollView
            contentContainerClassName="px-gutter pb-2 pt-3"
            keyboardShouldPersistTaps="handled">
            <Text variant="plate" trim accessibilityRole="header">
              Edit board
            </Text>

            <Text variant="eyebrow" className="mb-2 mt-5">
              Name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Lisbon"
              placeholderTextColor={theme.ghost}
              maxLength={BOARD_NAME_MAX}
              accessibilityLabel="Board name"
              className="rounded-md border border-rule bg-surface px-4 font-body text-body text-ink"
              style={{ minHeight: MIN_TAP_TARGET + 4 }}
            />

            <Text variant="eyebrow" className="mb-2 mt-6">
              Dates
            </Text>
            <Text variant="note">
              Optional, and optional together. A board with dates can be sent to Packing whole;
              without them it stays a plain collection.
            </Text>

            {dated ? (
              <View className="mt-3 flex-row items-center justify-between gap-3">
                {/* The range is its own control: tapping it opens the calendar
                    again. Without that, a board that already has dates could
                    only have them removed and re-added, which is two taps to
                    undo a typo in one. */}
                <Pressable
                  onPress={() => setPicking((open) => !open)}
                  accessibilityRole="button"
                  accessibilityLabel={`Dates, ${formatBoardRange(startsOn!, endsOn!)}`}
                  accessibilityHint="Opens the calendar"
                  hitSlop={8}
                  style={{ minHeight: MIN_TAP_TARGET - 12 }}
                  className="flex-1 justify-center active:opacity-60">
                  <Text variant="body">{formatBoardRange(startsOn!, endsOn!)}</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    // Both, never one. A half-range is not a shorter trip.
                    setStartsOn(null);
                    setEndsOn(null);
                    setPicking(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Remove dates"
                  hitSlop={8}
                  style={{ minHeight: MIN_TAP_TARGET - 12 }}
                  className="justify-center active:opacity-60">
                  <Text variant="label">Remove dates</Text>
                </Pressable>
              </View>
            ) : null}

            {picking || (!dated && startsOn != null) ? (
              <View className="mt-3">
                <DateRangePicker
                  startsOn={startsOn}
                  endsOn={endsOn}
                  onChange={(range) => {
                    setStartsOn(range.startsOn);
                    setEndsOn(range.endsOn);
                  }}
                />
              </View>
            ) : dated ? null : (
              <Button
                title="Add dates"
                variant="secondary"
                onPress={() => setPicking(true)}
                haptic
                className="mt-3 self-start px-5"
              />
            )}

            {/* The one refusal that needs saying out loud. Everything else the
                button's disabled state covers. */}
            {problem === 'half-range' ? (
              <Text variant="note" className="mt-3" style={{ color: theme.ink }}>
                Pick the day it ends too — a board takes both dates or neither.
              </Text>
            ) : null}

            <Button
              title="Save"
              variant="ink"
              onPress={() => onSave({ name: name.trim(), startsOn, endsOn })}
              disabled={problem !== null}
              loading={busy}
              haptic
              className="mt-6 self-stretch"
            />
            <Button
              title="Cancel"
              variant="ghost"
              onPress={onDismiss}
              disabled={busy}
              haptic={false}
              className="mt-1 self-stretch"
            />

            {/* `critical`, not the accent: undoing something is not the
                recommendation. The plates are named in the label's hint
                because "delete board" is exactly the phrase people expect to
                take the contents with it, and here it does not. */}
            <Pressable
              onPress={onDelete}
              disabled={deleting || busy}
              accessibilityRole="button"
              accessibilityLabel="Delete board"
              accessibilityHint="The plates on it stay saved and return to All"
              style={{ minHeight: MIN_TAP_TARGET }}
              className="mt-3 items-center justify-center active:opacity-60">
              <Text variant="label" style={{ color: theme.critical }}>
                {deleting ? 'Deleting…' : 'Delete board'}
              </Text>
            </Pressable>
            <Text variant="noteSmall" className="mt-1 text-center">
              The plates stay saved — they return to All.
            </Text>
          </ScrollView>
        </View>
      </KeyboardAvoidingScreen>
    </Modal>
  );
}
