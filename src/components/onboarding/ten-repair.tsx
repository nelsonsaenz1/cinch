import { TroublePlate } from '@/components/onboarding/ten-parts';
import { repairCopy } from '@/features/onboarding/ten-copy';
import type { TenMeasure } from '@/features/onboarding/ten-spec';
import type { StarterReadiness } from '@/features/onboarding/starter-readiness';

/**
 * Ten pieces filed, and the closet still cannot be styled.
 *
 * A state the named template could not produce and therefore never had: ten
 * positions that each demanded a category always finished with a top, a bottom
 * and a pair of shoes in them. Generic positions carry no such guarantee — ten
 * watches is ten pieces — so this is where a full tray stands when the
 * arithmetic has not arrived.
 *
 * WHAT IT IS NOT. It is not the stop sheet: nothing has been earned, and
 * "That's the ten — see what they make" over a closet that makes nothing is the
 * single most damaging sentence this flow could print. It is also not a dead
 * end. The tray stays live underneath, every well still opens its piece, and the
 * one action here goes to the same place — `/item/[id]`, where a mis-read
 * garment can be re-read, renamed or swapped out.
 *
 * THE TONE IS CINCH'S FAULT, not the reader's. The likeliest cause by a wide
 * margin is the classifier calling a hoodie something it isn't, so the copy
 * offers to read the piece again before it suggests the reader change anything.
 *
 * REDESIGN 21 made it a `TroublePlate` and changed no word of it. The plate it
 * used to draw by hand — a white surface, a solid rule, an eyebrow, a serif
 * headline, a paragraph and a filled button — is that component exactly, and
 * two copies of one plate is how the amber and the sand ones drift apart. It
 * takes the `news` tone rather than the amber: nothing has gone wrong here, the
 * closet is simply smaller than it looks.
 */
export function TenRepair({
  readiness,
  measure,
  onCheckPiece,
}: {
  readiness: StarterReadiness;
  measure: TenMeasure;
  /** Opens the newest filed piece. The tray's own wells are the other door. */
  onCheckPiece: () => void;
}) {
  const copy = repairCopy(readiness);

  return (
    <TroublePlate
      tone="news"
      eyebrow="Ten of ten"
      headline={copy.title}
      body={copy.body}
      primary={{ label: copy.action, onPress: onCheckPiece }}
      measure={measure}
    />
  );
}
