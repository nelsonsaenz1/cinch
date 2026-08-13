import { useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { slotCopy, slotOrdinalWithinKind } from '@/features/onboarding/ten-copy';
import { isAccessibilityScale } from '@/features/onboarding/ten-layout';
import { type TenSlot } from '@/features/onboarding/ten-slots';

/**
 * The card beneath the grid — T-01, T-02 and T-02/AX.
 *
 * One slot's single line of reasoning, and only while it is the foregrounded
 * slot: the grid is the subject of the screen and a sentence under every cell
 * would bury it.
 *
 * THREE ACTIONS, IN THE ATLAS'S ORDER. Photograph is the one filled action.
 * Library is a peer beside it rather than a link underneath. Apple's system
 * picker runs out of process and shares only the photos selected, so a reader
 * who does not want to stand over a wardrobe with a camera should not have to
 * discover that. Skip appears from the second slot onward, and never on the
 * bag: the bag has no redirect, so there is nothing for a decline to spend.
 *
 * AT THE LARGEST TYPE the reasoning sentence is dropped and the actions stack
 * full width in the same order. That is recomposition, not truncation — the
 * title already carries the argument, and keeping both would push the actions
 * off the screen, which is the one failure the atlas names outright.
 */
export function SlotCard({
  slot,
  slots,
  onPhotograph,
  onLibrary,
  onSkip,
  /** Overridable so a fixture can photograph the AX layout without the OS. */
  fontScale: fontScaleOverride,
}: {
  slot: TenSlot;
  /** The full ten, so this card can rank itself among same-kind siblings. */
  slots: readonly TenSlot[];
  onPhotograph: () => void;
  onLibrary: () => void;
  onSkip?: () => void;
  fontScale?: number;
}) {
  const window = useWindowDimensions();
  const fontScale = fontScaleOverride ?? window.fontScale;
  const stacked = isAccessibilityScale(fontScale);

  const n = slotOrdinalWithinKind(slots, slot.id);
  const copy = slotCopy(slot.kind, n);
  const canSkip = slot.kind !== 'bag' && Boolean(onSkip);

  const photograph = (
    <Button
      title="Photograph"
      onPress={onPhotograph}
      className={stacked ? 'self-stretch' : 'flex-1'}
    />
  );
  const library = (
    <Button
      title="Library"
      variant="secondary"
      onPress={onLibrary}
      accessibilityHint="Pick this piece from photographs already on your phone"
      className={stacked ? 'self-stretch' : ''}
    />
  );
  const skip = canSkip ? (
    <Button
      title="Skip"
      variant="ghost"
      onPress={onSkip}
      accessibilityHint="Spend this slot on something else, or leave it open"
      className={stacked ? 'self-stretch' : ''}
    />
  ) : null;

  return (
    <View className="rounded-plate border border-rule bg-surface" style={{ padding: 16 }}>
      <Text variant="eyebrow">{`Slot ${slot.id} · ${copy.phrase}`}</Text>
      {/* 19px Medium — a true label, so Medium is correct here. `mb-*` on this
          sibling rather than `mt-*` on the sentence below: a top margin against
          a trimmed box cancels to roughly nothing. */}
      <Text variant="heading" className="mb-1" style={{ fontSize: 19, marginTop: 6 }}>
        {copy.title}
      </Text>
      {stacked ? null : (
        <Text variant="note" style={{ fontSize: 15, lineHeight: 22 }}>
          {copy.body}
        </Text>
      )}
      <View
        className={stacked ? '' : 'flex-row items-center'}
        style={{ marginTop: 14, gap: stacked ? 12 : 10 }}>
        {photograph}
        {library}
        {skip}
      </View>
    </View>
  );
}
