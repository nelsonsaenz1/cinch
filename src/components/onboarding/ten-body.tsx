import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { SlotCard } from '@/components/onboarding/slot-card';
import { TenGrid } from '@/components/onboarding/ten-grid';
import { Text } from '@/components/ui/text';
import { TEN_TITLE } from '@/features/onboarding/ten-copy';
import {
  starterSuggestion,
  type StarterReadiness,
} from '@/features/onboarding/starter-readiness';
import { filledCount, nextSlot, type TenSlot } from '@/features/onboarding/ten-slots';

/**
 * The Ten's page — T-01, T-02, T-02/AX, and the masthead T-05 keeps.
 *
 * Extracted from the route so the fixture routes photograph the SAME object
 * the app ships rather than a second layout that agrees with it by hand. The
 * route owns the state machine; this owns the page.
 *
 * THE COUNT IS ABOVE THE TITLE, not beside it. "0 of 10" prints from the first
 * frame because the flow has genuinely started — it is a position, not a score,
 * and never a bar or a percentage.
 *
 * AND NOTHING ELSE BEFORE THE CLOTHES. The masthead used to print a third
 * block, `TEN_SUPPORT` — "Build the ten pieces you reach for most." — which was
 * static across all ten states: the count above it was the progress and the
 * SlotCard below it is the instruction, written from this actual closet. It is
 * gone and the space went to the grid. Count → title → clothing.
 *
 * `children` replaces the grid and the card entirely, which is how T-05 keeps
 * the masthead: a denied permission is drawn UNDER the count, so the work
 * already done stays visible from the failure. The repair state (ten filed,
 * still not styleable) uses the same door.
 *
 * `readiness` is the REAL closet, read from the classifier. The page cannot
 * derive it from `slots` and must not try: a position knows which garment id
 * sits in it and nothing whatever about what that garment turned out to be.
 */
export function TenBody({
  slots,
  readiness,
  foregroundedId,
  garmentNames,
  imageUris,
  onSlotPress,
  onPhotograph,
  onLibrary,
  fontScale,
  footer,
  children,
}: {
  slots: readonly TenSlot[];
  readiness: StarterReadiness;
  /** The slot the actions will fill. Defaults to the next empty one. */
  foregroundedId?: number | null;
  garmentNames?: Record<number, string | null>;
  imageUris?: Record<number, string | undefined>;
  onSlotPress?: (slotId: number) => void;
  onPhotograph?: (slotId: number) => void;
  onLibrary?: (slotId: number) => void;
  /** Overridable so a fixture can photograph the AX layout without the OS. */
  fontScale?: number;
  /**
   * Drawn UNDER the grid, never instead of it. The repair state uses this
   * rather than `children` on purpose: a full grid that cannot be styled must
   * stay tappable, because tapping a piece is the whole fix.
   */
  footer?: ReactNode;
  /** Replaces the grid and the card entirely. T-05's fork passes its own. */
  children?: ReactNode;
}) {
  const filled = filledCount(slots);
  const foregrounded = slots.find((s) => s.id === foregroundedId) ?? nextSlot(slots) ?? null;
  const suggestion = starterSuggestion(readiness);

  return (
    <ScrollView contentContainerClassName="px-gutter pb-8" keyboardShouldPersistTaps="handled">
      <Text
        variant="eyebrow"
        className="pt-1"
        style={{ fontVariant: ['tabular-nums'] }}
        accessibilityLabel={`${filled} of ${slots.length} filled`}>
        {`${filled} of ${slots.length}`}
      </Text>
      <View style={{ marginTop: 4 }}>
        <Text variant="title" trim accessibilityRole="header" style={{ fontSize: 32 }}>
          {TEN_TITLE}
        </Text>
      </View>

      {children ?? (
        <>
          <View style={{ marginTop: 20 }}>
            <TenGrid
              slots={slots}
              foregroundedId={foregrounded?.id ?? null}
              garmentNames={garmentNames}
              imageUris={imageUris}
              onSlotPress={onSlotPress}
              fontScale={fontScale}
            />
          </View>

          {foregrounded ? (
            <View className="mt-5">
              <SlotCard
                readiness={readiness}
                suggestion={suggestion}
                slotId={foregrounded.id}
                fontScale={fontScale}
                onPhotograph={() => onPhotograph?.(foregrounded.id)}
                onLibrary={() => onLibrary?.(foregrounded.id)}
              />
            </View>
          ) : null}

          {footer}
        </>
      )}
    </ScrollView>
  );
}
