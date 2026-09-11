import type { ReactNode } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import { TenBand, TenFoot, TenMasthead, TenTray } from '@/components/onboarding/ten-parts';
import {
  TEN_TITLE,
  tenActionLabel,
  tenSecondaryLabel,
  tenSubtitle,
  type TenPhase,
} from '@/features/onboarding/ten-copy';
import { PAD, tenMeasure } from '@/features/onboarding/ten-spec';
import { filledCount, nextSlot, type TenSlot } from '@/features/onboarding/ten-slots';

/**
 * Redesign 21 — The Ten's page.
 *
 * Extracted from the route so the fixture routes photograph the SAME object the
 * app ships rather than a second layout that agrees with it by hand. The route
 * owns the state machine; this owns the page, and `ten-parts.tsx` owns the ink.
 *
 * THE ORDER IS TITLE → LINE → BAND → TRAY → PLATES → CAPSULE, and it is the
 * frames' order rather than the shipped one. What changed and why:
 *
 *  - the count moved from an 11pt eyebrow ABOVE the title to a designed band
 *    BELOW it. Above the title it was the first thing read on the first screen
 *    of the app, in the register of a form label, and it competed with the
 *    masthead for the same job. Below it, with ten pips and a ground that
 *    changes, it is the thing the page is actually about;
 *  - `SlotCard` — a bordered plate arguing for the next piece — is gone, and
 *    the argument is now the capsule's own label (`tenActionLabel`). The
 *    reasoning it carried was written once and skipped nine times;
 *  - the tray grew. Portrait wells, a wider gutter between them, and a tenth
 *    that spans the page. `ten-spec.ts` holds every number.
 *
 * `children` replaces the tray and the foot entirely, which is how the camera
 * refusal keeps the masthead: a denied permission is drawn UNDER the count, so
 * the work already done stays visible from the failure. `plates` is the other
 * door — drawn under the tray, never instead of it, for the state where the
 * grid is full and still has to stay tappable.
 */
export function TenBody({
  slots,
  phase,
  foregroundedId,
  settlingId,
  settlingName,
  spread,
  garmentNames,
  imageUris,
  onSlotPress,
  onPhotograph,
  onLibrary,
  onFinish,
  onAddAnother,
  fontScale,
  screenHeight,
  banner,
  plates,
  children,
}: {
  slots: readonly TenSlot[];
  /** What the page is doing — see `TenPhase`. Never derived from `slots` here. */
  phase: TenPhase;
  /** The slot the action will fill. Defaults to the next empty one. */
  foregroundedId?: number | null;
  settlingId?: number | null;
  /** The garment being read, when the classifier has a name for it yet. */
  settlingName?: string | null;
  /** `tenSpreadLine` — the masthead names the missing half while filling (A76). */
  spread?: string | null;
  garmentNames?: Record<number, string | null>;
  imageUris?: Record<number, string | undefined>;
  onSlotPress?: (slotId: number) => void;
  onPhotograph?: (slotId: number) => void;
  onLibrary?: (slotId: number) => void;
  /** The complete tray's capsule — the one exit this page has to the reveal. */
  onFinish?: () => void;
  /** The complete tray's quiet action — a door out, not an eleventh well. */
  onAddAnother?: () => void;
  /** Overridable so a fixture can photograph a composition without the OS. */
  fontScale?: number;
  screenHeight?: number;
  /** Drawn between the band and the tray: the trouble and resume plates. */
  banner?: ReactNode;
  /** Drawn under the tray, never instead of it: repair, and the no-room plate. */
  plates?: ReactNode;
  /** Replaces the tray and the foot entirely. The camera refusal passes its own. */
  children?: ReactNode;
}) {
  const window = useWindowDimensions();
  const measure = tenMeasure({
    fontScale: fontScale ?? window.fontScale,
    height: screenHeight ?? window.height,
  });

  const filled = filledCount(slots);
  const total = slots.length;
  const foregrounded = slots.find((s) => s.id === foregroundedId) ?? nextSlot(slots) ?? null;

  const action = tenActionLabel({ filled, total, phase });
  const secondary = tenSecondaryLabel({ filled, total, phase });

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: 4, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled">
      <TenMasthead
        title={TEN_TITLE}
        subtitle={tenSubtitle({ filled, total, phase, name: settlingName, spread })}
        measure={measure}
      />

      <View style={{ marginTop: 16 }}>
        <TenBand filled={filled} total={total} phase={phase} measure={measure} />
      </View>

      {banner ? <View style={{ marginTop: 16 }}>{banner}</View> : null}

      {children ?? (
        <>
          <View style={{ marginTop: 16 }}>
            <TenTray
              slots={slots}
              measure={measure}
              foregroundedId={foregrounded?.id ?? null}
              settlingId={settlingId}
              garmentNames={garmentNames}
              imageUris={imageUris}
              onSlotPress={onSlotPress}
            />
          </View>

          {plates ? <View style={{ marginTop: 20 }}>{plates}</View> : null}

          {/* The foot is spaced off the tray rather than pinned to the bottom
              edge: at accessibility sizes the tray is five rows and scrolls, and
              a pinned capsule would sit on top of the last well. */}
          <View style={{ marginTop: 24 }}>
            <TenFoot
              measure={measure}
              action={action}
              secondary={secondary}
              // A settling tray refuses the next photograph rather than hiding
              // the control: the label says `Filing…`, which is a reason, and a
              // control that vanishes mid-run is a page that lost its action.
              disabled={phase === 'settling'}
              onAction={() => {
                if (filled >= total) {
                  onFinish?.();
                  return;
                }
                if (foregrounded) onPhotograph?.(foregrounded.id);
              }}
              onSecondary={() => {
                // A full tray has no well to fill, so "Add another piece" is a
                // door OUT of this flow rather than a second library picker —
                // only the route knows whether there is room for an eleventh,
                // and `/add-clothes` is the surface that owns that question.
                if (filled >= total) {
                  onAddAnother?.();
                  return;
                }
                if (foregrounded) onLibrary?.(foregrounded.id);
              }}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}
