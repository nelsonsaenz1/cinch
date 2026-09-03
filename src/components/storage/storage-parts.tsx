import { SymbolView } from 'expo-symbols';
import { memo } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GarmentImage } from '@/components/media/garment-image';
import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import { AX_STACK_SCALE } from '@/features/closet/dynamic-type';
import { pieceName } from '@/features/closet/item-name';
import {
  CONTROL,
  NOTICE,
  PLATE,
  SHORT_DEVICE_HEIGHT,
  STORAGE_COPY,
  TYPE,
  type StorageDoor,
  type StorageNotice,
} from '@/features/closet/storage-spec';
import type { Item } from '@/schemas/item';
import { accentAlpha, MIN_TAP_TARGET, positiveAlpha, shadow, useTheme } from '@/theme/tokens';

/**
 * Storage, drawn. Redesign 25.
 *
 * ── WHY THIS IS NOT THE CLOSET'S GRID ───────────────────────────────────────
 *
 * The brief is "the same grid language as Closet at LOWER emphasis", and the
 * previous build took that literally by passing `stored` into `ClosetGrid`.
 * That was the right call while storage was a utility list; it is the wrong one
 * now, because the two screens no longer agree about the grid:
 *
 *   · Closet runs THREE columns (redesign 14, "a material library"), this runs
 *     two — the calmer rhythm IS the lower emphasis, and it has to be visible
 *     in a glance at the grid alone.
 *   · Closet's card carries a metadata sentence; this one carries a NAME and
 *     nothing else, because the only true metadata storage has is a stored date
 *     the database does not record.
 *   · Closet's tile opens a piece. This one SELECTS it, which is a different
 *     control with a different announcement.
 *
 * Three disagreements is a different component, not four more props on the
 * shared one.
 *
 * `ClosetGrid`'s `stored` and `metaFor` props are now reached only by
 * `dev-w3-g3-c-07.tsx`, the fixture for the superseded C-07 atlas — this screen
 * was their last product caller. They are deliberately LEFT ALONE rather than
 * removed: `closet-grid.tsx` and `item-card.tsx` belong to redesign 14's lane,
 * the wave builds on disjoint files, and deleting a prop out from under another
 * page's fixture is how two lanes collide. Retiring them is a closet-lane
 * decision, recorded in this build's report rather than taken here.
 *
 * What IS shared is the language: the same sand well, the same radius family,
 * the same 72% sleep, the same `GarmentImage` fallback, the same press
 * response. A reader should recognise the idiom and feel the volume drop.
 */

/** Whether Dynamic Type has reached the size the artifact's AX frames draw. */
export function useAx(): boolean {
  const { fontScale } = useWindowDimensions();
  return fontScale >= AX_STACK_SCALE;
}

/** Whether this is the 667pt class of device the artifact measures separately. */
export function useShortDevice(): boolean {
  const { height } = useWindowDimensions();
  return height < SHORT_DEVICE_HEIGHT;
}

// ---------------------------------------------------------------------------
// The header
// ---------------------------------------------------------------------------

/** The 44pt tray disc — the frame's own back control, and a real tap target. */
export function BackDisc({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const press = usePressFeedback();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={{ width: MIN_TAP_TARGET, height: MIN_TAP_TARGET }}>
      <Animated.View
        style={[
          press.style,
          {
            width: MIN_TAP_TARGET,
            height: MIN_TAP_TARGET,
            borderRadius: PLATE.radius,
            backgroundColor: theme.tray,
            alignItems: 'center',
            justifyContent: 'center',
          },
        ]}>
        <SymbolView name="chevron.left" size={18} tintColor={theme.ink} resizeMode="scaleAspectFit" />
      </Animated.View>
    </Pressable>
  );
}

/**
 * The title and the arithmetic under it.
 *
 * ONE ACCESSIBILITY NODE for the capacity line, and the line is announced here
 * and NOWHERE else. The artifact's focus order is explicit about it: "the
 * arithmetic is announced once as context, never repeated per tile", which is
 * the difference between a reader hearing "twelve stored, one hundred and
 * thirty-eight of one hundred and fifty active" once and hearing it on every
 * one of twelve tiles.
 */
export function StorageHeader({
  line,
  onBack,
}: {
  /**
   * Already composed by `capacityLine` — this draws it, it does not derive it.
   *
   * Null while NOTHING is known (the first read, a failed read). The element is
   * then absent rather than empty: a blank line where an arithmetic line lives
   * reads as a figure that failed to load, which is the impression this screen
   * least wants to give about counts of the reader's own possessions.
   */
  line: string | null;
  onBack: () => void;
}) {
  const ax = useAx();

  return (
    /**
     * ── DIRECTIVE #47: THE SAME HEADER BASELINE AS EVERY OTHER UTILITY PAGE ──
     *
     * "Storage's boxed back button crowds the 'Storage' title vertically. Use
     * the same header baseline and top inset as other utility screens."
     *
     * Two separate departures were doing it. The first was the top inset:
     * every other page in the app opens on `ScreenHeader`, whose row is
     * `px-gutter pt-2`, and this one had no top padding at all — so its back
     * control started at the safe-area edge, a full 8 points higher than the
     * same control everywhere else, and the whole header sat proud of the
     * app's baseline. The second was the 12 pt gap under it: at the app's
     * standard 36 pt disc that gap reads as air, and under a 44 pt filled box
     * it reads as the box resting on the title.
     *
     * `pt-2` restores the baseline; `mt-5` gives the title back the clearance
     * the larger control took. The box itself stays — it is the artifact's own
     * control on the artifact's own page, and swapping it for the circular
     * disc is a call for the founder rather than a defect to fix in passing.
     */
    <View className="px-gutter pt-2">
      <BackDisc onPress={onBack} />

      <Text
        variant="display"
        trim
        accessibilityRole="header"
        className="mt-5"
        style={{ fontSize: ax ? TYPE.titleAx : TYPE.title, lineHeight: ax ? 31 : TYPE.titleLineHeight }}>
        {STORAGE_COPY.title}
      </Text>

      {line === null ? null : (
        <Text
          /**
           * The arithmetic, in the app's tracked-uppercase eyebrow.
           *
           * THE ARTIFACT DRAWS THIS LINE IN CLAY AND THIS DRAWS IT IN `muted`,
           * which is a deliberate refusal — see the build report.
           * `accentWarm` (#B08A76) on canvas is below AA, `contrast.ts` marks
           * it `text: false`, and `constitution.test.ts` records that it is
           * used as text NOWHERE in the app and is to stay that way. The
           * artifact half-concedes the point itself: its Increase-Contrast
           * frame has the capacity line "darken for contrast", which is an
           * admission that the resting colour does not carry.
           *
           * So the treatment survives and the value does not: same casing,
           * same tracking, same size step, one token darker. `muted` is
           * 5.46:1. Nothing about the line's role changes — it is still the
           * quiet layer, and the eyebrow IS this app's quiet layer.
           */
          accessible
          accessibilityLabel={line}
          variant="eyebrow"
          className="mt-2"
          style={{
            fontSize: ax ? TYPE.capacityAx : TYPE.capacity,
            lineHeight: (ax ? TYPE.capacityAx : TYPE.capacity) * 1.6,
            letterSpacing: (ax ? TYPE.capacityAx : TYPE.capacity) * TYPE.capacityTracking,
          }}>
          {line}
        </Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// The plate
// ---------------------------------------------------------------------------

/**
 * One stored garment.
 *
 * The well dims to 72% and the TYPE DOES NOT. Opacity on a name would make a
 * stored piece harder to read, and a stored piece is one you are still meant to
 * be able to identify — "asleep, not degraded" is a statement about the
 * photograph, not about the label.
 *
 * Selected draws an oxblood ring INSIDE the plate's own bounds rather than
 * around them, so a selection never shifts the grid by a pixel.
 */
function StoragePlateComponent({
  item,
  uri,
  selected,
  onPress,
}: {
  item: Item;
  uri?: string;
  selected: boolean;
  onPress: (item: Item) => void;
}) {
  const theme = useTheme();
  const press = usePressFeedback();
  const ax = useAx();
  const short = useShortDevice();
  const name = pieceName(item);

  const height = ax ? PLATE.axHeight : short ? PLATE.shortHeight : PLATE.height;

  return (
    <Pressable
      accessibilityRole="button"
      // Name, then that it is stored, then what a tap does — the artifact's
      // announcement order. The arithmetic is deliberately absent: it belongs
      // to the header's single node.
      accessibilityLabel={`${name}. Stored piece.`}
      accessibilityHint="Selects this piece to bring back into your closet"
      accessibilityState={{ selected }}
      onPress={() => onPress(item)}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={{ flex: 1 }}>
      <Animated.View style={press.style}>
        <View
          style={{
            height,
            borderRadius: PLATE.radius,
            backgroundColor: theme.sand,
            overflow: 'hidden',
            // The ring is a border on the well itself, drawn at full strength
            // over a well that is sleeping at 72%.
            borderWidth: selected ? 2 : 0,
            borderColor: theme.accent,
          }}>
          <View style={{ flex: 1, opacity: PLATE.storedOpacity }}>
            <GarmentImage
              uri={uri}
              recyclingKey={item.id}
              contentFit="cover"
              style={{ flex: 1 }}
              // An expired signature and a genuinely missing image share ONE
              // fallback, so the treatment never reveals which occurred — the
              // reader learns nothing about their storage layer from a photo
              // that did not load.
              fallback={<PlateFallback />}
              waiting={<PlateFallback />}
            />
          </View>
        </View>

        <Text
          variant="body"
          // Wraps in full rather than truncating: the artifact's long-name frame
          // lifts the row and keeps the tile's size, so no `numberOfLines`.
          className="mt-2"
          style={{
            color: theme.ink,
            fontSize: ax ? undefined : TYPE.plateName,
            lineHeight: ax ? undefined : TYPE.plateNameLineHeight,
          }}>
          {name}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export const StoragePlate = memo(StoragePlateComponent);

/** The one fallback, for both the expired signature and the absent image. */
function PlateFallback() {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.sand }}>
      <SymbolView
        name="tshirt"
        size={34}
        tintColor={theme.ghost}
        resizeMode="scaleAspectFit"
        // Decorative: the name under the plate already says what this is, and a
        // reader hearing "t-shirt" for a stored overcoat is worse than silence.
        accessibilityElementsHidden
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// The notice band
// ---------------------------------------------------------------------------

/**
 * The capacity notice — blush ground, Medium title, prose, and up to two peer
 * actions.
 *
 * `accessibilityLiveRegion="polite"`: every one of these either arrives with
 * the screen or appears after a refusal the reader's finger has already left.
 */
export function StorageNoticeBand({
  notice,
  onDoor,
}: {
  notice: StorageNotice;
  onDoor: (door: StorageDoor) => void;
}) {
  const theme = useTheme();

  return (
    <View
      accessibilityLiveRegion="polite"
      className="mx-gutter"
      style={{
        backgroundColor: theme.blush,
        borderRadius: NOTICE.radius,
        paddingVertical: NOTICE.paddingY,
        paddingHorizontal: NOTICE.paddingX,
      }}>
      <Text variant="label" style={{ color: theme.ink }}>
        {notice.title}
      </Text>
      <Text
        variant="body"
        className="mt-1"
        // A refusal speaks in oxblood; an informational notice stays in ink.
        // One ground, two voices — a second surface colour for the same band
        // would read as a second kind of object.
        style={{ color: notice.tone === 'refusal' ? theme.accent : theme.ink }}>
        {notice.body}
      </Text>

      {notice.actions.map((action) => (
        <Pressable
          key={action.label}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={() => onDoor(action.door)}
          style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
          className="active:opacity-60">
          <Text variant="label" style={{ color: theme.accent }}>
            {action.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * The light celebration, and the quiet reconciliation, in one shape.
 *
 * "A light warm confirmation, not confetti." A positive-tinted band that states
 * the piece is back and that it can be styled again — the second half matters,
 * because "can be styled again" is the ONE thing that was untrue while it sat
 * in storage, and saying it is what makes the restore feel like a return rather
 * than a database write.
 */
export function StorageMark({
  tone,
  title,
  body,
}: {
  tone: 'positive' | 'quiet';
  title: string;
  /** Absent for the one-line marks — the refreshing notice is a sentence, not a pair. */
  body?: string;
}) {
  const theme = useTheme();

  return (
    <View
      accessibilityLiveRegion="polite"
      accessible
      accessibilityLabel={body ? `${title}. ${body}` : title}
      className="mx-gutter"
      style={{
        backgroundColor: tone === 'positive' ? positiveAlpha(0.09) : theme.tray,
        borderRadius: NOTICE.radius,
        paddingVertical: NOTICE.paddingY,
        paddingHorizontal: NOTICE.paddingX,
      }}>
      <Text variant="label" style={{ color: theme.ink }}>
        {title}
      </Text>
      {body ? (
        <Text variant="body" className="mt-1" style={{ color: theme.muted }}>
          {body}
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// The controls
// ---------------------------------------------------------------------------

/**
 * The one primary action — full width, filled oxblood, 56pt, r14.
 *
 * Built here rather than borrowed from `ui/Button` because the artifact gives
 * this control its own measurements (56/62pt against the button spec's 52, r14
 * against r12) and the frames are the contract. The press response is the
 * shared one; only the geometry is local.
 */
export function PrimaryAction({
  label,
  onPress,
  disabled = false,
  loading = false,
  loadingLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
}) {
  const theme = useTheme();
  const ax = useAx();
  const inert = disabled || loading;
  const press = usePressFeedback(!inert);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={loading && loadingLabel ? loadingLabel : label}
      accessibilityState={{ disabled: inert, busy: loading }}
      disabled={inert}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      // The Pressable carries its own height — chip.tsx documents the
      // dead-press shape this avoids (a bare Pressable whose only child is a
      // Reanimated wrapper).
      style={{ minHeight: MIN_TAP_TARGET }}>
      <Animated.View
        style={[
          press.style,
          {
            minHeight: ax ? CONTROL.primaryHeightAx : CONTROL.primaryHeight,
            borderRadius: CONTROL.radius,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 16,
            // Disabled is the SAND tone, not a dimmed oxblood: a greyed accent
            // reads as a control that is broken, while sand reads as one that
            // is waiting for something. The notice above says what.
            backgroundColor: disabled && !loading ? theme.sand : theme.accent,
          },
        ]}>
        <Text
          variant="label"
          style={{ color: disabled && !loading ? theme.muted : theme.canvas, fontSize: 17 }}>
          {loading && loadingLabel ? loadingLabel : label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/** The tinted blush peer — 52pt, same radius, oxblood label. */
export function SecondaryAction({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  const press = usePressFeedback();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      // The Pressable carries its own height — chip.tsx documents the
      // dead-press shape this avoids (a bare Pressable whose only child is a
      // Reanimated wrapper).
      style={{ minHeight: MIN_TAP_TARGET }}>
      <Animated.View
        style={[
          press.style,
          {
            minHeight: CONTROL.secondaryHeight,
            borderRadius: CONTROL.radius,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 16,
            backgroundColor: theme.blush,
          },
        ]}>
        <Text variant="label" style={{ color: theme.accent, fontSize: 17 }}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// The sheets
// ---------------------------------------------------------------------------

const SHEET_SHADOW_SCALE = 4;

/**
 * The bottom-sheet shell every sheet on this screen sits in.
 *
 * `accessibilityViewIsModal` traps focus, which the artifact asks for, and the
 * scrim carries a hint saying the dismissal writes nothing — the reader
 * deciding whether to tap out of a sheet about their own wardrobe should not
 * have to guess whether backing out counts as an answer.
 */
export function StorageSheet({
  visible,
  onDismiss,
  children,
}: {
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={{ flex: 1, backgroundColor: theme.scrim }}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          accessibilityHint="Nothing is restored or deleted; this closes the sheet."
        />

        <View
          accessibilityViewIsModal
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            shadowColor: theme.ink,
            shadowOpacity: 0.28,
            shadowRadius: shadow.contact.blur * SHEET_SHADOW_SCALE,
            shadowOffset: {
              width: shadow.contact.dx,
              height: shadow.contact.dy * SHEET_SHADOW_SCALE,
            },
            ...(Platform.OS === 'android' ? { elevation: 16 } : null),
          }}>
          <View
            className="rounded-t-plate bg-canvas px-gutter pt-3"
            style={{ paddingBottom: insets.bottom + 20 }}>
            <View
              className="self-center rounded-full"
              style={{ width: 44, height: 4, marginBottom: 16, backgroundColor: theme.sand }}
            />
            {children}
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** One selectable garment in the chooser. */
export function ChooserRow({
  item,
  uri,
  selected,
  onPress,
}: {
  item: Item;
  uri?: string;
  selected: boolean;
  onPress: (item: Item) => void;
}) {
  const theme = useTheme();
  const ax = useAx();
  const name = pieceName(item);
  const thumb = ax ? 52 : 44;

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={name}
      accessibilityState={{ selected, checked: selected }}
      onPress={() => onPress(item)}
      style={{
        minHeight: ax ? CONTROL.rowHeightAx : CONTROL.rowHeight,
        borderRadius: PLATE.radius,
        backgroundColor: selected ? theme.blush : theme.tray,
        paddingHorizontal: 10,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
      className="active:opacity-80">
      <View
        style={{
          width: thumb,
          height: thumb,
          borderRadius: 10,
          overflow: 'hidden',
          backgroundColor: theme.surface,
        }}>
        <GarmentImage
          uri={uri}
          recyclingKey={item.id}
          contentFit="cover"
          style={{ flex: 1 }}
          fallback={<PlateFallback />}
          waiting={<PlateFallback />}
        />
      </View>

      <Text variant="label" style={{ color: theme.ink, flex: 1 }}>
        {name}
      </Text>

      {/* The mark, not a checkbox: one piece comes back at a time, so the
          control is a radio and it looks like one. */}
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: selected ? theme.accent : 'transparent',
          borderWidth: selected ? 0 : 1.5,
          borderColor: accentAlpha(0.28),
        }}
      />
    </Pressable>
  );
}

/** The serif head and supporting line every sheet opens with. */
export function SheetHead({ title, body }: { title: string; body: string }) {
  const theme = useTheme();
  return (
    <>
      <Text variant="title" trim accessibilityRole="header" style={{ fontSize: 27, lineHeight: 33 }}>
        {title}
      </Text>
      <Text variant="body" className="mb-3 mt-2" style={{ color: theme.muted }}>
        {body}
      </Text>
    </>
  );
}

// ---------------------------------------------------------------------------
// The wait, and the empty drawer
// ---------------------------------------------------------------------------

/**
 * The wait, shaped like the grid it becomes. No spinner and no sweep — the
 * grid's own geometry held still is the wait everywhere in this wave, and a
 * skeleton that pulses is a screen pretending to make progress it cannot
 * measure.
 *
 * NO COUNT AND NO ARITHMETIC while this is up: the artifact's loading frame
 * prints no capacity line at all, because every figure in it is still unknown.
 */
export function StorageSkeleton() {
  const theme = useTheme();
  const ax = useAx();
  const short = useShortDevice();
  const height = ax ? PLATE.axHeight : short ? PLATE.shortHeight : PLATE.height;

  return (
    <View
      className="flex-row flex-wrap px-gutter"
      accessible
      accessibilityLabel="Opening storage"
      style={{ gap: PLATE.gutter }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ width: `${100 / 2}%`, maxWidth: PLATE.width }}>
          <View style={{ height, borderRadius: PLATE.radius, backgroundColor: theme.sand }} />
          <View
            style={{
              marginTop: 8,
              width: [104, 88, 116, 80][i],
              height: 13,
              borderRadius: 4,
              backgroundColor: theme.tray,
            }}
          />
        </View>
      ))}
    </View>
  );
}

/**
 * Nothing stored.
 *
 * Drawn garments rather than a paragraph — the wave's rule that "empty states
 * draw garments, not paragraphs" — and one sentence that says what storing
 * actually does. The sentence leads with what is KEPT, which is the same order
 * of argument the previous build's tray band made and the one thing from it
 * worth carrying forward.
 */
export function StorageEmpty({ onBack }: { onBack: () => void }) {
  const theme = useTheme();

  return (
    <View className="flex-1 items-center justify-center px-gutter">
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="flex-row items-end"
        style={{ gap: 6, marginBottom: 26 }}>
        {[46, 62, 40, 30, 52, 26].map((w, i) => (
          <View
            key={i}
            style={{
              width: w,
              height: [96, 128, 88, 70, 110, 62][i],
              borderRadius: 10,
              backgroundColor: i % 2 === 0 ? theme.sand : theme.tray,
            }}
          />
        ))}
      </View>

      <Text variant="title" trim accessibilityRole="header" style={{ fontSize: 27, textAlign: 'center' }}>
        {STORAGE_COPY.empty.title}
      </Text>
      <Text
        variant="body"
        className="mt-3"
        style={{ color: theme.muted, textAlign: 'center', maxWidth: 320 }}>
        {STORAGE_COPY.empty.body}
      </Text>

      <View className="mt-8 w-full">
        <SecondaryAction label={STORAGE_COPY.empty.action} onPress={onBack} />
      </View>
    </View>
  );
}

/**
 * A state that is not the grid — a failed read, or an absent session.
 *
 * Explicitly NOT the empty state, and the separation is enforced by this being
 * a different component rather than the empty one with different props: the
 * failure mode being guarded against is somebody "simplifying" the two into one
 * and letting a dropped connection render as an empty drawer.
 */
export function StorageStop({
  title,
  body,
  action,
  onAction,
  busy = false,
  busyLabel,
}: {
  title: string;
  body: string;
  action: string;
  onAction: () => void;
  busy?: boolean;
  busyLabel?: string;
}) {
  const theme = useTheme();

  return (
    <View className="flex-1 items-center justify-center px-gutter">
      <Text variant="title" trim accessibilityRole="header" style={{ fontSize: 27, textAlign: 'center' }}>
        {title}
      </Text>
      <Text
        variant="body"
        className="mt-3"
        style={{ color: theme.muted, textAlign: 'center', maxWidth: 320 }}>
        {body}
      </Text>
      <View className="mt-8 w-full">
        <PrimaryAction
          label={action}
          onPress={onAction}
          loading={busy}
          loadingLabel={busyLabel}
        />
      </View>
    </View>
  );
}
