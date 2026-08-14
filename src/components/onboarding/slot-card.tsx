import { useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { starterCardCopy } from '@/features/onboarding/ten-copy';
import { isAccessibilityScale } from '@/features/onboarding/ten-layout';
import type { StarterReadiness, StarterSuggestion } from '@/features/onboarding/starter-readiness';

/**
 * The card beneath the grid — T-01, T-02 and T-02/AX.
 *
 * ONE ADAPTIVE SUGGESTION, not a per-slot argument.
 *
 * This card used to justify whichever named position was foregrounded: "a
 * third top — something you'd wear to dinner". That reasoning was written in
 * advance about a wardrobe nobody had seen, which is exactly how the grid
 * ended up arguing for a dress to a reader who owns none. It now reads the
 * classified closet and names the single most useful next piece, with the
 * count that piece would produce — see `starter-readiness.ts` for the model
 * and `ten-copy.ts` for the sentences.
 *
 * TWO ACTIONS, IN THE ATLAS'S ORDER. Photograph is the one filled action.
 * Library is a peer beside it rather than a link underneath: Apple's system
 * picker runs out of process and shares only the photos selected, so a reader
 * who does not want to stand over a wardrobe with a camera should not have to
 * discover that.
 *
 * SKIP IS GONE. It opened the substitution sheet, which asked "no dress? spend
 * the slot elsewhere" — a question that only means something when the slot was
 * asking for a dress in the first place. A generic cell has nothing to decline
 * and nothing to spend, so the control has no referent and is not drawn.
 *
 * AT THE LARGEST TYPE the body sentence is dropped and the actions stack full
 * width in the same order. That is recomposition, not truncation — the title
 * already carries the suggestion, and keeping both would push the actions off
 * the screen, which is the one failure the atlas names outright.
 */
export function SlotCard({
  readiness,
  suggestion,
  slotId,
  onPhotograph,
  onLibrary,
  /** Overridable so a fixture can photograph the AX layout without the OS. */
  fontScale: fontScaleOverride,
}: {
  readiness: StarterReadiness;
  suggestion: StarterSuggestion | null;
  /** The position the actions will fill. Named so the reader can see which. */
  slotId: number;
  onPhotograph: () => void;
  onLibrary: () => void;
  fontScale?: number;
}) {
  const window = useWindowDimensions();
  const fontScale = fontScaleOverride ?? window.fontScale;
  const stacked = isAccessibilityScale(fontScale);

  const copy = starterCardCopy(readiness, suggestion);

  return (
    <View className="rounded-plate border border-rule bg-surface" style={{ padding: 16 }}>
      <Text variant="eyebrow">{`Slot ${slotId} · ${copy.eyebrow}`}</Text>
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
        <Button
          title="Photograph"
          onPress={onPhotograph}
          className={stacked ? 'self-stretch' : 'flex-1'}
        />
        <Button
          title="Library"
          variant="secondary"
          onPress={onLibrary}
          accessibilityHint="Pick this piece from photographs already on your phone"
          className={stacked ? 'self-stretch' : ''}
        />
      </View>
    </View>
  );
}
