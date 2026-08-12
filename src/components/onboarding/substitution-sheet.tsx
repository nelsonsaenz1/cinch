import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import {
  declineCopy,
  keepSlotLabel,
  outfitsCell,
  recommendationNote,
  redirectCtaLabel,
  redirectOptionLabel,
} from '@/features/onboarding/ten-copy';
import {
  redirectOptions,
  type CountedKind,
  type RedirectOption,
  type TenSlot,
} from '@/features/onboarding/ten-slots';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/** A stable key for an option row — the kind it spends, or "open". */
function optionKey(option: RedirectOption): string {
  return option.kind === 'open' ? 'open' : option.to;
}

/**
 * T-04's card content, with no `Modal` around it — the piece a fixture renders
 * inline so the state can be photographed in one scroll, and the piece
 * `SubstitutionSheet` below wraps for the real half-sheet presentation.
 *
 * DECLINING IS A CHOICE WITH ARITHMETIC ATTACHED. Every row carries the count
 * the FINISHED closet would make, from `countOutfits(plannedTally(…))` — never
 * a table, and never the partial closet's count, because "a fourth top instead
 * — sixteen outfits" has to be true before a fourth top has been photographed.
 *
 * WHY THE RECOMMENDATION CAN SHOW THE SMALLER NUMBER. The recommended redirect
 * is an editorial judgment about the outfits Cinch builds well, not the largest
 * product of the tally (see `REDIRECT_TARGETS`). Whenever another row
 * out-counts it, `recommendationNote` says so on the sheet — a recommendation
 * that shows the smaller figure in silence reads as either a bug or a trick.
 *
 * SELECTION IS NEVER COLOUR ALONE: the selected row carries a 1.5px ink ring,
 * the recommended row carries the word "Recommended", and the filled action
 * names the option it will spend.
 */
export function SubstitutionSheetBody({
  slot,
  slots,
  onRedirect,
  onKeepOpen,
  onKeepSlot,
}: {
  slot: TenSlot;
  slots: readonly TenSlot[];
  onRedirect: (to: CountedKind) => void;
  onKeepOpen: () => void;
  /** Cancel the decline. The position stays what it was and stays unfilled. */
  onKeepSlot: () => void;
}) {
  const theme = useTheme();
  const options = redirectOptions(slots, slot.id);
  const copy = declineCopy(slot.kind);
  const note = recommendationNote(slots, options);

  // The recommendation is the default selection, so a reader who agrees with it
  // taps once. Re-seeded during the render that receives a DIFFERENT slot —
  // the same "adjust state keyed by identity" pattern the count stepper uses,
  // rather than an effect, which would show one frame of the previous slot's
  // selection and trip the cascading-render rule.
  const recommended = options.find((o) => o.kind === 'redirect' && o.recommended) ?? options[0];
  const defaultKey = recommended ? optionKey(recommended) : 'open';
  const [seededFor, setSeededFor] = useState(slot.id);
  const [selectedKey, setSelectedKey] = useState(defaultKey);
  if (slot.id !== seededFor) {
    setSeededFor(slot.id);
    setSelectedKey(defaultKey);
  }

  const selected = options.find((o) => optionKey(o) === selectedKey) ?? recommended;

  return (
    <View
      className="rounded-t-sheet border-t border-rule bg-surface"
      style={{ paddingHorizontal: 24, paddingTop: 20 }}>
      <View
        style={{
          width: 44,
          height: 5,
          borderRadius: 4,
          backgroundColor: theme.rule,
          alignSelf: 'center',
          marginBottom: 16,
        }}
      />
      <View style={{ marginBottom: 10 }}>
        <Text variant="title" trim accessibilityRole="header">
          {copy.title}
        </Text>
      </View>
      <Text variant="note" style={{ fontSize: 16, lineHeight: 25 }}>
        {copy.body}
      </Text>

      <View style={{ marginTop: 20, gap: 10 }}>
        {options.map((option) => {
          const key = optionKey(option);
          const isSelected = key === selectedKey;
          const isRecommended = option.kind === 'redirect' && option.recommended;
          const label = redirectOptionLabel(slots, option);
          const cell = outfitsCell(option.total);

          return (
            <Pressable
              key={key}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${label}${isRecommended ? ', recommended' : ''}. ${cell}.`}
              onPress={() => setSelectedKey(key)}
              className="flex-row items-center justify-between active:opacity-70"
              style={{
                minHeight: MIN_TAP_TARGET,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderWidth: isSelected ? 1.5 : 1,
                borderColor: isSelected ? theme.ink : theme.rule,
              }}>
              <View className="flex-1 pr-3">
                <Text
                  variant="body"
                  className={isSelected ? 'font-medium' : ''}
                  style={{ fontSize: 17 }}>
                  {label}
                </Text>
                {isRecommended ? (
                  <Text variant="note" style={{ fontSize: 14, marginTop: 2 }}>
                    Recommended
                  </Text>
                ) : null}
              </View>
              {/* A computed count is never decorative, so `muted` — `faint`
                  fails AA on this ground and the standing refusal reserves it
                  for placeholder glyphs. */}
              <Text variant="note" style={{ fontSize: 15 }}>
                {cell}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {note ? (
        <Text variant="note" style={{ fontSize: 14, lineHeight: 21, marginTop: 14 }}>
          {note}
        </Text>
      ) : null}

      <View style={{ marginTop: 18, paddingBottom: 12, gap: 4 }}>
        <Button
          title={selected ? redirectCtaLabel(slots, selected) : 'Keep the slot open'}
          onPress={() => {
            if (!selected || selected.kind === 'open') onKeepOpen();
            else onRedirect(selected.to);
          }}
          className="self-stretch"
        />
        <Button
          title={keepSlotLabel(slot.kind)}
          variant="ghost"
          onPress={onKeepSlot}
          className="self-stretch"
        />
      </View>
    </View>
  );
}

/**
 * T-04 — the substitution sheet. A declined slot is redirected, never dropped:
 * the position keeps its place in the grid and spends itself on something else,
 * and "keep the slot open" is always last and always offered.
 */
export function SubstitutionSheet({
  visible,
  slot,
  slots,
  onRedirect,
  onKeepOpen,
  onDismiss,
}: {
  visible: boolean;
  slot: TenSlot | null;
  slots: readonly TenSlot[];
  onRedirect: (to: CountedKind) => void;
  onKeepOpen: () => void;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  if (!slot) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable
        accessibilityLabel="Dismiss"
        onPress={onDismiss}
        className="flex-1 justify-end"
        style={{ backgroundColor: theme.scrim }}>
        <Pressable onPress={() => {}}>
          <SafeAreaView edges={['bottom']}>
            <SubstitutionSheetBody
              slot={slot}
              slots={slots}
              onRedirect={onRedirect}
              onKeepOpen={onKeepOpen}
              onKeepSlot={onDismiss}
            />
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
