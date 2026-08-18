import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GarmentCell } from '@/components/today/garment-cell';
import { AX_FONT_SCALE } from '@/components/today/reaction-spec';
import { Text } from '@/components/ui/text';
import {
  CANCEL_HEIGHT,
  COLLAGE_RADIUS,
  CTA_HEIGHT,
  CTA_HEIGHT_AX,
  CTA_RADIUS,
  HEART_ROW,
  HEART_ROW_AX,
  SHEET_RADIUS,
  STARS,
  STAR_GLYPH,
  STAR_GLYPH_AX,
  STAR_TARGET,
  STAR_TARGET_AX,
  WEAR_COPY,
  collageHeight,
  collageLabel,
  favoriteOverridesRating,
  mayConfirm,
  mayDismiss,
  mayEdit,
  piecesSummary,
  ratingHint,
  starFilled,
  toggleStar,
  wearErrorView,
  type Star,
  type WearPhase,
} from '@/features/today/wear-confirm-spec';
import type { WearFailureKind } from '@/features/styling/wear-failure';
import { haptics } from '@/lib/haptics';
import type { Garment } from '@/lib/styling';
import { useTheme } from '@/theme/tokens';

/**
 * One honest confirmation before a wear becomes history. Redesign 13.
 *
 * ── THE FOUR THINGS THIS SHEET PROMISES ─────────────────────────────────────
 *
 * OPENING WRITES NOTHING. There is no draft, no optimistic row and no
 * pre-registered outfit. The sheet is a form until the CTA is pressed.
 *
 * CANCEL WRITES NOTHING, from `idle` and from `failed` alike. A reader who
 * chose four stars, hit a network failure and then backed out has left no
 * trace at all — not a rating, not a wear, not a partial outfit.
 *
 * PENDING CANNOT DISMISS. Every mutating control AND the dismissal are
 * disabled while the transaction is in flight. A dismissal accepted mid-write
 * leaves a transaction in the air with nobody watching for its answer, which is
 * exactly how a wear comes to exist that the app believes was cancelled.
 *
 * UNRATED IS LEGAL. Confirming with nothing chosen sends `rating: null` and
 * `favorite: false`. No taste signal is invented from somebody's silence.
 *
 * ── WHAT IT DOES NOT OWN ────────────────────────────────────────────────────
 *
 * The write, the operation id, the retry semantics and the failure taxonomy all
 * belong to `useWearOutfit` and `wear_outfit_tx`, which were already correct
 * and are untouched. This component owns two pieces of local state — a rating
 * and a boolean — and decides nothing else. Redesign 13 is a presentation
 * change: a larger collage, the name in the serif, five generous stars, an
 * owner-private heart and one filled CTA.
 */

export type WearConfirmationSheetProps = {
  visible: boolean;
  outfitName: string;
  garments: Garment[];
  resolveImage: (...paths: (string | null | undefined)[]) => string | undefined;
  /** The authoritative phase, owned by the route that holds the mutation. */
  phase: WearPhase;
  /** The classified failure, or null. Never a raw service message. */
  error: WearFailureKind | null;
  /**
   * Whether the device is offline, so a network failure can say which of two
   * situations it is: a connection that was never there, or one that dropped
   * mid-write.
   */
  offline?: boolean;
  /** True when the settled write was a retry that found the original. */
  idempotent?: boolean;
  /**
   * ── A TEST SEAM, AND NOTHING ELSE ─────────────────────────────────────────
   *
   * The sheet owns the rating and the favourite, correctly: they are local, and
   * nothing outside should be able to choose on the reader's behalf. That is
   * also why five of the accepted states — one star, three, five, favourite on,
   * and the favourite-overrides-rating note — could not be photographed at all:
   * `simctl` opens URLs and cannot tap, so a state that only a finger can reach
   * has no reproducible evidence.
   *
   * These two props exist to open that door for the dev fixtures and for
   * nothing else. They default to exactly what opening gives you — unrated and
   * unfavourited — and `tests/wear-confirm-sheet.test.ts` asserts that the
   * shipping route passes neither, so production behaviour is unchanged and
   * cannot drift.
   */
  initialRating?: number | null;
  initialFavorite?: boolean;
  onCancel: () => void;
  onConfirm: (feedback: { rating: number | null; favorite: boolean }) => void;
  /** The session ended; this is not retryable in place. */
  onSignIn: () => void;
  /** The settled sheet's only action. */
  onDone: () => void;
};

export function WearConfirmationSheet({
  visible,
  outfitName,
  garments,
  resolveImage,
  phase,
  error,
  offline = false,
  idempotent = false,
  initialRating = null,
  initialFavorite = false,
  onCancel,
  onConfirm,
  onSignIn,
  onDone,
}: WearConfirmationSheetProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const { fontScale, height } = useWindowDimensions();
  const ax = fontScale >= AX_FONT_SCALE;

  const [rating, setRating] = useState<number | null>(initialRating);
  const [favorite, setFavorite] = useState(initialFavorite);
  // Whether a rating was ever taken back, which is the only thing that
  // separates "Cleared" from "Optional" — both are `null`.
  const [cleared, setCleared] = useState(false);

  const editable = mayEdit(phase);
  const dismissible = mayDismiss(phase);
  const settled = phase === 'settled';
  const view = error ? wearErrorView(error, offline) : null;

  // One notification haptic, and only after the transaction has settled — never
  // on open, cancel, error or retry start. A tick before the server has
  // answered congratulates somebody for a write that may still fail.
  //
  // Announced exactly once, by the same guard, because a repeated
  // "Logged. Wear counts updated." on a re-render is a screen reader telling
  // somebody they wore the outfit twice.
  const announced = useRef(false);
  useEffect(() => {
    if (!settled) {
      announced.current = false;
      return;
    }
    if (announced.current) return;
    announced.current = true;
    haptics.success();
    AccessibilityInfo.announceForAccessibility(
      idempotent ? WEAR_COPY.settledIdempotent : WEAR_COPY.settled,
    );
  }, [settled, idempotent]);

  const pieces = piecesSummary(garments);

  return (
    <Modal
      visible={visible}
      transparent
      // Reduce Motion drops the settle travel for a cross-fade. The composition
      // and every piece of feedback are identical either way; only the arriving
      // changes.
      animationType={reduced ? 'fade' : 'slide'}
      // `undefined` rather than a no-op: passing a handler that refuses is a
      // control that looks live and is not. While confirming there is genuinely
      // no dismissal to offer.
      onRequestClose={dismissible ? onCancel : undefined}>
      <View className="flex-1 justify-end bg-black/30">
        <SafeAreaView
          edges={['bottom']}
          className="max-h-[92%] bg-canvas"
          style={{ borderTopLeftRadius: SHEET_RADIUS, borderTopRightRadius: SHEET_RADIUS }}
          accessibilityViewIsModal
          accessibilityLabel={WEAR_COPY.sheetTitle}>
          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 22, paddingBottom: 16 }}>
            {/* The grabber, and no drawn title.
                "Log today's outfit" is the MODAL'S ANNOUNCEMENT — VoiceOver
                says it on presentation — not a heading. The accepted frame
                draws no header at all, and it is right to: a sheet that opens
                over an outfit with one filled button on it does not need a
                sentence explaining that it is about the outfit. */}
            <View className="items-center" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View className="bg-rule" style={{ width: 40, height: 4, borderRadius: 2 }} />
            </View>

            {/* THE OUTFIT, AS ONE ELEMENT.
                An outfit heard as five separate garments is not an outfit, so
                the collage is a single accessible node labelled with the name
                and the number of pieces. */}
            <View
              accessible
              accessibilityRole="image"
              accessibilityLabel={collageLabel(outfitName, garments.length)}
              className="bg-sand flex-row items-center justify-center"
              style={{
                marginTop: 20,
                height: collageHeight(height, ax),
                borderRadius: COLLAGE_RADIUS,
                overflow: 'hidden',
                gap: 6,
                paddingHorizontal: 12,
              }}>
              {garments.map((garment) => (
                <View
                  key={garment.id}
                  style={{
                    flex: 1,
                    maxWidth: 96,
                    height: collageHeight(height, ax) - 24,
                  }}>
                  {/* The same neutral fallback whether a piece was never
                      photographed, failed to load, is hidden, or belongs to
                      somebody this reader may not see. The four are
                      indistinguishable on purpose: a distinct treatment would
                      be evidence that a hidden piece exists. */}
                  <GarmentCell
                    garment={garment}
                    uri={resolveImage(garment.platePath, garment.cutoutPath, garment.thumbPath)}
                  />
                </View>
              ))}
            </View>

            {/* The name in the serif, and the pieces beneath it. Two lines, no
                truncation — an outfit summarised by "and 2 more" is an outfit
                the reader has to open something else to see. */}
            <Text
              variant="plate"
              trim
              style={{ marginTop: 16, fontSize: ax ? 30 : 26, lineHeight: ax ? 34 : 28 }}>
              {outfitName}
            </Text>
            <Text
              variant="note"
              style={{ marginTop: 6, fontSize: ax ? 17 : 13, lineHeight: ax ? 24 : 19 }}>
              {pieces}
            </Text>

            {/* The settled mark. One restrained line, never a celebration — the
                reader got dressed, which is not an achievement. */}
            {settled ? (
              <View
                accessibilityRole="alert"
                className="bg-blush"
                style={{ marginTop: 18, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 }}>
                <Text variant="label" style={{ color: theme.ink }}>
                  {idempotent ? WEAR_COPY.settledIdempotent : WEAR_COPY.settled}
                </Text>
              </View>
            ) : null}

            {/* The failure, told apart. Placed above the controls it preserves,
                so "your stars are still here" is verifiable by looking down. */}
            {view && !settled ? (
              <View
                accessibilityRole="alert"
                style={{ marginTop: 18, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: theme.tray }}>
                <Text variant="label" style={{ color: theme.ink }}>
                  {view.title}
                </Text>
                <Text variant="note" style={{ marginTop: 4, color: theme.muted }}>
                  {view.body}
                </Text>
              </View>
            ) : null}

            {/* RATING — optional, and optional in the strong sense: null is a
                legal answer and the CTA is live without one. */}
            <View style={{ marginTop: 24 }}>
              <View className="flex-row items-baseline justify-between">
                <Text variant="eyebrow">{WEAR_COPY.ratingHeading}</Text>
                <Text variant="note" style={{ color: theme.muted, fontSize: ax ? 17 : 13 }}>
                  {ratingHint(rating, cleared)}
                </Text>
              </View>
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel={`${WEAR_COPY.ratingHeading} ${WEAR_COPY.ratingOptional}`}
                className="flex-row"
                style={{ marginTop: 10, gap: 4 }}>
                {STARS.map((star) => {
                  const filled = starFilled(rating, star);
                  return (
                    <Pressable
                      key={star}
                      onPress={() => {
                        const next = toggleStar(rating, star as Star);
                        setRating(next);
                        setCleared(next === null);
                        // A selection tick on an explicit change — the lightest
                        // of the three, and the only one iOS reserves for a
                        // value changing under the finger.
                        haptics.selection();
                      }}
                      disabled={!editable}
                      accessibilityRole="radio"
                      accessibilityLabel={`${star} of 5 stars`}
                      accessibilityState={{ selected: rating === star, disabled: !editable }}
                      style={{
                        width: ax ? STAR_TARGET_AX : STAR_TARGET,
                        height: ax ? STAR_TARGET_AX : STAR_TARGET,
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: editable ? 1 : 0.5,
                      }}>
                      <SymbolView
                        // Solid in both states, and only the TINT changes: a row
                        // that switches between hollow and solid outlines
                        // changes weight as it fills, which reads as the stars
                        // moving rather than as a value being chosen.
                        name="star.fill"
                        size={ax ? STAR_GLYPH_AX : STAR_GLYPH}
                        tintColor={filled ? theme.accent : theme.sand}
                        resizeMode="scaleAspectFit"
                        fallback={
                          <Text variant="heading" style={{ color: filled ? theme.accent : theme.sand }}>
                            ★
                          </Text>
                        }
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* FAVOURITE — owner-private, and the line saying so never leaves. */}
            <Pressable
              onPress={() => {
                setFavorite((v) => !v);
                haptics.selection();
              }}
              disabled={!editable}
              accessibilityRole="switch"
              accessibilityLabel={`${WEAR_COPY.favorite}. ${WEAR_COPY.favoritePrivate}`}
              accessibilityState={{ checked: favorite, disabled: !editable }}
              className="flex-row items-center justify-between"
              style={{
                marginTop: 20,
                minHeight: ax ? HEART_ROW_AX : HEART_ROW,
                borderRadius: 16,
                paddingHorizontal: 16,
                // `tray` at rest, not `sand`: the resting HEART is sand, and a
                // sand heart on a sand row is an invisible control — which is
                // exactly what the first simulator capture showed. The two
                // grounds have to differ for the glyph to exist at all.
                backgroundColor: favorite ? theme.blush : theme.tray,
                opacity: editable ? 1 : 0.5,
              }}>
              {/* The heart LEADS the row, as the accepted frame draws it: the
                  state is the first thing read left-to-right, rather than
                  something you find after the label that describes it.

                  Oxblood on blush rather than a warmer clay — the accepted
                  deviation. Clay on blush fails the contrast floor against the
                  sand resting state, and the two states must be told apart at a
                  glance. */}
              <SymbolView
                name={favorite ? 'heart.fill' : 'heart'}
                size={ax ? 32 : 26}
                tintColor={favorite ? theme.accent : theme.sand}
                resizeMode="scaleAspectFit"
                fallback={
                  <Text variant="heading" style={{ color: favorite ? theme.accent : theme.sand }}>
                    {favorite ? '♥' : '♡'}
                  </Text>
                }
              />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text variant="label" style={{ color: theme.ink }}>
                  {WEAR_COPY.favorite}
                </Text>
                <Text variant="note" style={{ marginTop: 2, color: theme.muted, fontSize: ax ? 16 : 13 }}>
                  {WEAR_COPY.favoritePrivate}
                </Text>
              </View>
            </Pressable>

            {/* Only when the two genuinely disagree. Saying it over a five-star
                favourite would be the app narrating an argument nobody had. */}
            {favoriteOverridesRating(rating, favorite) ? (
              <Text variant="note" style={{ marginTop: 10, color: theme.muted }}>
                {WEAR_COPY.favoriteOverride}
              </Text>
            ) : null}

            {/* The boundary, named field by field, at the moment it becomes
                relevant: the reader has just marked something private, and this
                is what "private" actually covers.

                Shown on the favourite rather than always, because the accepted
                frames draw it on the boundary frame alone — a wall notice
                standing permanently over a form nobody has filled in is a
                reassurance about nothing. The persistent guarantee is the
                "Only you can see this" line above, which never leaves. */}
            {favorite ? (
              <Text variant="note" style={{ marginTop: 14, color: theme.muted, fontSize: ax ? 16 : 12 }}>
                {WEAR_COPY.privacyNote}
              </Text>
            ) : null}
          </ScrollView>

          {/* The CTA is pinned OUTSIDE the scroll region, so a 667pt screen and
              an AX-XXXL reader both keep it above the home indicator. */}
          <View className="border-t border-rule" style={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 8 }}>
            <Pressable
              onPress={() => {
                if (settled) {
                  onDone();
                  return;
                }
                if (view && !view.retryable) {
                  onSignIn();
                  return;
                }
                // The in-flight guard. A second tap is swallowed here rather
                // than deduplicated later: the operation id would make a
                // duplicate harmless, but a request that never leaves is
                // cheaper than one that has to be recognised on arrival.
                if (!mayConfirm(phase)) return;
                onConfirm({ rating, favorite });
              }}
              disabled={phase === 'confirming'}
              accessibilityRole="button"
              accessibilityLabel={
                settled ? WEAR_COPY.done : phase === 'confirming' ? WEAR_COPY.confirmPending : (view?.action ?? WEAR_COPY.confirm)
              }
              accessibilityState={{ busy: phase === 'confirming', disabled: phase === 'confirming' }}
              className="items-center justify-center bg-accent active:opacity-70"
              style={{
                minHeight: ax ? CTA_HEIGHT_AX : CTA_HEIGHT,
                borderRadius: CTA_RADIUS,
                opacity: phase === 'confirming' ? 0.7 : 1,
              }}>
              <Text variant="label" style={{ color: theme.canvas }}>
                {settled
                  ? WEAR_COPY.done
                  : phase === 'confirming'
                    ? WEAR_COPY.confirmPending
                    : (view?.action ?? WEAR_COPY.confirm)}
              </Text>
            </Pressable>

            {/* Cancel, beneath the commit and outside the scroll region — so a
                667pt screen and an AX-XXXL reader both keep BOTH actions clear
                of the home area, which is what the short-device frame asks for.

                It disappears entirely once the wear has settled: there is
                nothing left to cancel, and a dismissal offered next to "Done"
                would be two ways to say the same thing with different words. */}
            {settled ? null : (
              <Pressable
                onPress={onCancel}
                disabled={!dismissible}
                accessibilityRole="button"
                accessibilityLabel={WEAR_COPY.cancel}
                accessibilityState={{ disabled: !dismissible }}
                style={{
                  minHeight: CANCEL_HEIGHT,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 4,
                  opacity: dismissible ? 1 : 0.4,
                }}>
                <Text variant="label" style={{ color: theme.muted }}>
                  {WEAR_COPY.cancel}
                </Text>
              </Pressable>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
