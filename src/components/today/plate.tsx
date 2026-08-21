import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View, useWindowDimensions, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { PlateCard } from '@/components/share/plate-card';
import {
  costPerWearLine,
  costPerWearSpoken,
  platedCostPerWear,
} from '@/components/today/cost-per-wear';
import { GarmentCell } from '@/components/today/garment-cell';
import { FailureBand, ReactionBar, type ReactionValue } from '@/components/today/reaction-bar';
import {
  wearFailureCopy,
  type WearFailureKind,
} from '@/features/styling/wear-failure';
import { RepeatMark } from '@/components/today/repeat-mark';
import { Swatch } from '@/components/ui/swatch';
import { PressableSurface } from '@/components/ui/pressable-surface';
import { Text } from '@/components/ui/text';

import { GRID_GAP, plateGrid, ROW_RATIO } from './plate-grid';
import { AX_FONT_SCALE } from './reaction-spec';
import {
  CONTACT,
  landingDelay,
  paletteEntries,
  TILE_RADIUS,
} from './plate-spec';
import { CARD_H, CARD_W, sharePlate } from '@/features/share/capture-plate';
import type { StyledOutfit } from '@/features/styling/use-outfits';
import type { Garment } from '@/lib/styling';
import { MIN_TAP_TARGET, spring, useTheme } from '@/theme/tokens';

/**
 * Order pieces the way a look is read aloud: outer layers, then core, then
 * feet. Exported for `repeat-outfit.tsx` (P-05), which credits a look the
 * same way without pulling in the rest of the plate.
 */
export const LAYOUT_ORDER: Garment['slot'][] = [
 'outerwear', 'mid_layer', 'base_top', 'dress', 'bottom', 'footwear', 'bag', 'accessory', 'headwear',
];

/** Context the colophon prints. Everything optional; missing fields drop out. */
export type PlateColophon = {
  city?: string | null;
  feelsLikeC?: number | null;
};

/**
 * The tiny label the design prints under the stack for each garment.
 * Capitalised: the approved App Store frames set the data line as
 * "Mohair sweater · Penny loafers", and a lowercase "shirt · loafers"
 * reads as debug output next to them.
 */
export const labelFor = (g: Garment) => {
  const s = g.subcategory ?? g.category;
  return s.charAt(0).toUpperCase() + s.slice(1);
};





/** One garment landing into the stack. */
function Landing({
  index,
  count,
  still,
  style,
  children,
}: {
  index: number;
  count: number;
  still: boolean;
  style?: ViewStyle;
  children: React.ReactNode;
}) {
  const progress = useSharedValue(still ? 1 : 0);

  useEffect(() => {
    if (still) return;
    const last = index === count - 1;
    progress.value = withDelay(
      landingDelay(index),
      // The final garment landing is the app's one bouncy moment.
      withSpring(1, last ? spring.bouncy : spring.smooth),
    );
  }, [count, index, progress, still]);

  const animated = useAnimatedStyle(() => ({
    opacity: Math.min(progress.value * 1.6, 1),
    transform: [
      { translateY: (1 - progress.value) * 18 },
      { scale: 0.96 + progress.value * 0.04 },
    ],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/**
 * THE COMPOSED-LOOK GRID — audit 58, and the biggest change in this group.
 *
 * What it replaces: five absolutely-positioned cutouts at four different sizes,
 * overlapping like worn clothes, 380 pt tall. The atlas retires that treatment
 * on Today with a rule a reviewer can check on a simulator — "No garment is a
 * colour block. No tile covers another. Every piece in the look is named in the
 * list beneath it" — and one grid at one scale is what satisfies it.
 *
 * Every row is the same height, so no piece is drawn larger than another; cells
 * stretch to fill their row, so a short look never leaves a hole. The row plan
 * itself is `plateGrid()`, which is pure and tested.
 *
 * The stack geometry is NOT deleted: `stackLayout` still serves the repeat
 * screen, the event outfit post and their dev routes, all owned elsewhere.
 */
function ComposedLook({
  pieces,
  resolveImage,
  still,
  withHaptic,
  label,
  onOpenPiece,
}: {
  pieces: Garment[];
  resolveImage: (...paths: (string | null | undefined)[]) => string | undefined;
  still: boolean;
  /** Only the day's first card earns the landing haptic. */
  withHaptic: boolean;
  label: string;
  /** Tapping a tile opens the piece. Omitted where there is no piece to open. */
  onOpenPiece?: (garment: Garment) => void;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  // Rows of garments, not a running cursor: the plan is data, and slicing it
  // once keeps the render a pure function of it.
  const rows = useMemo(() => {
    const plan = plateGrid(pieces.length);
    // Offsets by prefix sum rather than by a running cursor: the render stays
    // a pure function of the plan, with nothing reassigned inside it.
    return plan.map((cells, i) => {
      const from = plan.slice(0, i).reduce((a, b) => a + b, 0);
      return { from, pieces: pieces.slice(from, from + cells) };
    });
  }, [pieces]);
  const rowHeight = width > 0 ? width * ROW_RATIO : 0;

  useEffect(() => {
    if (still || !withHaptic || pieces.length === 0) return;
    // Fired for the LAST piece to land, mid-spring — the moment the look reads
    // as assembled.
    const t = setTimeout(
      () => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
      },
      landingDelay(pieces.length - 1) + 200,
    );
    return () => clearTimeout(t);
  }, [pieces.length, still, withHaptic]);

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ gap: GRID_GAP }}
      // One node for the whole look, as the atlas's VoiceOver contract sets it:
      // "Outfit, Quiet authority, five pieces: …". Individual tiles are reached
      // by swiping into the group.
      accessible={!onOpenPiece}
      accessibilityRole="image"
      accessibilityLabel={label}>
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={{ flexDirection: 'row', gap: GRID_GAP }}>
          {row.pieces.map((garment, i) => (
              <Landing
                key={garment.id}
                index={row.from + i}
                count={pieces.length}
                still={still}
                style={{
                  flexGrow: 1,
                  flexShrink: 1,
                  flexBasis: 0,
                  // Height comes from the row, never from the picture: a piece
                  // whose photograph has not arrived reserves exactly the space
                  // it will occupy, so nothing reflows when it does.
                  height: rowHeight,
                  // Shadow and clip cannot share a view on iOS — a rounded rect
                  // that clips its children also clips its own shadow away — so
                  // the shadow is out here and the corner is on the layer below.
                  shadowColor: '#1C1A16',
                  shadowOpacity: 0.16,
                  shadowRadius: CONTACT.blur,
                  shadowOffset: { width: CONTACT.dx, height: CONTACT.dy },
                }}>
                <PressableSurface
                  fill
                  disabled={!onOpenPiece}
                  onPress={onOpenPiece ? () => onOpenPiece(garment) : undefined}
                  accessibilityRole={onOpenPiece ? 'button' : 'image'}
                  accessibilityLabel={labelFor(garment)}
                  accessibilityHint={onOpenPiece ? 'opens the piece' : undefined}
                  // The hairline is load-bearing, not trim: "a pale garment on
                  // the warm plate ground still reads as a bounded object at
                  // low contrast".
                  className="h-full w-full overflow-hidden border border-hairline"
                  style={{ borderRadius: TILE_RADIUS, backgroundColor: theme.tray }}>
                  <GarmentCell
                    garment={garment}
                    uri={resolveImage(garment.platePath, garment.cutoutPath, garment.thumbPath)}
                  />
                </PressableSurface>
            </Landing>
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * Whether the "Hold to share" hint has done its job, cached for the session.
 *
 * The affordance is long-press only and otherwise reachable solely through
 * `accessibilityHint`, so a sighted user has no way to learn it exists. Printed
 * once, on the first plate, until the first successful share — after that the
 * card carries no share chrome at all, which is the point.
 */
const SHARE_HINT_KEY = 'cinch.share.hint-retired';
let shareHintRetired: boolean | null = null;

function useShareHint(active: boolean) {
  // Starts hidden: a hint that flashes in and then disappears once storage
  // answers is worse than one that arrives a frame late. Once the module-level
  // answer is known every later mount reads it straight from the initialiser.
  const [retired, setRetired] = useState(() => shareHintRetired ?? true);

  useEffect(() => {
    if (!active || shareHintRetired !== null) return;
    let cancelled = false;
    void AsyncStorage.getItem(SHARE_HINT_KEY)
      .then((v) => {
        shareHintRetired = v === '1';
        if (!cancelled) setRetired(shareHintRetired);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [active]);

  const retire = useCallback(() => {
    if (shareHintRetired) return;
    shareHintRetired = true;
    setRetired(true);
    void AsyncStorage.setItem(SHARE_HINT_KEY, '1').catch(() => {});
  }, []);

  return { showHint: active && !retired, retire };
}

/**
 * WHAT MARKING A LOOK WORN ACTUALLY CHANGED — T-14.
 *
 * "The action row is replaced rather than disabled, because after the decision
 * there is no decision left to offer. The consequence is named as a number of
 * counts rather than a vague success, and the 24-hour edit window is stated at
 * the moment it starts, not discovered later in the diary."
 *
 * The count is derived, never written: `wear_outfit_tx` increments `wear_count`
 * on every piece in the look and `unwear_outfit_tx` puts every one of them
 * back, so the number of counts that went up IS the number of pieces. The
 * 24-hour window is the diary's own server-enforced rule
 * (`features/diary/entry.ts`, `CORRECTION_WINDOW_MS`), which is why this frame
 * may state it.
 *
 * No oxblood: nothing is left to do here.
 */
function WornBand({
  pieces,
  onUndo,
  onAddNote,
  undoing,
}: {
  pieces: number;
  onUndo?: () => void;
  onAddNote?: () => void;
  undoing?: boolean;
}) {
  const theme = useTheme();

  return (
    <View className="mt-3.5 rounded-md bg-tray p-3" accessibilityLiveRegion="polite">
      <Text variant="label" style={{ color: theme.ink }}>
        {pieces} wear {pieces === 1 ? 'count' : 'counts'} went up
      </Text>
      <Text variant="note" className="mt-1">
        It is in the diary as today. You can change your mind for the next 24 hours.
      </Text>
      {onUndo || onAddNote ? (
        <View className="mt-2.5 flex-row items-center gap-2">
          {onUndo ? (
            <PressableSurface
              accessibilityRole="button"
              accessibilityLabel="Undo — take today off the record"
              accessibilityState={{ disabled: Boolean(undoing), busy: Boolean(undoing) }}
              disabled={undoing}
              onPress={onUndo}
              style={{ minHeight: MIN_TAP_TARGET, minWidth: 76 }}
              contentStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
              className={`rounded-md border border-rule px-3 ${
                undoing ? 'opacity-40' : ''
              }`}>
              <Text variant="label" style={{ color: theme.ink }}>
                Undo
              </Text>
            </PressableSurface>
          ) : null}
          {onAddNote ? (
            <PressableSurface
              accessibilityRole="button"
              accessibilityLabel="Add a note to the diary"
              onPress={onAddNote}
              style={{ minHeight: MIN_TAP_TARGET }}
              contentStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
              className="flex-1 rounded-md border border-rule px-3">
              <Text variant="label" style={{ color: theme.ink }}>
                Add a note to the diary
              </Text>
            </PressableSurface>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * A plate from the day's edit — the app's signature component, set as the
 * design's white outfit card.
 *
 * The card, top to bottom: the outfit's serif name with the feels-like it
 * was chosen against as a colophon; the model's reasoning; the stack, the look
 * composed body-ordered with the pieces named beneath it in one credit line;
 * then a footer printing the palette in the engine's own colours and the
 * look's cost per wear — a number Whering and Indyx print too now, so it isn't
 * what makes this footer Cinch's; the friends who voted this look into
 * existence, from a closet they can see is real, are — and the love / not-for-me
 * / worn actions.
 */
/**
 * The action row is all-or-nothing, and the type says so.
 *
 * A plate either takes both handlers, or declares itself a preview and takes
 * neither. There is no third shape, because the third shape is the bug:
 * handlers that exist and do nothing, under pills that look live. Expressed as
 * a union so the compiler rejects it instead of a reviewer having to spot it.
 */
type PlateActions =
  | { preview: true; onWear?: never; onReact?: never }
  | { preview?: false; onWear: () => void; onReact: (value: ReactionValue) => void };

export function Plate({
  outfit,
  index,
  occasion,
  colophon,
  resolveImage,
  onWear,
  onReact,
  reacted,
  wearing,
  wearFailure,
  worn,
  offline = false,
  preview = false,
  repeat = null,
  still,
  stacked,
  accent = true,
  dated = null,
  hideRationale = false,
  actionsUnavailable = null,
  wornBand = null,
  onOpenPiece,
}: {
  outfit: StyledOutfit;
  /** Position in the day's set — only the first card gets the landing haptic. */
  index: number;
  /** What the look is for — the user's note or the day's first event. */
  occasion?: string | null;
  colophon: PlateColophon;
  resolveImage: (...paths: (string | null | undefined)[]) => string | undefined;
  reacted?: ReactionValue | null;
  wearing?: boolean;
  /** The wear write came back with a classified error and has not been retried. */
  wearFailure?: WearFailureKind | null;
  worn?: boolean;
  /**
   * The offline cut of the card: name, stack, and a footer saying the look
   * came off disk, with its cost per wear. Everything the network paid for —
   * the model's reasoning, the feels-like it was scored against — and every
   * action that needs the network — love, not-for-me, worn — is dropped rather
   * than shown dead. Default false: every online caller is unchanged.
   */
  offline?: boolean;
  /**
   * The preview cut: the full card — reasoning, palette, cost per wear — with
   * the action row dropped.
   *
   * Same rule the `offline` cut follows, for a different reason. Offline drops
   * love / not-for-me / worn because the network cannot carry them. Preview
   * drops them because the caller is showing the card somewhere the reaction
   * has nowhere to go: the Reveal renders "Plate 01 · the first one" before
   * the reader has entered the app, and there is no day yet to mark as worn.
   *
   * Until this existed the Reveal passed `onWear={() => {}} onReact={() => {}}`
   * and the pills rendered fully live — tappable, haptic on press, and doing
   * nothing at all. A dead control on the last screen of onboarding is worse
   * than an absent one, and the props union below is what stops it coming
   * back: a plate is either a preview and takes no handlers, or it is live and
   * must have both.
   */
  preview?: boolean;
  /**
   * The Repeat (Directive 5) — real previous wears of this exact core, when
   * there are any. Null on every plate that is not a repeat, and always null
   * offline: "See plans" is a paywall placement, which is exactly the kind of
   * network-dependent chrome the offline cut already drops.
   */
  repeat?: {
    previousWears: Date[];
    pieceCount: number;
    totalCores: number;
    onSeePlans: () => void;
    onShowAnother: () => void;
    /** "Now", for the panel's date prose. Defaults to the real time; a fixed
     * value is only ever passed by `dev-repeat.tsx` so its fixture dates read
     * against the narrative date they were written for, not whenever the
     * preview happens to be opened. */
    now?: Date;
  } | null;
  /**
   * Freeze the landing. Defaults to the system's Reduce Motion setting, which
   * is the only thing that decided it before; a fixed value is passed by the
   * `dev-w3-g2-*` fixture routes so a capture is the settled frame rather than
   * whichever millisecond of a spring the shutter caught. Same idiom, and same
   * reason, as `repeat.now`.
   */
  still?: boolean;
  /**
   * The largest supported type: the action row stacks at 60 pt in the same
   * order (audit 59). Defaults to the device's own font scale.
   */
  stacked?: boolean;
  /**
   * Whether this frame's one oxblood belongs to the plate's wear action. False
   * on T-02, where the occasion interrupt takes the accent.
   */
  accent?: boolean;
  /**
   * The date this look was built for, printed on the plate itself.
   *
   * Offline the notice above says the plate may be stale; this is the same fact
   * carried ON the object, "so 'yesterday's look' is verifiable on the object
   * rather than only in the notice".
   */
  dated?: string | null;
  /**
   * Show the look without the model's sentence — T-08's escape hatch. "It
   * renders the plate with no rationale and no apology, and the reactions
   * become live."
   */
  hideRationale?: boolean;
  /**
   * The row cannot act, and why. Offline (T-09): the sentence names what is
   * unavailable and what still works, and the controls are drawn inert by
   * ground rather than by faintness.
   */
  actionsUnavailable?: string | null;
  /** T-14's consequences band, once the wear has actually landed. */
  wornBand?: { onUndo?: () => void; onAddNote?: () => void; undoing?: boolean } | null;
  /** Tapping a garment tile opens the piece (item detail, group 3). */
  onOpenPiece?: (garment: Garment) => void;
} & PlateActions) {
  const theme = useTheme();
  const systemReduced = useReducedMotion();
  const reduced = still ?? systemReduced;
  const { fontScale } = useWindowDimensions();
  // The threshold the atlas's stress frames are drawn at. Below it three
  // controls sit across the row; at or above it they stack, in the same order,
  // with nothing removed.
  const stackRow = stacked ?? fontScale >= AX_FONT_SCALE;

  // The share flow: long-press mounts the 360×640 card off-screen, the card
  // reports ready, view-shot captures it, the system sheet opens. The card
  // unmounts when the sheet closes — it never stays resident.
  const [shareMounted, setShareMounted] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
  const shareView = useRef<View>(null);

  // "No name, no card" — share card atlas, 02 Anatomy: "An unnamed outfit
  // cannot be shared; the share action stays disabled until the stylist has
  // named it." The name is the poster's whole top band, so an untitled look
  // does not degrade gracefully, it renders as a bug that outlives the app it
  // came from. Better that the gesture do nothing than mint that artifact.
  const shareable = outfit.name.trim().length > 0;

  // The long-press affordance, printed once on the day's first card — and never
  // on a plate the long press would refuse, or the hint teaches a lie.
  const { showHint, retire } = useShareHint(index === 0 && !offline && shareable);

  /**
   * The deadline on the card reporting ready.
   *
   * The card only calls `onReady` once its collage has been measured and its
   * name has been through `onTextLayout`. Those are ordinary layout callbacks
   * and they do arrive — but if one ever doesn't, the failure mode is the worst
   * one available: the user feels the shutter haptic and then nothing happens,
   * for ever, with no sheet and no message, because the only path that reports
   * a problem runs *after* `onReady`. A silent hang is not one of the states
   * the atlas designs for; a failure is. So an unmet deadline is converted into
   * the failure the atlas does specify.
   */
  const readyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const failShare = useCallback((reason: string, err?: unknown) => {
    // The user felt the shutter haptic; going silent after it reads as a dead
    // button. The error haptic is the reflex; the line under the name is the
    // answer, because a haptic cannot say why.
    console.warn(`[share] ${reason}`, err);
    setShareFailed(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    setShareMounted(false);
  }, []);

  const clearReadyTimer = useCallback(() => {
    if (readyTimer.current) clearTimeout(readyTimer.current);
    readyTimer.current = null;
  }, []);

  // Nothing may outlive the plate — a timer that fires after unmount would set
  // state on a card that is gone.
  useEffect(() => clearReadyTimer, [clearReadyTimer]);

  const handleShare = useCallback(() => {
    if (!shareable || shareMounted) return;
    setShareFailed(false);
    // Rigid is the "snap" of the haptics vocabulary — the shutter.
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {});
    setShareMounted(true);
    // Generous on purpose: the card's own settle wait is 350ms, so this is not
    // a race against it — it is a floor under a callback that never came.
    clearReadyTimer();
    readyTimer.current = setTimeout(() => failShare('card never reported ready'), 4000);
  }, [clearReadyTimer, failShare, shareable, shareMounted]);

  const handleCardReady = useCallback(() => {
    clearReadyTimer();
    void sharePlate(shareView)
      .then(() => {
        retire();
        setShareMounted(false);
      })
      .catch((err) => failShare('capture failed', err));
  }, [clearReadyTimer, failShare, retire]);

  const pieces = useMemo(
    () =>
      [...outfit.candidate.items].sort(
        (a, b) => LAYOUT_ORDER.indexOf(a.slot) - LAYOUT_ORDER.indexOf(b.slot),
      ),
    [outfit.candidate.items],
  );

  const a11y = pieces
    .map((g) => `${g.colors[0]?.name ?? ''} ${g.subcategory ?? g.category}`.trim())
    .join(', ');

  const palette = useMemo(() => paletteEntries(pieces), [pieces]);
  // T-03: printed only when EVERY piece carries a price. Otherwise the line is
  // absent — no dash, no estimate, and no explanation demanded of the reader.
  const cpw = useMemo(() => platedCostPerWear(pieces), [pieces]);
  const cpwLine = costPerWearLine(cpw);
  const cpwSpoken = costPerWearSpoken(cpw);

  return (
    <View className="mb-section px-gutter">
      <View className="rounded-plate border border-rule bg-surface p-3.5">
        {/* T-14 keeps its status at the top, "so a screenshot of this frame
            still says what happened". */}
        {worn ? (
          <View className="mb-2.5 flex-row items-center gap-1.5">
            <SymbolView
              name="checkmark"
              size={13}
              tintColor={theme.ink}
              resizeMode="scaleAspectFit"
            />
            <Text variant="label" style={{ color: theme.ink }}>
              Worn today
            </Text>
          </View>
        ) : null}
        {/* Long-press the visual → the 1080×1920 artifact. The share target is
            the card's editorial half only; the action pills below stay tappable
            and the card carries no share chrome of its own.

            On an unnamed plate the recogniser and the hint stand down together:
            leaving the hint behind would have VoiceOver promise a share the
            gesture then refuses, which is worse than no affordance at all. */}
        <Pressable
          onLongPress={shareable ? handleShare : undefined}
          delayLongPress={350}
          accessibilityHint={shareable ? 'Long press to share this plate as an image' : undefined}>
          {/* ── Header: the outfit's name, and the date it was built for ──
                 Audit 57: the temperature is NOT here. It is in the masthead's
                 context label, once, and the plate's old "Feels 72°F" eyebrow
                 is removed rather than relabelled — the two were the same
                 fact. What can stand here is a date, and only when the plate
                 is not today's (T-09). */}
          <View className="flex-row items-baseline justify-between gap-3">
            <Text variant="plate" numberOfLines={2} className="flex-1">
              {outfit.name}
            </Text>
            {dated ? <Text variant="colophon">{dated}</Text> : null}
          </View>

          {/* Directly under the name, where the atlas's Failure card sets it
              (02 Anatomy). The name is what the user pressed, so the name is
              where the refusal has to answer — stranded below the credits at
              the far end of the card it reads as a note about the credits, and
              on a long plate it can be off-screen when the haptic fires. */}
          {shareFailed ? (
            <Text
              variant="noteSmall"
              className="mt-2"
              accessibilityLiveRegion="polite"
              style={{ color: theme.critical }}>
              Couldn&rsquo;t make the image. Try again in a moment.
            </Text>
          ) : null}

          {/* Reasoning stays in the styling and persistence pipeline. Today
              presents the name, composition and garment credits only. */}

          {/* ── The look: one grid, one scale, no overlap (audit 58). ── */}
          <View className="mt-4">
            <ComposedLook
              pieces={pieces}
              resolveImage={resolveImage}
              still={reduced}
              withHaptic={index === 0}
              onOpenPiece={onOpenPiece}
              label={`Outfit, ${outfit.name}, ${pieces.length} pieces: ${a11y}`}
            />
          </View>

          {/* ── The credit line. The row of per-cell captions the flat-lay used
                 to carry has nowhere to sit under overlapping pieces, so the
 engine's own name for each garment is set once, in order, the
                 way a lookbook credits a shot. ── */}
          <View className="mt-2.5 flex-row items-baseline justify-between gap-3">
            <Text variant="caption" numberOfLines={2} className="flex-1">
              {pieces.map(labelFor).join(' · ')}
            </Text>
            {/* The only chrome the share flow ever gets, and it retires
                itself: printed on the day's first card until the first
                successful share, then never again. */}
            {showHint ? <Text variant="colophon">Hold to share</Text> : null}
          </View>
        </Pressable>

        {!offline && outfit.swapNote ? (
          <View className="mt-3 flex-row gap-2 rounded-md border border-hairline p-3">
            <SymbolView
              name="arrow.triangle.2.circlepath"
              size={14}
              tintColor={theme.muted}
              resizeMode="scaleAspectFit"
            />
            {/* Inline `style`, not a second `text-*` class: `label` already
                bakes in `text-muted`, and stacking `text-ink` on top of it is
                resolved by tailwind.config.js's key order, not by intent. */}
            <Text variant="label" className="flex-1" style={{ color: theme.ink }}>
              {outfit.swapNote}
            </Text>
          </View>
        ) : null}

        {/* ── The Repeat (Directive 5): a line at the first repeat, a panel
               from the third wear on. Never offline — see the `repeat` prop's
               own doc for why. ── */}
        {!offline && repeat ? (
          <RepeatMark
            previousWears={repeat.previousWears}
            pieceCount={repeat.pieceCount}
            totalCores={repeat.totalCores}
            now={repeat.now}
            onSeePlans={repeat.onSeePlans}
            onShowAnother={repeat.onShowAnother}
          />
        ) : null}

        {/* ── The palette, in the engine's own colours AND their names, and
               what wearing the look costs per wear.

               Names, not colour alone: "The palette is three swatches with
               their names printed beside them" — and the VoiceOver contract
               announces the names, never the hex values, which is only
               possible because the label carries them too.

               Cost-per-wear prints only when every piece is priced. When it is
               not computable the LINE IS ABSENT: no dash, no estimate. The
               previous drawing rendered "—" here on the argument that the
               footer's geometry had to be reserved; the refusal list is
               explicit that a dash is invented data, and the geometry is worth
               less than the honesty. ── */}
        <View className="mt-3 flex-row items-center justify-between gap-3 border-t border-rule pt-2.5">
          <View className="flex-1 flex-row flex-wrap items-center gap-x-2 gap-y-1">
            {palette.map((entry, i) => (
              <View key={`${entry.hex}-${i}`} className="flex-row items-center gap-1.5">
                <Swatch hex={entry.hex} size={14} />
                <Text variant="note">{entry.name}</Text>
              </View>
            ))}
          </View>
          {cpwLine ? (
            <Text variant="note" accessibilityLabel={cpwSpoken ?? undefined}>
              {cpwLine}
            </Text>
          ) : null}
        </View>

        {/* ── The action row: worn, loved, not for me — in that order, the wear
               action dominant by size as well as fill.

               Replaced rather than disabled once the wear has landed (T-14):
               after the decision there is no decision left to offer. ── */}
        {preview ? null : worn && wornBand ? (
          <WornBand
            pieces={pieces.length}
            onUndo={wornBand.onUndo}
            onAddNote={wornBand.onAddNote}
            undoing={wornBand.undoing}
          />
        ) : (
          /* The non-null assertions are sound and narrow: `PlateActions` makes
             both handlers required whenever `preview` is not true, and this
             block is unreachable when it is. TypeScript cannot narrow a
             destructured union, so the invariant is stated rather than proved. */
          <View style={{ marginTop: 14 }}>
            <ReactionBar
              onReact={onReact!}
              reacted={reacted}
              disabled={wearing}
              stacked={stackRow}
              unavailable={actionsUnavailable}
              wear={{
                worn: Boolean(worn),
                busy: Boolean(wearing),
                accent,
                onPress: onWear!,
              }}
            />
            {/* A failed wear is the one thing on this card that must not go
                quiet: `wear_count` and cost-per-wear are the numbers the
                product is about. Same band, same place, same grammar as a
                failed reaction — the failure sits under the row that produced
                it, and the decision is preserved. */}
            {wearFailure ? (
              <FailureBand
                {...wearFailureCopy(wearFailure)}
                onRetry={onWear!}
              />
            ) : null}
          </View>
        )}
      </View>

      {shareMounted ? (
        // Mounted far off-screen, never visible. `collapsable={false}` keeps
        // the view in the native hierarchy so view-shot has a layer to render.
        <View
          ref={shareView}
          collapsable={false}
          style={{ position: 'absolute', left: -9999, top: 0, width: CARD_W, height: CARD_H }}>
          <PlateCard
            outfit={outfit}
            occasion={occasion}
            colophon={colophon}
            resolveImage={resolveImage}
            onReady={handleCardReady}
          />
        </View>
      ) : null}
    </View>
  );
}
