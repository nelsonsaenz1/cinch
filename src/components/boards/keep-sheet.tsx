import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, KeyboardAvoidingScreen, Rule, Text } from '@/components/ui';
import { BOARD_NAME_MAX, boardPlateCountLabel } from '@/features/boards/board-lines';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * KP-04 — the sheet a look is kept from, and the only place a plate moves.
 *
 * "Raised from any plate. Boards are optional: Keep it with nothing selected
 * saves to All. The sheet states where saved looks live, once, because the
 * fear the reader brings is that keeping something publishes it."
 *
 * That last clause is the design decision this component exists to hold. The
 * privacy line is printed once, plainly, above the list — not repeated per
 * row, not tucked into a footnote, not made into a lock icon. Boards are never
 * shared; a single plate can go through Share a Look, a board cannot; and
 * neither fact is worth stating twice on one sheet.
 *
 * ONE SHEET, TWO MOMENTS. Keeping and moving are the same action from the
 * reader's side — "a plate sits on one board at a time; moving it is one tap
 * in the same sheet that saved it" — so `mode` only changes what the sheet is
 * called and what its commit button says. The list, the radios and the New
 * board row are identical, which is what makes the second visit feel like the
 * first one.
 */

export type KeepSheetBoard = {
  id: string;
  name: string;
  plateCount: number;
};

export type KeepSheetProps = {
  visible: boolean;
  /** `keep` for a look that is not in the collection yet; `move` for one that is. */
  mode: 'keep' | 'move';
  boards: KeepSheetBoard[];
  /** `null` is All — the absence of a board, and a real answer. */
  selectedBoardId: string | null;
  onSelectBoard: (boardId: string | null) => void;
  /** Called with a trimmed, non-empty name. The caller creates and selects it. */
  onCreateBoard: (name: string) => void;
  creating?: boolean;
  onCommit: () => void;
  busy?: boolean;
  onDismiss: () => void;
  /**
   * `move` only. The caller confirms — KP-05's "deleting a plate is confirmed
   * once" is a decision about the user's data, and a presentational sheet is
   * the wrong place to hold it.
   */
  onRemove?: () => void;
  removing?: boolean;
};

export function KeepSheet({
  visible,
  mode,
  boards,
  selectedBoardId,
  onSelectBoard,
  onCreateBoard,
  creating = false,
  onCommit,
  busy = false,
  onDismiss,
  onRemove,
  removing = false,
}: KeepSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // The New board field, which replaces the list rather than growing a second
  // form beneath it: naming a board is the only thing happening at that
  // moment, and a keyboard over a scrolling list of radios is a sheet nobody
  // can aim at.
  const [naming, setNaming] = useState(false);
  const [draftName, setDraftName] = useState('');

  // Render-phase reset, not an effect: the field must be gone in the same pass
  // that hides the sheet, never a frame later, or the next plate opens on the
  // last one's half-typed board name. (Lint refuses `setState` in an effect
  // for exactly this class of bug.)
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (!visible) {
      setNaming(false);
      setDraftName('');
    }
  }

  const trimmed = draftName.trim();
  const canCreate = trimmed.length > 0 && trimmed.length <= BOARD_NAME_MAX && !creating;

  const commitName = () => {
    if (!canCreate) return;
    onCreateBoard(trimmed);
    setNaming(false);
    setDraftName('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <KeyboardAvoidingScreen style={{ flex: 1 }}>
        {/* `scrim` is the one dimming value in the system — warm ink at 40%.
            Tapping it is "Not now": dismissing a keep is not an answer to
            anything, and nothing is written either way. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onDismiss}
          style={{ flex: 1, backgroundColor: theme.scrim }}
        />

        <View
          className="rounded-t-plate bg-canvas"
          style={{ maxHeight: '86%', paddingBottom: insets.bottom + 16 }}>
          {/* The grabber — the sheet's own furniture, saying this rises over
              the plate and drops back into it. */}
          <View className="items-center pb-1 pt-2.5">
            <View className="h-[5px] w-9 rounded-full bg-sand" />
          </View>

          <ScrollView
            contentContainerClassName="px-gutter pb-2 pt-3"
            keyboardShouldPersistTaps="handled">
            <Text variant="plate" trim accessibilityRole="header">
              {mode === 'keep' ? 'Keep this look' : 'Move this look'}
            </Text>
            {/* Said once. The whole sheet is built around this sentence being
                the answer to the question the reader actually arrived with. */}
            <Text variant="note" className="mt-3">
              Saved looks live in your closet, not on anyone’s feed.
            </Text>

            {naming ? (
              <NewBoardField
                value={draftName}
                onChange={setDraftName}
                onCancel={() => {
                  setNaming(false);
                  setDraftName('');
                }}
                onCreate={commitName}
                canCreate={canCreate}
                creating={creating}
              />
            ) : (
              <View className="mt-4 overflow-hidden rounded-lg border border-rule bg-surface">
                {boards.map((board, i) => (
                  <View key={board.id}>
                    {i > 0 ? <Rule tone="hairline" /> : null}
                    <BoardRow
                      name={board.name}
                      detail={boardPlateCountLabel(board.plateCount)}
                      selected={selectedBoardId === board.id}
                      // Tapping the board you are already on takes the plate
                      // back to All. Without that there is no way to undo a
                      // board choice, and "boards are optional" would only be
                      // true until the first tap.
                      onPress={() =>
                        onSelectBoard(selectedBoardId === board.id ? null : board.id)
                      }
                    />
                  </View>
                ))}

                {boards.length > 0 ? <Rule tone="hairline" /> : null}

                <Pressable
                  onPress={() => setNaming(true)}
                  accessibilityRole="button"
                  accessibilityLabel="New board"
                  style={{ minHeight: MIN_TAP_TARGET }}
                  className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-60">
                  <Text variant="callout" className="flex-1 text-muted">
                    New board…
                  </Text>
                  <SymbolView
                    name="plus"
                    size={13}
                    tintColor={theme.muted}
                    resizeMode="scaleAspectFit"
                  />
                </Pressable>
              </View>
            )}

            {/* Ink, not oxblood: the sheet spends no accent, same as every
                other commit in this atlas. */}
            <Button
              title={mode === 'keep' ? 'Keep it' : 'Move it'}
              variant="ink"
              onPress={onCommit}
              loading={busy}
              disabled={naming}
              haptic
              className="mt-4 self-stretch"
            />
            <Button
              title="Not now"
              variant="ghost"
              onPress={onDismiss}
              disabled={busy}
              haptic={false}
              className="mt-1 self-stretch"
            />

            {mode === 'move' && onRemove ? (
              // A text link, not a button: it has no ground, so it takes none.
              // `critical` rather than the accent — oxblood already means "the
              // one thing to do here", and a destructive action wearing it
              // reads as the recommendation.
              <Pressable
                onPress={onRemove}
                disabled={removing || busy}
                accessibilityRole="button"
                accessibilityLabel="Remove from Saved"
                style={{ minHeight: MIN_TAP_TARGET }}
                className="mt-2 items-center justify-center active:opacity-60">
                <Text variant="label" style={{ color: theme.critical }}>
                  {removing ? 'Removing…' : 'Remove from Saved'}
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingScreen>
    </Modal>
  );
}

/**
 * One board in the list: the name, its size, and the radio.
 *
 * The count is `muted`, not the atlas's #A29C90 (`byline`). It is the one
 * thing that distinguishes two boards with similar names when you are aiming
 * at a 44pt row, so it is content.
 */
function BoardRow({
  name,
  detail,
  selected,
  onPress,
}: {
  name: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${name}, ${detail}`}
      style={{ minHeight: MIN_TAP_TARGET }}
      className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-60">
      <Text variant="callout" className="flex-1" numberOfLines={1}>
        {name}
      </Text>
      <Text variant="caption">{detail}</Text>
      {/* A ring that fills with ink. Drawn rather than an SF Symbol pair so
          the two states are the same circle at the same diameter — a symbol
          swap moves the centre by a point and the row visibly twitches. */}
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 1.5,
          borderColor: selected ? theme.ink : theme.ruleStrong,
          backgroundColor: selected ? theme.ink : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {selected ? (
          <View
            style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: theme.canvas }}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * "New board…", opened.
 *
 * A name and nothing else. Dates are not asked for here on purpose: KP-04 has
 * one job, and a board that turns out to be a trip grows its dates from its
 * own Edit sheet, where the calendar has room and where the "both or neither"
 * rule can be shown rather than enforced silently.
 */
function NewBoardField({
  value,
  onChange,
  onCancel,
  onCreate,
  canCreate,
  creating,
}: {
  value: string;
  onChange: (next: string) => void;
  onCancel: () => void;
  onCreate: () => void;
  canCreate: boolean;
  creating: boolean;
}) {
  const theme = useTheme();

  return (
    <View className="mt-4">
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Lisbon"
        placeholderTextColor={theme.ghost}
        maxLength={BOARD_NAME_MAX}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={onCreate}
        accessibilityLabel="Board name"
        className="rounded-md border border-rule bg-surface px-4 font-body text-body text-ink"
        style={{ minHeight: MIN_TAP_TARGET + 4 }}
      />
      <View className="mt-2.5 flex-row gap-2">
        <Button
          title="Create"
          variant="ink"
          onPress={onCreate}
          disabled={!canCreate}
          loading={creating}
          haptic
          className="px-5"
        />
        <Button title="Cancel" variant="ghost" onPress={onCancel} haptic={false} className="px-4" />
      </View>
    </View>
  );
}
