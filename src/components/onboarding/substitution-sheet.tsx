import { Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { declineCopy, redirectLabel, slotCopy } from '@/features/onboarding/ten-copy';
import { redirectOptions, type CountedKind, type TenSlot } from '@/features/onboarding/ten-slots';
import { useTheme } from '@/theme/tokens';

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Four tops, no dress — sixteen outfits", read off the projected plan. */
function optionSubtitle(slots: readonly TenSlot[], to: CountedKind, total: number): string {
  const count = slots.filter((s) => s.kind === to && s.status !== 'open').length + 1;
  return `${count} ${to} — ${total} outfits`;
}

/**
 * T-04's card content, with no `Modal` around it — the piece `dev-ten` renders
 * inline so every state can be reviewed in one scroll, and the piece
 * `SubstitutionSheet` below wraps for the real half-sheet presentation.
 */
export function SubstitutionSheetBody({
  slot,
  slots,
  onRedirect,
  onKeepOpen,
}: {
  slot: TenSlot;
  slots: readonly TenSlot[];
  onRedirect: (to: CountedKind) => void;
  onKeepOpen: () => void;
}) {
  const theme = useTheme();
  const options = redirectOptions(slots, slot.id);
  const copy = declineCopy(slot.kind);
  const slotWord = slotCopy(slot.kind, 1).phrase;

  return (
    <View
      className="rounded-t-sheet border-t border-rule bg-surface"
      style={{ paddingHorizontal: 22, paddingTop: 22 }}>
      <View
        style={{
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: theme.rule,
          alignSelf: 'center',
          marginBottom: 18,
        }}
      />
      <Text
        style={{
          fontSize: 11,
          fontWeight: '500',
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          // `muted`, not the atlas's literal `faint` — real content at 11px
          // fails AA in `faint` (free-tier-contract.md §4).
          color: theme.muted,
        }}>
        {`Slot ${slot.id} · ${slotWord}`}
      </Text>
      <View style={{ marginBottom: 8 }}>
        <Text variant="title" trim style={{ fontSize: 26, lineHeight: 30 }}>
          {copy.title}
        </Text>
      </View>
      <Text variant="callout" className="text-muted">
        {copy.body}
      </Text>

      <View style={{ marginTop: 16, gap: 8, paddingBottom: 24 }}>
        {options.map((option) => {
          const label =
            option.kind === 'open' ? 'Keep the slot open' : `${cap(redirectLabel(slots, option.to))} instead`;
          const sub =
            option.kind === 'open'
              ? `Finish with ${slots.length - 1} — ${option.total} outfits`
              : optionSubtitle(slots, option.to, option.total);
          const highlighted = option.kind === 'redirect' && option.recommended;

          return (
            <Pressable
              key={option.kind === 'open' ? 'open' : option.to}
              accessibilityRole="button"
              accessibilityLabel={`${label}. ${sub}. ${option.total} outfits.`}
              onPress={() => (option.kind === 'open' ? onKeepOpen() : onRedirect(option.to))}
              className="flex-row items-center justify-between rounded-md px-4 py-3.5 active:opacity-70"
              style={{
                borderWidth: highlighted ? 2 : 1,
                borderColor: highlighted ? theme.accent : theme.rule,
                backgroundColor: highlighted ? theme.blush : 'transparent',
              }}>
              <View className="flex-1 pr-3">
                <Text variant="body" className="font-medium">
                  {label}
                </Text>
                <Text variant="label" className="mt-0.5 text-muted">
                  {sub}
                </Text>
              </View>
              {/* `muted`, not `faint` — a computed count is never decorative,
                  and the standing refusal reserves `faint` for decoration and
                  dark grounds only (free-tier-contract.md §4). */}
              <Text variant="plate" style={{ color: highlighted ? theme.accent : theme.muted }}>
                {option.total}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * T-04 — the substitution sheet. Declining is not an escape hatch; it is a
 * choice with arithmetic attached, and every redirect shows the count it
 * would produce, computed by `outfit-count.ts` — never a table
 * (free-tier-contract.md §2).
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
            />
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
