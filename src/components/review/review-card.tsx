import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Dimensions, Pressable, TextInput, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Chip } from '@/components/ui/chip';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { Swatch } from '@/components/ui/swatch';
import { Text } from '@/components/ui/text';
import { AX_STACK_SCALE } from '@/features/closet/dynamic-type';
import { stableImageSource } from '@/features/closet/use-image-urls';
import type { Item, ItemCategory } from '@/schemas/item';
import { GUTTER, MIN_TAP_TARGET, motion, spring, useTheme } from '@/theme/tokens';

const SCREEN_WIDTH = Dimensions.get('window').width;
/**
 * Swipe far enough that the card genuinely commits, not so far that a fat
 * thumb accidentally rejects an item. Roughly one-quarter of the screen.
 */
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;

/**
 * The Confirm drag pill's fill, exactly as the state atlas draws it (R-03).
 * Deliberately not `theme.positive`: the outcome overlays are the one place the
 * deck admits another hue, and the atlas chose this muted sage over the app's
 * brighter success green. Local because no other surface draws a drag outcome.
 */
const CONFIRM_OVERLAY_GREEN = '#3E6B4A';

/**
 * RV-01's action height. Both peers take it, so neither can end up the taller
 * one — the deviation ledger records "Skip lighter than Looks right" as the
 * fault this replaces, and a difference in height is a difference in weight
 * whatever the fill says.
 */
const ACTION_HEIGHT = 52;

const CATEGORY_OPTIONS: { key: ItemCategory; label: string }[] = [
  // "Tops", plural, matches the handoff's exact "Tops · Knitwear" (Frame 08)
  // and the plural convention the closet's own category filter already uses.
  { key: 'top', label: 'Tops' },
  { key: 'bottom', label: 'Bottom' },
  { key: 'outerwear', label: 'Outerwear' },
  { key: 'footwear', label: 'Shoes' },
  { key: 'dress', label: 'Dress' },
  { key: 'accessory', label: 'Accessory' },
  { key: 'bag', label: 'Bag' },
  { key: 'headwear', label: 'Headwear' },
  { key: 'jewelry', label: 'Jewelry' },
  { key: 'other', label: 'Other' },
];

/**
 * What the user typed, as a number the database can hold.
 *
 * Blank is null — "I don't know what this cost" — and never 0: a zero is a
 * garment that appears free, which would quietly poison every cost-per-wear
 * figure it touches. Anything unparseable is treated as blank rather than
 * guessed at. Exported because the item screen edits the same field and must
 * agree with this card to the letter.
 */
export function parsePrice(text: string): number | null {
  const cleaned = text.replace(/[^0-9.]/g, '');
  if (cleaned === '' || cleaned === '.') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** How a price is printed back: whole dollars when it is one, cents when not. */
export function formatPrice(value: number): string {
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}

export type ReviewCardProps = {
  item: Item;
  /**
   * A SIGNED, displayable URL for the garment photograph — never a storage path.
   *
   * The `garments` bucket is private, so `item.thumbPath` and friends are keys,
   * not URLs: handing one to `<Image>` renders nothing at all, silently, with no
   * error to debug (see the comment on `useSignedUrls`). This card used to do
   * exactly that, which is why the deck showed a blank plate for every user. The
   * parent signs the whole queue in one batch and hands the result down; this
   * component deliberately has no access to the raw paths' resolution logic, so
   * the mistake cannot be reintroduced here.
   *
   * Undefined while the batch is still in flight, and undefined for a garment
   * with no photograph — the two are told apart by the item's own paths below.
   */
  imageUri?: string;
  /**
   * The one-line, muted admission of what the tagger could not read AND the card
   * has no control for. Optional and usually absent.
   *
   * It lives on the card rather than in a screen-wide banner above the deck: a
   * full-width notice at the top of somebody's first review session reads as an
   * error the app is reporting about itself, at the most delicate moment in
   * onboarding. The honesty is worth keeping; the volume was not.
   */
  gapNote?: string | null;
  /** True for the visible card. Cards below the top render smaller and inert. */
  isTop: boolean;
  /** Ordinal from the top; 0 = active, 1 = peeking underneath, 2+ = hidden. */
  depth: number;
  /**
   * Right swipe, or the "Looks right" button. The parent persists
   * `user_verified` along with whatever corrections the user made.
   */
  onConfirm: () => void;
  /**
   * Left swipe, or the Skip button. Deliberately a SEPARATE handler from
   * `onConfirm`: skipping must not write anything, because the whole point is
   * that the user could not decide yet. Wiring both directions to one callback
   * is how this screen used to silently mark deferred items as trusted.
   */
  onSkip: () => void;
  category: ItemCategory;
  /**
   * Still accepted (and still supplied by the parent's edit state), but the
   * handoff's review card surfaces only Category / Colours / Details — no
   * "wear it for" row — so this card does not render an occasions editor.
   * Kept on the prop type rather than deleted so the parent's patch logic
   * (which can send an occasions correction if one is ever made upstream of
   * this card) does not have to change shape.
   */
  occasions: string[];
  /**
   * What the garment cost, as edited in this sitting. Null means the user has
   * not said — which is the honest default, and the reason cost per wear reads
   * as a dash until they do.
   */
  price: number | null;
  onEditCategory: (next: ItemCategory) => void;
  onToggleOccasion: (occasion: string) => void;
  onEditPrice: (next: number | null) => void;
  /**
   * RV-03 — the correction that has not reached the server yet.
   *
   * "The save failure is drawn in place on the editor rather than as an alert:
   * it states that the change is held locally, that it will be sent later, and
   * offers an immediate retry — the queue keeps the card, and returning from
   * the editor lands back on the same card in the same position."
   *
   * Null is the ordinary case. The parent owns the retry because the parent
   * owns the write; this card owns only where the notice is drawn, which the
   * frame is specific about: on the thing being corrected, never over it.
   */
  unsaved?: { onRetry: () => void; busy?: boolean } | null;
  /**
   * RV-01 / AX's composition, forced.
   *
   * Left undefined the card reads the system's own `fontScale`, which is the
   * only correct source on a real device. The override exists for the canonical
   * AX fixture: a capture route cannot change the phone's Dynamic Type setting,
   * and a stress frame that only appears when the capturing device happens to
   * be configured for it is a stress frame nobody can reproduce.
   */
  stacked?: boolean;
  /**
   * RV-03's editor, open from the first render.
   *
   * Same reasoning: the editor is normally reached by tapping a chip, and a
   * fixture that had to be tapped into position captures whatever frame the tap
   * landed on. Undefined is the shipping behaviour — closed.
   */
  openEditorInitially?: 'category' | 'price';
};

export function ReviewCard({
  item,
  imageUri,
  gapNote,
  isTop,
  depth,
  onConfirm,
  onSkip,
  category,
  price,
  onEditCategory,
  onEditPrice,
  unsaved = null,
  stacked: stackedOverride,
  openEditorInitially,
}: ReviewCardProps) {
  const theme = useTheme();
  const translateX = useSharedValue(0);

  /**
   * RV-01 / AX. Read from the system, never guessed, at the one threshold the
   * three stress frames share (`features/closet/dynamic-type.ts`).
   */
  const { fontScale } = useWindowDimensions();
  const stacked = stackedOverride ?? fontScale >= AX_STACK_SCALE;

  /**
   * How long the card takes to leave, and nothing else.
   *
   * Reduce Motion is a request not to be thrown large objects across the
   * screen; it is NOT a request to lose the swipe, which is this deck's whole
   * interaction. So the gesture — its thresholds, its overlays, its committed
   * outcomes — is untouched, and only the fly-off's duration collapses to the
   * shortest step on the scale. A plain boolean, captured by the worklet below
   * the same way `depth` is.
   */
  const reduceMotion = useReducedMotion();
  const flyOffDuration = reduceMotion ? motion.duration.fast : motion.duration.slow;

  // Which row's editor is open, if any. Only one at a time — this is a "tap to
  // correct" affordance, not a form. Category and Price are the two fields this
  // card can actually patch (see `useVerifyItem`), so Colours and Details below
  // render as plain read-outs with no Edit affordance at all: a coloured "Edit"
  // that does nothing reads as broken, which is worse than its absence.
  const [openEditor, setOpenEditor] = useState<'category' | 'price' | null>(
    openEditorInitially ?? null,
  );

  /**
   * RV-01 / AX's "Change something" disclosure.
   *
   * "the three correction chips collapse into one Change something row that
   * opens the same editors — three 19 pt chips could not sit in a row without
   * wrapping into a shape nobody could scan."
   *
   * It opens the chips rather than one editor, because there are two editors
   * and a single row cannot choose between them without guessing which field
   * the user thinks is wrong — which is the exact fault RV-01 names ("no user
   * has to audit a form to find what is wrong"). The chips are the naming; this
   * row is only what keeps them out of a wrap at 19pt.
   */
  const [axChangeOpen, setAxChangeOpen] = useState(false);

  /**
   * The raw text of the price field. Kept beside the parsed number the parent
   * holds because a half-typed "12." is a valid thing to be looking at and not
   * a valid thing to store — the card owns the keystrokes, the parent owns the
   * value.
   */
  const [priceDraft, setPriceDraft] = useState(() => (price != null ? String(price) : ''));

  const fireHaptic = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
      /* haptics no-op silently in Low Power Mode etc.; the swipe animation is
         the real feedback. Never let a haptic failure block the interaction. */
    });
  }, []);

  const confirm = useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  const skip = useCallback(() => {
    onSkip();
  }, [onSkip]);

  const confirmFromButton = useCallback(() => {
    // The swipe path gets the heavier "success" notification haptic; a tap on
    // the button gets the lighter selection tick the shared Button gives
    // every other tap — this control just isn't built from Button (see below).
    void Haptics.selectionAsync().catch(() => {});
    confirm();
  }, [confirm]);

  const pan = Gesture.Pan()
    .enabled(isTop)
    .activeOffsetX([-8, 8])
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      const dragged = e.translationX + e.velocityX * 0.15;
      if (dragged > SWIPE_THRESHOLD) {
        // Fly off right → confirm. The success haptic is reserved for this
        // direction; a skip is not an accomplishment and should not feel like one.
        translateX.value = withTiming(SCREEN_WIDTH * 1.4, { duration: flyOffDuration });
        runOnJS(fireHaptic)();
        runOnJS(confirm)();
      } else if (dragged < -SWIPE_THRESHOLD) {
        // Fly off left → skip. Nothing is persisted, so the item is still
        // unverified server-side and returns on the next visit.
        translateX.value = withTiming(-SCREEN_WIDTH * 1.4, { duration: flyOffDuration });
        runOnJS(skip)();
      } else {
        translateX.value = withSpring(0, spring.interactive);
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      [-8, 0, 8],
      Extrapolation.CLAMP,
    );
    // Peek offset for cards below the top. Scale + translate stacks them like
    // a physical deck rather than layering flat.
    const restingScale = 1 - depth * 0.04;
    const restingY = depth * 6;

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: restingY },
        { rotate: `${rotate}deg` },
        { scale: restingScale },
      ],
      opacity: depth >= 3 ? 0 : 1,
    };
  });


  const needsReview = item.status === 'needs_review';

  /**
   * Whether this garment HAS a photograph, which is a different question from
   * whether its URL has arrived yet.
   *
   * Telling the two apart is what keeps the placeholder honest: a tshirt glyph
   * flashed over a card whose photo is one signing round-trip away claims the
   * item has no picture, and then contradicts itself a moment later. While the
   * batch is in flight the plate simply stays empty.
   */
  const hasPhoto = Boolean(item.thumbPath || item.cutoutPath || item.imagePath);
  const photoSource = stableImageSource(imageUri);

  // "Other" with no subtype is the tagger's catch-all, not an answer, and the
  // atlas prints it the way it prints every unanswered field: "Uncategorised",
  // in the faint register (R-02) — a placeholder to fill, not a value to trust.
  const isUncategorised = category === 'other' && !item.subcategory;
  const categoryLabel = CATEGORY_OPTIONS.find((c) => c.key === category)?.label ?? 'Uncategorised';
  const categoryValue = isUncategorised
    ? 'Uncategorised'
    : item.subcategory
      ? `${categoryLabel} · ${item.subcategory}`
      : categoryLabel;

  const colours = item.colors.slice(0, 3);
  const coloursValue = colours.length > 0 ? colours.map((c) => c.name).join(' · ') : 'Not detected';

  // "Details" has no field of its own in the schema — it's a best-effort
  // summary of what the tagger already wrote down, material first.
  const detailsParts = [item.material, item.pattern && item.pattern !== 'none' ? item.pattern : null].filter(
    (p): p is string => Boolean(p),
  );
  const detailsValue =
    detailsParts.length > 0 ? detailsParts.join(' · ') : (item.description ?? 'No extra details');

  /**
   * RV-03's editor, and RV-01's card, are the SAME SHEET.
   *
   * "The editor is the same sheet at the same height with its own back title,
   * and the source photograph stays on screen so the correction is made against
   * the thing being corrected." So the editor is not a second surface pushed
   * over this one — it is what this one draws while a category is being chosen,
   * which is also why "returning from the editor lands back on the same card in
   * the same position" is true by construction rather than by restoring state.
   */
  const editingCategory = openEditor === 'category';

  /** RV-03's notice. Drawn wherever the correction is, never as an alert. */
  const unsavedNotice = unsaved ? (
    <View
      accessibilityLiveRegion="polite"
      className="mt-4 rounded-md bg-tray px-4 py-3">
      <Text variant="label" className="text-ink" style={{ fontSize: 15 }}>
        That correction has not saved yet
      </Text>
      <Text variant="note" className="mt-1" style={{ fontSize: 14, lineHeight: 21 }}>
        Cinch could not reach your closet a moment ago. Your change is held on this phone and
        will be sent when the connection returns.
      </Text>
      {/* An immediate retry, as a peer rather than as an alert's only button.
          Paper with a hairline at r12 — outlined, so regular weight. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send it now"
        accessibilityState={{ disabled: unsaved.busy ?? false, busy: unsaved.busy ?? false }}
        disabled={unsaved.busy}
        onPress={unsaved.onRetry}
        style={{ minHeight: MIN_TAP_TARGET, alignSelf: 'flex-start', opacity: unsaved.busy ? 0.5 : 1 }}
        className="mt-3 items-center justify-center rounded-md border border-hairline bg-surface px-4 active:opacity-70">
        <Text variant="body" className="text-ink" style={{ fontSize: 15 }}>
          Send it now
        </Text>
      </Pressable>
    </View>
  ) : null;

  /** The garment well, at whichever size the composition asks for. */
  const well = (width: number, height: number) => (
    <View
      className="items-center justify-center overflow-hidden rounded-md bg-tray"
      style={{ width, height }}>
      {photoSource ? (
        <Image
          source={photoSource}
          contentFit="contain"
          transition={180}
          style={{ width: '100%', height: '100%' }}
          accessibilityIgnoresInvertColors
        />
      ) : hasPhoto ? null : (
        <SymbolView
          name={needsReview ? 'exclamationmark.triangle' : 'tshirt'}
          size={40}
          tintColor={needsReview ? theme.warning : theme.hairline}
          resizeMode="scaleAspectFit"
        />
      )}
    </View>
  );

  /** The two correction chips, named — RV-01's "each one opens the relevant editor". */
  const correctionChips = (
    <View className="mt-4 flex-row flex-wrap gap-2">
      <Chip
        label="Change category"
        selected={openEditor === 'category'}
        selectedGround="ink"
        onPress={() => setOpenEditor((cur) => (cur === 'category' ? null : 'category'))}
      />
      <Chip
        label={price != null ? 'Change price' : 'Add a price'}
        selected={openEditor === 'price'}
        selectedGround="ink"
        onPress={() => setOpenEditor((cur) => (cur === 'price' ? null : 'price'))}
      />
    </View>
  );

  /** The price editor, in place under the chips. */
  const priceEditor =
    openEditor === 'price' ? (
      <View
        className="mt-3 w-full flex-row items-center rounded-md border border-rule px-3"
        style={{ minHeight: MIN_TAP_TARGET }}>
        <Text variant="callout" className="text-muted">
          $
        </Text>
        <TextInput
          value={priceDraft}
          onChangeText={(next) => {
            setPriceDraft(next);
            onEditPrice(parsePrice(next));
          }}
          // Decimal pad, not numeric: there is no return key to lose (the chip
          // above closes it) and no reason to offer anything but digits and a
          // point.
          keyboardType="decimal-pad"
          inputMode="decimal"
          // The atlas draws the caret in the accent (R-06) — the system-blue
          // default is the one foreign colour this card could otherwise show.
          selectionColor={theme.accent}
          placeholder="0"
          placeholderTextColor={theme.muted}
          autoFocus
          accessibilityLabel="Price paid, in dollars"
          returnKeyType="done"
          onSubmitEditing={() => setOpenEditor(null)}
          className="ml-1 flex-1 font-body text-callout text-ink"
          style={{ minHeight: MIN_TAP_TARGET, color: theme.ink }}
        />
      </View>
    ) : null;

  /**
   * AUDIT 72 — TWO PEERS OF EQUAL WEIGHT, AND THE CONSEQUENCE PRINTED.
   *
   * "Skip and Looks right are both 52 pt and both full half-width peers; only
   * the accepting one is filled, and the consequence of skipping is printed
   * under them rather than discovered afterwards."
   *
   * RV-01 / AX changes the arrangement and nothing else: "Accept moves above
   * Skip because a stacked pair has no dominant side; it is the filled one
   * either way." Both are hand-built rather than one `Button` beside one
   * `Pressable` — that pairing let the two controls take different intrinsic
   * heights, which is exactly the "Skip lighter than Looks right" the deviation
   * ledger records.
   *
   * The swipe is the fast path, not the only path: a pan gesture is unavailable
   * to VoiceOver and Switch Control, and awkward one-handed on a large phone.
   */
  const skipAction = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Skip for now"
      accessibilityHint="Leaves the tags unconfirmed. This item returns next time you review."
      onPress={skip}
      style={{ minHeight: ACTION_HEIGHT }}
      className={`${stacked ? 'w-full' : 'flex-1'} items-center justify-center rounded-md border border-rule active:opacity-70`}>
      {/* Regular weight — the constitution reserves Medium for labels and
          FILLED actions, and this one is outlined. */}
      <Text variant="body" className="text-ink">
        Skip for now
      </Text>
    </Pressable>
  );

  const acceptAction = (
    /*
      Not the shared Button: its "primary" variant is the oxblood accent, and
      the accepting action here is ink-filled instead — the "ink-selected"
      treatment the design system reserves for exactly this case, hand-built
      rather than repurposing a component whose whole job is guarding the accent.
    */
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Looks right"
      accessibilityHint="Marks these tags as correct and removes the item from the review queue."
      onPress={confirmFromButton}
      style={{ minHeight: ACTION_HEIGHT }}
      className={`${stacked ? 'w-full' : 'flex-1'} items-center justify-center rounded-md bg-ink active:opacity-70`}>
      {/* Inline style, not `text-canvas`. Two colour utilities on one element
          are resolved by their order in the GENERATED stylesheet — the order of
          the palette in tailwind.config.js — not by which the call site wrote
          last, so `text-canvas` here would lose to the variant's `text-ink`
          (canvas is declared first, ink later) and the label would vanish into
          the ink fill. Same trap as the item-detail hero tile. */}
      <Text variant="body" className="font-semibold" style={{ color: theme.canvas }}>
        Looks right
      </Text>
    </Pressable>
  );

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        // Inset by the page gutter on all four sides — the same measure every
        // other screen's `px-gutter` uses, taken from the token rather than
        // typed as 20 four times.
        //
        // RV-01 / AX asks for a 780pt sheet where RV-01 draws 604. This one is
        // already full-bleed between the insets rather than a fixed height, so
        // the growth the frame describes is what it does at every size — there
        // is no 604 to raise.
        style={[
          {
            position: 'absolute',
            left: GUTTER,
            right: GUTTER,
            top: GUTTER,
            bottom: GUTTER,
          },
          cardStyle,
        ]}
        pointerEvents={isTop ? 'auto' : 'none'}
        // Deliberately NOT `accessibilityRole="adjustable"`: that role promises
        // increment/decrement semantics this card does not have, and it was set
        // on a container whose only real affordance was a pan gesture — which
        // VoiceOver and Switch Control users cannot perform at all. The two
        // outcomes are exposed as real buttons at the foot of the card instead,
        // and the container stays a plain group so the correction chips inside
        // it remain individually focusable.
        accessibilityLabel={
          editingCategory
            ? `Choosing a category for ${item.subcategory ?? item.category}`
            : `Reviewing ${item.subcategory ?? item.category}`
        }
        // Cards under the top one are inert and must not be reachable by a
        // swipe of the VoiceOver cursor either.
        accessibilityElementsHidden={!isTop}
        importantForAccessibility={isTop ? 'yes' : 'no-hide-descendants'}>
        <View className="flex-1 overflow-hidden rounded-plate bg-surface">
          {/*
            The card's contents scroll, for one reason: the Price field.

            It is the last row before the buttons, which puts it within a
            thumb's width of the bottom of the screen — and the decimal pad
            covers roughly the bottom half. The field a person had just tapped
            was under the keyboard, with nothing on this screen able to move it.
            `automaticallyAdjustKeyboardInsets` is UIScrollView's own answer:
            the focused field rises above the keyboard and the rest of the card
            keeps its composition exactly as drawn. `flexGrow: 1` on the content
            is what lets the footer's `mt-auto` still push the buttons to the
            bottom when nothing is being edited, and the pan gesture above only
            claims horizontal movement (`activeOffsetX`), so a vertical drag
            scrolls rather than swiping the card away.
          */}
          <KeyboardAwareScrollView
            scrollEnabled={isTop}
            showsVerticalScrollIndicator={false}
            contentContainerClassName="p-5"
            contentContainerStyle={{ flexGrow: 1 }}>
            {editingCategory ? (
              <>
                {/* RV-03's own back title. The right-hand slot is an invisible
                    twin of Back rather than an empty view: the frame centres
                    the title between two equal widths, and a title centred
                    against nothing drifts as the word changes. */}
                <View className="flex-row items-center justify-between">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                    accessibilityHint="Returns to this piece with your correction kept"
                    onPress={() => setOpenEditor(null)}
                    style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
                    className="active:opacity-60">
                    <Text variant="body" className="text-muted" style={{ fontSize: 15 }}>
                      Back
                    </Text>
                  </Pressable>
                  <Text variant="body" className="font-semibold text-ink" style={{ fontSize: 15 }}>
                    Category
                  </Text>
                  <Text
                    variant="body"
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={{ fontSize: 15, color: 'transparent' }}>
                    Back
                  </Text>
                </View>

                {/* "the source photograph stays on screen so the correction is
                    made against the thing being corrected." */}
                <View className="mt-1 flex-row items-center gap-3.5">
                  {well(84, 104)}
                  <Text variant="note" className="flex-1" style={{ fontSize: 14, lineHeight: 21 }}>
                    {`${item.subcategory ?? item.category}. Choosing a category files it in that shelf; nothing else you have corrected is lost.`}
                  </Text>
                </View>

                {/* "The held option carries a ring, a tick and Medium weight
                    together" — three channels, so the state survives greyscale
                    and a colour-blind reading. */}
                <View className="mt-3 gap-2">
                  {CATEGORY_OPTIONS.map((c) => {
                    const held = category === c.key;
                    return (
                      <Pressable
                        key={c.key}
                        accessibilityRole="button"
                        accessibilityState={{ selected: held }}
                        accessibilityLabel={c.label}
                        onPress={() => {
                          onEditCategory(c.key);
                          setOpenEditor(null);
                        }}
                        style={{
                          minHeight: 46,
                          borderWidth: held ? 1.5 : 1,
                          borderColor: held ? theme.ink : theme.hairline,
                        }}
                        className={`flex-row items-center justify-between rounded-md px-4 active:opacity-70 ${
                          held ? 'bg-surface' : ''
                        }`}>
                        <Text
                          variant="body"
                          className={held ? 'font-semibold text-ink' : 'text-ink'}
                          style={{ fontSize: 17 }}>
                          {c.label}
                        </Text>
                        {held ? (
                          <SymbolView
                            name="checkmark"
                            size={14}
                            tintColor={theme.ink}
                            weight="semibold"
                            resizeMode="scaleAspectFit"
                          />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>

                {unsavedNotice}
              </>
            ) : (
              <>
                {/* RV-01 names the PIECE, not the question. "Is this right?" was
                    the same sentence on every card in the deck; the garment's
                    own name is the thing that changes, and it is what the two
                    actions at the foot are a verdict about. */}
                {stacked ? (
                  // RV-01 / AX: the garment keeps its place beside the name, and
                  // it is the FIELDS that move under both — "the fields move
                  // under the garment as full-width ruled rows".
                  <View className="mb-4 flex-row items-start gap-4">
                    {well(128, 156)}
                    <View className="flex-1">
                      <Text variant="title" trim numberOfLines={3}>
                        {item.subcategory ?? item.category}
                      </Text>
                      <Text variant="note" className="mt-2" style={{ fontSize: 18, lineHeight: 26 }}>
                        Read from your photograph.
                      </Text>
                    </View>
                    <DragPills translateX={translateX} canvas={theme.canvas} muted={theme.muted} />
                  </View>
                ) : (
                  <>
                    <Text variant="title" trim numberOfLines={2}>
                      {item.subcategory ?? item.category}
                    </Text>
                    {/* RV-01's own sentence, in `note` — 13px prose in the
                        regular cut, `muted`, with NO second colour on top of
                        it. It carried an inline `faint` until Wave 3: #8A8578
                        is 3.52:1 on this surface, and the constitution's
                        refusal is unconditional ("NEVER #8A8578 as text"). */}
                    <Text variant="note" className="mb-4 mt-1.5">
                      Cinch read this from your photograph.
                    </Text>
                  </>
                )}

                {stacked ? (
                  // Full-width ruled rows: label left, value right.
                  <View>
                    <AxFieldRow label="Category" value={categoryValue} hedged={isUncategorised} />
                    <AxFieldRow label="Colour" value={coloursValue} swatchHex={colours[0]?.hex ?? null} />
                    <AxFieldRow label="Fabric" value={detailsValue} />
                  </View>
                ) : (
                  /*
                    AUDIT 72 — THE GARMENT SITS BESIDE ITS GUESSED FIELDS.

                    "the garment and its three guessed fields sit side by side
                    rather than stacked, which buys back 116 pt, and the two
                    actions land 68 pt under the last field instead of at the
                    bottom of a tall sheet." That is the whole geometry change:
                    the decision moves up to sit beside the thing being decided,
                    and nothing lands below the fold.
                  */
                  <View className="mb-4 flex-row items-start gap-4">
                    {well(132, 160)}
                    <DragPills translateX={translateX} canvas={theme.canvas} muted={theme.muted} />
                    {/* The three guessed fields, beside the garment. Read-outs:
                        the corrections are the named chips under the row, per
                        RV-01, so "no user has to audit a form to find what is
                        wrong." */}
                    <View className="flex-1">
                      <FieldRow label="Category" value={categoryValue} hedged={isUncategorised} />
                      <FieldRow label="Colour" value={coloursValue} swatchHex={colours[0]?.hex ?? null} />
                      <FieldRow label="Fabric" value={detailsValue} last />
                    </View>
                  </View>
                )}

                {/*
                  TWO CHIPS, NOT THE FRAME'S THREE. The frame draws Change
                  category, Change colour and Add a price. This card can patch
                  category and price and nothing else (`useVerifyItem`), and the
                  rule it already held is the right one: a control whose tap
                  does nothing reads as broken, which is worse than its absence.
                  The colour chip is therefore not drawn rather than drawn dead.
                  Recorded as a deviation in the report.

                  The chips are `Chip` at the shared 12pt radius — labelled
                  controls are 12, never capsules.
                */}
                {!stacked ? correctionChips : null}
                {!stacked ? priceEditor : null}

                {/*
                  The footnote, and only ever a footnote.

                  This is what the tagger could not read on rows the card cannot
                  edit — a statement of record, not a request. It sits under the
                  spec lines, close enough to the blank rows that it explains
                  them, quiet enough that a first-time user reads the card
                  before they read the apology. Rendered only when there is
                  something to admit.
                */}
                {gapNote ? (
                  <Text variant="noteSmall" className="mt-3">
                    {gapNote}
                  </Text>
                ) : null}

                {unsavedNotice}

                <View className="mt-auto border-t border-hairline pt-4">
                  {stacked ? (
                    <View className="gap-2">
                      {acceptAction}
                      {skipAction}
                      {/* The three chips, collapsed into one row. Tapping it
                          reveals the named chips rather than guessing which
                          field is wrong. */}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Change something"
                        accessibilityState={{ expanded: axChangeOpen }}
                        accessibilityHint="Shows the fields you can correct on this piece"
                        onPress={() => setAxChangeOpen((open) => !open)}
                        style={{ minHeight: ACTION_HEIGHT }}
                        className="w-full items-center justify-center rounded-md bg-tray active:opacity-70">
                        <Text variant="body" className="text-ink">
                          Change something
                        </Text>
                      </Pressable>
                      {axChangeOpen ? correctionChips : null}
                      {axChangeOpen ? priceEditor : null}
                    </View>
                  ) : (
                    <View className="flex-row items-center gap-2.5">
                      {skipAction}
                      {acceptAction}
                    </View>
                  )}
                  {/* Printed under them, not discovered afterwards. */}
                  <Text variant="note" className="mt-2.5">
                    Skipping keeps the piece and the photograph. It comes back to this queue.
                  </Text>
                </View>
              </>
            )}
          </KeyboardAwareScrollView>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * Drag intent — visible only while the card is being dragged.
 *
 * STYLE, NOT className. NativeWind's interop registers React Native primitives
 * only, so a `className` on a Reanimated component is silently dropped — no
 * warning, nothing to debug. These two pills carried their ENTIRE appearance in
 * classes once, so they were rendering unpositioned, unpadded and untinted.
 *
 * THE GREEN IS THE ATLAS'S, not the theme's `positive`. The state atlas draws
 * this pill in #3E6B4A — the one place another hue is allowed in ("green and
 * grey are the outcome itself", rule card 05) — and that muted sage sits in the
 * palette's register where the success green #1A8754 reads as a foreign traffic
 * light. Scoped to this overlay rather than promoted to a token: nothing else in
 * the app draws a drag outcome.
 */
function DragPills({
  translateX,
  canvas,
  muted,
}: {
  /**
   * The card's own drag offset. The two styles are derived HERE rather than
   * passed in: `useAnimatedStyle` returns a handle whose generic is not
   * assignable to a `View`'s `style` prop, so threading one through a prop is
   * exactly where that mismatch surfaces — and the pills are the only thing
   * that reads these two styles anyway.
   */
  translateX: SharedValue<number>;
  canvas: string;
  muted: string;
}) {
  // A green check tips in from the right, a grey chevron from the left: the
  // outcome is visible *during* the drag, not only after.
  const accept = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));
  const skip = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <>
      <Animated.View
        style={[
          {
            position: 'absolute',
            right: 0,
            top: 8,
            borderRadius: 12,
            backgroundColor: CONFIRM_OVERLAY_GREEN,
            paddingHorizontal: 12,
            paddingVertical: 4,
          },
          accept,
        ]}
        pointerEvents="none">
        <Text variant="label" style={{ color: canvas }}>
          Confirm
        </Text>
      </Animated.View>
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            top: 8,
            borderRadius: 12,
            backgroundColor: muted,
            paddingHorizontal: 12,
            paddingVertical: 4,
          },
          skip,
        ]}
        pointerEvents="none">
        <Text variant="label" style={{ color: canvas }}>
          Skip
        </Text>
      </Animated.View>
    </>
  );
}

/**
 * RV-01 / AX's field row — label left, value right, one hairline under each.
 *
 * "Fields become ruled rows". Three centred read-outs beside a garment cannot
 * hold 19pt values, so the composition changes and nothing shrinks: the label
 * is 18pt prose and the value 19pt, both at their documented size.
 */
function AxFieldRow({
  label,
  value,
  hedged = false,
  swatchHex = null,
}: {
  label: string;
  value: string;
  hedged?: boolean;
  swatchHex?: string | null;
}) {
  return (
    <View className="flex-row items-baseline justify-between border-b border-hairline py-2.5">
      <Text variant="note" style={{ fontSize: 18, lineHeight: 26 }}>
        {label}
      </Text>
      <View className="ml-4 flex-1 flex-row items-center justify-end gap-2">
        {swatchHex ? <Swatch hex={swatchHex} size={14} /> : null}
        {/* No `numberOfLines`: "Nothing is capped, abbreviated or ellipsised to
            make this fit" — the row is allowed to wrap and grow. */}
        <Text
          variant="body"
          className={`text-right ${hedged ? 'text-muted' : 'text-ink'}`}
          style={{ fontSize: 19, lineHeight: 27 }}>
          {value}
        </Text>
      </View>
    </View>
  );
}

/**
 * One guessed field, beside the garment: a tracked label and the value under it.
 *
 * A READ-OUT, WITH NO AFFORDANCE OF ITS OWN. The row used to carry an accent
 * "Edit" on the two fields the pipeline can patch; RV-01 moves correction into
 * named chips under the whole block instead, "so no user has to audit a form to
 * find what is wrong". That also removes the last reason for a per-row control
 * that some rows had and others did not.
 *
 * `hedged` tones the value to `muted` when the guess is an unanswered one. It
 * is never `faint`: RV-02's rule is that uncertainty is written into the WORD,
 * never into the contrast.
 */
function FieldRow({
  label,
  value,
  hedged = false,
  last = false,
  swatchHex = null,
}: {
  label: string;
  value: string;
  hedged?: boolean;
  last?: boolean;
  /** The colour row's second channel — the value is never colour alone. */
  swatchHex?: string | null;
}) {
  return (
    <View className={last ? '' : 'mb-2.5 border-b border-hairline pb-2.5'}>
      <Text variant="colophon">{label}</Text>
      <View className="flex-row items-center gap-2">
        {swatchHex ? <Swatch hex={swatchHex} size={14} /> : null}
        <Text
          variant="callout"
          numberOfLines={2}
          className={`flex-1 ${hedged ? 'text-muted' : ''}`}>
          {value}
        </Text>
      </View>
    </View>
  );
}
