import { Image } from 'expo-image';
import { ActivityIndicator, Linking, View } from 'react-native';

import { PressableSurface } from '@/components/ui/pressable-surface';
import { Text } from '@/components/ui/text';
import type { PinReference } from '@/features/stylist/inspiration';
import type { ChatMessage } from '@/features/stylist/use-chat';
import { oklchToHex } from '@/lib/color';
import type { Garment, OutfitCandidate } from '@/lib/styling';
import { useTheme } from '@/theme/tokens';

const LAYOUT_ORDER: Garment['slot'][] = [
 'outerwear', 'mid_layer', 'base_top', 'dress', 'bottom', 'footwear', 'bag', 'accessory', 'headwear',
];

// Corners of a chat bubble — generous everywhere except the corner nearest the
// speaker's own edge, which squares off to point at who's talking (the tail).
//
// The radii are literals rather than the `plate` token because the Stylist
// atlas draws the pair at 18/4 (S-03, and the "The bubble pair" anatomy panel),
// two points tighter than the 20pt a card gets. A bubble is not a plate: it
// wraps a line of speech and is often only a few words wide, where plate radius
// starts to round the whole thing toward a capsule.
//
// WAS 18, page-local, on the ground that "one frame does not justify minting"
// a token for it. Reference board C withdraws that argument: the app resolves
// every container to the scale, and 18 is not on it. `lg` (16) is the nearest
// step and the closest to the drawn shape — a bubble at `md` 12 would read as
// a field. The 4 on the tail corner is `sm` and was always on-scale.
//
// Directive over the drawn atlas value, on the founder's call (2026-08-11).
const STYLIST_BUBBLE = {
  borderTopLeftRadius: 16,
  borderTopRightRadius: 16,
  borderBottomRightRadius: 16,
  borderBottomLeftRadius: 4,
};
const USER_BUBBLE = {
  borderTopLeftRadius: 16,
  borderTopRightRadius: 16,
  borderBottomLeftRadius: 16,
  borderBottomRightRadius: 4,
};

/**
 * A recommended outfit inside a chat turn.
 *
 * Deliberately smaller than the Today card. In conversation the outfit is
 * evidence for what was just said, not the headline — a full-size card would
 * push the reply itself off the screen.
 */
function OutfitStrip({
  outfit,
  resolveImage,
  onPress,
  first,
}: {
  outfit: OutfitCandidate;
  resolveImage: (...paths: (string | null | undefined)[]) => string | undefined;
  onPress?: () => void;
  /**
   * True for the strip directly under the reply text. The first strip sits
   * closer to the bubble than the later ones do — see the marginTop below.
   */
  first?: boolean;
}) {
  const theme = useTheme();
  const pieces = [...outfit.items].sort(
    (a, b) => LAYOUT_ORDER.indexOf(a.slot) - LAYOUT_ORDER.indexOf(b.slot),
  );

  // "Cognac shearling coat, cream mohair sweater, charcoal trousers, brown
  // loafers" — the atlas's own caption, verbatim (S-05 and "The outfit strip"
  // panel). Note the casing: SENTENCE case, capital on the first word only.
  //
  // Stored colour names are lowercase by contract — src/features/closet/
  // item-name.ts documents that the tagger writes the column that way and
  // `pieceName` capitalises on read — so joining them raw yields a caption
  // that opens in lowercase. `pieceName` is the wrong fix here: it capitalises
  // each garment individually, which is right when a name stands alone on a
  // tile but would give "Cognac shearling coat, Cream mohair sweater" in a
  // list, where every piece after the first is mid-sentence. So the join
  // happens first and the capital is applied once, to the finished line.
  const raw = pieces
    .map((g) => `${g.colors[0]?.name ?? ''} ${g.subcategory ?? g.category}`.trim())
    .join(', ');
  const label = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : raw;

  return (
    <PressableSurface
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Outfit: ${label}`}
      // 10 above the first strip, 14 above every one after it (S-05: the first
      // strip's own margin-top is 10, the second's is 14). The two are not the
      // same gap doing double duty. The first number measures the drop from the
      // reply bubble to the evidence for it, which stays tight because they are
      // one thought; the second separates two complete alternatives, and has to
      // beat the 6pt caption sitting immediately above it or the caption would
      // read as a heading for the strip below rather than a label for the strip
      // above. Neither lands on the 8pt rhythm, hence the literals.
      fill
      style={{ marginTop: first ? 10 : 14 }}>
      <View
        // The tray well is drawn at 14pt in the atlas ("The outfit strip"
        // panel, and both strips in S-05) — tighter than the 20pt `plate`,
        // because this well is nested inside a reply rather than sitting on the
        // page as its own card, and a plate-radius container at 88pt tall reads
        // as a second card competing with the text above it. 4pt gap, 8pt
        // padding and 88pt height are the atlas's own numbers too; the inner
        // tiles' `rounded` is the 8px DEFAULT, which is exactly what the atlas
        // asks for, so it stays a token.
        className="flex-row gap-1 overflow-hidden bg-tray p-2"
        style={{ height: 88, borderRadius: 12 }}>
        {pieces.map((g) => {
          const uri = resolveImage(g.cutoutPath, g.thumbPath);
          return (
            <View
              key={g.id}
              style={{ flexGrow: g.visualWeight, flexShrink: 1, flexBasis: 0 }}
              className="overflow-hidden rounded items-center justify-center">
              {uri ? (
                <Image
                  source={uri}
                  contentFit="cover"
                  transition={150}
                  cachePolicy="memory-disk"
                  style={{ width: '100%', height: '100%' }}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View
                  className="h-full w-full"
                  style={{
                    backgroundColor: g.colors[0] ? oklchToHex(g.colors[0].oklch) : theme.hairline,
                  }}
                />
              )}
            </View>
          );
        })}
      </View>
      {/* 6pt, the atlas's own offset under the strip ("The outfit strip" panel
          and S-05). It is deliberately tighter than the 8pt rhythm unit so the
          caption reads as part of the strip rather than as the next thing in
          the turn — nothing else in the reply sits this close.

 `label`, not `caption`: the atlas sets this line at 13px/1.4 (S-05 and
          the anatomy panel), which is the `label` size, not `caption`'s 11px.
          The size is load-bearing rather than decorative — the anatomy panel
          says this caption "is what the accessibility label reads out, so it
          exists whether or not the photographs resolve", i.e. when the images
          fail this line IS the outfit, and 11px is too small to carry that.

 `faint` (#8A8578) is the atlas's colour here, one step lighter than
          the `label` variant's own `muted`. This is the exception the Text
          variants call out: `faint` is for text genuinely redundant with
          something adjacent, and the four photographs directly above spell out
          the same four garments. It goes on inline as `style`, never a
 `text-faint` className, because the variant already carries a
 `text-muted` and NativeWind gives no precedence between two colour
          utilities on one element. */}
      {/* `note` is `label`'s 13px in the regular cut: the atlas sets no
          font-weight on this caption ("The outfit strip" panel, S-05), and
          medium would make the list of garments compete with the reply it is
          evidence for. Its colour is `muted`, not the atlas's #8A8578 — see the
          contrast note on `eyebrow` in text.tsx: `faint` on canvas is 3.52:1,
          an AA failure, and this caption is the outfit's accessible name. */}
      <Text variant="note" numberOfLines={2} style={{ marginTop: 6 }}>
        {label}
      </Text>
    </PressableSurface>
  );
}

/**
 * The inspiration behind an answer — one compact, attributed reference.
 *
 * Evidence, never the product: the card stays small, the closet answer below
 * it stays dominant, and nothing here borrows Pinterest's grid, red, or
 * controls (the plan's trade-dress rule). The whole card opens the Pin at
 * its source, which is what attribution owes; the image is uncropped within
 * its window and captioned even when it fails to load, so the credit line
 * exists whether or not the picture does.
 */
function PinCard({ pin, first }: { pin: PinReference; first?: boolean }) {
  const theme = useTheme();
  return (
    <PressableSurface
      onPress={() => void Linking.openURL(pin.pinUrl)}
      accessibilityRole="link"
      accessibilityLabel={`Inspiration from Pinterest, board ${pin.boardName}. Opens the original Pin.`}
      fill
      // The first-strip offset (10) for the same reason the outfit strip uses
      // it: the card is part of the reply above, not the next thought.
      style={{ marginTop: first ? 10 : 14 }}
      className="self-start">
      <View
        className="max-w-[85%] flex-row items-center gap-3 rounded-md border border-rule bg-canvas px-3"
        // 44pt floor comes from the image window plus padding; minHeight makes
        // it explicit rather than emergent.
        style={{ minHeight: 44, paddingVertical: 8 }}>
        <View
          className="items-center justify-center overflow-hidden rounded-sm bg-tray"
          style={{ width: 48, height: 64 }}>
          {pin.imageUrl ? (
            <Image
              source={{ uri: pin.imageUrl }}
              style={{ width: 48, height: 64 }}
              contentFit="cover"
              cachePolicy="none"
              accessibilityIgnoresInvertColors
            />
          ) : null}
        </View>
        <View className="flex-1">
          {pin.title ? (
            <Text variant="label" numberOfLines={2}>
              {pin.title}
            </Text>
          ) : null}
          {/* The credit is the card's one non-negotiable line: provider named,
              board named, destination underlined. `muted` because it is a
              caption; underline on the tail because that is the app's quiet
              link grammar (the "Try again" span below uses the same). */}
          <Text variant="note" numberOfLines={1} style={{ marginTop: pin.title ? 2 : 0 }}>
            From Pinterest · {pin.boardName}
          </Text>
          <Text variant="note" className="underline" style={{ color: theme.ink, marginTop: 2 }}>
            Open the original Pin
          </Text>
        </View>
      </View>
    </PressableSurface>
  );
}

export function MessageBubble({
  message,
  resolveImage,
  onPressOutfit,
  onRetry,
  flush = false,
}: {
  message: ChatMessage;
  resolveImage: (...paths: (string | null | undefined)[]) => string | undefined;
  onPressOutfit?: (outfit: OutfitCandidate) => void;
  /** Re-asks a failed turn in place. Rendered only when the turn is retryable. */
  onRetry?: () => void;
  /**
   * Drops this bubble's bottom margin to zero so the caller owns the gap below.
   *
   * This exists for exactly one caller: the questionnaire's CURRENT question,
   * which the atlas puts 12pt above its row of answer chips (S-02, S-03). The
   * chips already carry that 12. React Native has NO margin collapsing — every
   * margin is additive, unlike the web, where the larger of two adjoining
   * margins wins — so the bubble's own 16pt bottom margin does not fold into
   * the chips' 12 the way the atlas's HTML makes it look. It stacks, and the
   * real gap comes out at 28.
   *
   * DO NOT delete this as redundant with the chips' own margin. Removing it
   * silently restores the 28pt gap, which looks merely "a bit loose" rather
   * than broken, so nothing catches it. Every other turn in the transcript
   * leaves it false and keeps the 16 (S-03).
   */
  flush?: boolean;
}) {
  const theme = useTheme();
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      // 18pt below a user bubble, against 16 below a stylist one — the atlas's
      // transcript rhythm (S-03). The asymmetry is the point: the slightly wider
      // gap after your own turn groups each question with the answer that
      // follows it, so a long thread reads as pairs instead of an even ladder.
      // The atlas contradicts itself here — S-04 draws the same bubble at 20 —
      // so S-03 wins, being the only frame that shows the pattern repeating.
      // 18 has no spacing token, hence the inline value. `flush` zeroes it for
      // a caller that is placing the next element itself — see the prop's note.
      <View className="items-end px-gutter" style={{ marginBottom: flush ? 0 : 18 }}>
        <View className="max-w-[85%] bg-ink px-4 py-2.5" style={USER_BUBBLE}>
          {/* NativeWind can't reliably override a Text variant's built-in ink
              colour once another text-* class (the variant's own text-body)
              is present, so canvas-on-ink goes through the theme facade
              instead of a `text-canvas` className — see repo gotcha on
              light-on-dark tiles. */}
          <Text variant="body" style={{ color: theme.canvas }}>
            {message.text}
          </Text>
        </View>
      </View>
    );
  }

  return (
    // 16pt below a stylist turn — see the note on the user branch for why the
    // two sides differ and why S-03 is the frame that settles it. `mb-4` is the
    // token that lands on 16, so this side needs no literal. `flush` drops it
    // entirely for the questionnaire's current question, whose answer chips
    // supply their own 12 — see the prop's note for why the two do not merge.
    <View className={flush ? 'px-gutter' : 'mb-4 px-gutter'}>
      {message.pending ? (
        // The waiting bubble is the same tray bubble with the same tail, just
        // padded to 12/16 instead of 10/16 (S-04) — the extra vertical air
        // stops the spinner from crowding the cap height of the line beside it.
        // The 10pt spinner-to-text gap is the atlas's too (S-04); it is off the
        // 8pt rhythm because the spinner is a 14pt circle with no optical side
        // bearing, so an 8 would sit tighter against the text than the same 8
        // does between two glyph runs.
        <View
          className="max-w-[85%] flex-row items-center self-start bg-tray px-4 py-3"
          style={{ ...STYLIST_BUBBLE, gap: 10 }}>
          <ActivityIndicator size="small" color={theme.muted} />
          <Text variant="label">Looking through your closet…</Text>
        </View>
      ) : (
        <>
          <View
            className="max-w-[85%] self-start bg-tray px-4 py-2.5"
            style={STYLIST_BUBBLE}>
            {/* A failed turn speaks in `muted` rather than `ink` (S-06) — the
                apology is not the stylist's voice, so it steps back a shade.
                It goes on as an inline `style`, not a `text-muted` className,
                because `variant="body"` already carries `text-ink`: NativeWind
                gives no precedence between two colour utilities on one element
                and breaks the tie by key order in tailwind.config.js `colors`.
                It happens to land on `muted` today only because `muted` is
                declared after `ink` there — reorder that object and every
                failed turn silently goes black. Same hazard the variants table
                and button.tsx both warn about; stylist-states.tsx already does
                it this way. */}
            <Text variant="body" style={message.failed ? { color: theme.muted } : undefined}>
              {message.text}
            </Text>
          </View>

          {/* A failed turn that can be re-run offers the run again — the same
              underlined-label grammar as "I'll just type", because both are
              quiet escapes, not celebrations. The muted bubble alone was a
              dead end: the question was gone from the composer and there was
              nothing left to tap. */}
          {message.failed && message.retryable && onRetry ? (
            <PressableSurface
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityHint="Sends the same question again"
              hitSlop={12}
              fill
              contentStyle={{}}
              // 10pt under the bubble (S-06), not the 8 the rhythm token gives.
              // It is the same offset the first outfit strip gets, and for the
              // same reason: this is the one thing the failed turn can still
              // do, so it hangs off the bubble as part of it.
              style={{ marginTop: 10 }}
              className="self-start">
              {/* Ink, not the `label` variant's `muted`. The atlas's span
                  (S-06) sets size, weight and underline but names no colour,
                  so it inherits the document's #1C1A16 — this is the live
                  control on a screen where everything else has gone quiet, and
                  a muted control on a muted bubble is invisible. Inline
 `style` rather than a `text-ink` className because the variant
                  already carries `text-muted`; see the failed-turn note above
                  for why stacking two colour utilities is never safe here. */}
              <Text variant="label" className="underline" style={{ color: theme.ink }}>
                Try again
              </Text>
            </PressableSurface>
          ) : null}

          {message.pin ? <PinCard pin={message.pin} first /> : null}

          {message.outfits.map((outfit, i) => (
            <OutfitStrip
              key={`${message.id}-${i}`}
              outfit={outfit}
              resolveImage={resolveImage}
              onPress={() => onPressOutfit?.(outfit)}
              first={i === 0 && !message.pin}
            />
          ))}

          {message.followUp ? (
            // 14pt, the atlas's offset in S-05 — a wider break than anything
            // inside the answer, because the follow-up is the stylist changing
            // register from reporting to asking, and the italic alone is too
            // quiet to mark that on its own.
            // `note`, not `label`: the atlas sets this line in italic at 13/1.5
            // with no font-weight, and `label`'s medium made the question read
            // heavier than the answer it follows — the opposite of changing
            // register downward into an aside.
            <Text variant="note" className="italic" style={{ marginTop: 14 }}>
              {message.followUp}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}
