import { Canvas, Image as SkiaImage, Shadow, useImage } from '@shopify/react-native-skia';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import {
  GarmentCell,
  STACK_ASPECT,
  platePathOf,
  stackLayout,
  stackRegime,
  type StackedPiece,
} from '@/components/today/garment-cell';
import { VotePill } from '@/components/event-outfits/VotePill';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { boardLeader, type AttendeeBoard, type PostedLook } from '@/features/event-outfits/types';
import type { Garment } from '@/lib/styling';
import { MIN_TAP_TARGET, spring, useTheme } from '@/theme/tokens';

/** Same contact shadow the Today plate casts — one light source app-wide. */
const CONTACT = { dx: 0, dy: 5, blur: 11, color: 'rgba(28,26,22,0.16)' } as const;

const TILE_RADIUS = 10;

/**
 * The YOUR LOOK card's blush treatment (founder-mocks §1b): rose-tinted sand
 * with a hairline rose border. Local literals, not theme tokens — this
 * surface exists on exactly one card in the app, and a token would invite it
 * elsewhere. Derived from accentWarm (#B08A76) over tray.
 *
 * They live here, beside the only component that paints them, rather than in
 * the screen that used to own the card: the card now appears on the event
 * detail page, and two copies of a colour is how a third one starts.
 */
const BLUSH_SURFACE = '#F7EDE8';
const BLUSH_BORDER = 'rgba(176,138,118,0.45)';

type ResolveImage = (...paths: (string | null | undefined)[]) => string | undefined;

/**
 * "Oxblood & Cream" — a look named by its own palette when the poster wrote
 * no caption. Derived from the two heaviest garments' first colours, which
 * are the values the engine actually scored — honest, like every printed
 * number in the app.
 */
export function lookName(garments: Garment[], caption: string | null): string {
  if (caption) return caption;
  const names: string[] = [];
  for (const g of [...garments].sort((a, b) => b.visualWeight - a.visualWeight)) {
    const n = g.colors[0]?.name;
    if (!n) continue;
    const cased = n.charAt(0).toUpperCase() + n.slice(1);
    if (!names.includes(cased)) names.push(cased);
    if (names.length === 2) break;
  }
  return names.length ? names.join(' & ') : 'A look';
}

/** "Navy overshirt, tan boots" — the one-line muted descriptor under a card. */
export function lookDescriptor(garments: Garment[]): string {
  return [...garments]
    .sort((a, b) => b.visualWeight - a.visualWeight)
    .slice(0, 2)
    .map((g) => {
      const colour = g.colors[0]?.name;
      const piece = g.subcategory ?? g.category;
      return colour ? `${colour} ${piece}` : piece;
    })
    .join(', ');
}

/** The look's three key pieces, heaviest first — what the triptych prints. */
export function keyPieces(garments: Garment[], count = 3): Garment[] {
  return [...garments].sort((a, b) => b.visualWeight - a.visualWeight).slice(0, count);
}

/**
 * Initials chip for an attendee. Sand fill, serif initials — the founder
 * mock's avatar grammar (initials on muted circles, never photos).
 */
export function InitialAvatar({ name, size = 28 }: { name: string | null; size?: number }) {
  const theme = useTheme();
  const initials =
    (name ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?';

  return (
    <View
      accessibilityElementsHidden
      className="items-center justify-center rounded-full bg-sand"
      style={{ width: size, height: size }}>
      <Text variant="caption" style={{ color: theme.accent }}>
        {initials}
      </Text>
    </View>
  );
}

/**
 * A row of small garment plates — the founder mock's swatch/triptych unit.
 * Flat plates on tray squares, never raw photos: the cutout (or its honest
 * colour swatch) inside a rounded tray cell, reusing `GarmentCell` so the
 * fallback rules stay identical to Today's.
 */
export function PlateTriptych({
  garments,
  resolveImage,
  cell = 56,
}: {
  garments: Garment[];
  resolveImage: ResolveImage;
  cell?: number;
}) {
  return (
    <View className="flex-row gap-2">
      {keyPieces(garments).map((g) => (
        <View
          key={g.id}
          className="overflow-hidden rounded-md bg-tray"
          style={{ width: cell, height: cell }}>
          <GarmentCell garment={g} uri={resolveImage(g.platePath, g.cutoutPath, g.thumbPath)} />
        </View>
      ))}
    </View>
  );
}

/**
 * The full composed look — the SAME geometry Today's plate prints, because a
 * posted look on the board and the plate she saw this morning must be the
 * same picture. Layout comes from `stackLayout`; this only draws. Static (no
 * landing choreography): the board is a reading surface, and the one bouncy
 * moment on this screen belongs to the crown.
 */
export function LookStack({
  garments,
  resolveImage,
  label,
}: {
  garments: Garment[];
  resolveImage: ResolveImage;
  label: string;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  const regime = useMemo(() => stackRegime(garments, resolveImage), [garments, resolveImage]);
  const layout = useMemo(
    () => (width > 0 ? stackLayout(garments, width, regime) : []),
    [garments, regime, width],
  );

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ width: '100%', aspectRatio: 1 / STACK_ASPECT }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}>
      {regime === 'plate' ? (
        <Canvas style={StyleSheet.absoluteFill}>
          {layout.map((piece) => (
            <PlateStackLayer
              key={piece.garment.id}
              piece={piece}
              uri={resolveImage(platePathOf(piece.garment))}
            />
          ))}
        </Canvas>
      ) : (
        layout.map((piece) => (
          <View
            key={piece.garment.id}
            style={{
              position: 'absolute',
              left: piece.x,
              top: piece.y,
              width: piece.size,
              height: piece.size,
              shadowColor: theme.ink,
              shadowOpacity: 0.16,
              shadowRadius: CONTACT.blur,
              shadowOffset: { width: CONTACT.dx, height: CONTACT.dy },
            }}>
            <View
              className="h-full w-full overflow-hidden border border-hairline"
              style={{ borderRadius: TILE_RADIUS, backgroundColor: theme.tray }}>
              <GarmentCell
                garment={piece.garment}
                uri={resolveImage(piece.garment.cutoutPath, piece.garment.thumbPath)}
              />
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function PlateStackLayer({ piece, uri }: { piece: StackedPiece; uri?: string }) {
  const image = useImage(uri);
  return (
    <SkiaImage
      image={image}
      x={piece.x}
      y={piece.y}
      width={piece.size}
      height={piece.size}
      fit="contain">
      <Shadow dx={CONTACT.dx} dy={CONTACT.dy} blur={CONTACT.blur} color={CONTACT.color} />
    </SkiaImage>
  );
}

/**
 * The crown landing on the winning look — the screen's single `bouncy`
 * spring, per the one-bounce rule: an event, not a texture. accentWarm, not
 * oxblood — celebration, never a call to action.
 */
function Crown() {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    progress.value = withDelay(250, withSpring(1, spring.bouncy));
  }, [progress, reduced]);

  const style = useAnimatedStyle(() => ({
    opacity: Math.min(progress.value * 1.6, 1),
    transform: [{ translateY: (1 - progress.value) * -10 }, { scale: 0.8 + progress.value * 0.2 }],
  }));

  return (
    <Animated.View style={style}>
      <SymbolView name="crown.fill" size={14} tintColor={theme.accentWarm} resizeMode="scaleAspectFit" />
    </Animated.View>
  );
}

/**
 * One posted look on an attendee's board: the composed stack, the colophon
 * (poster + picks, printed quietly the way weather and $/wear are), the
 * caption, and the vote pill. The crown appears only once the board is
 * locked, and only on the pick-leader of THIS board — winners exist per
 * attendee, never across attendees.
 *
 * The ⋯ carries the App Store UGC minimum set on the post itself, not only on
 * its comments (Guideline 1.2: every piece of user content is reportable, and
 * its author blockable). Same grammar as `CommentRow`'s menu — report always,
 * block for someone else's look, retire for the owner or host — because a
 * woman who has learned the ⋯ on a comment should not have to learn a second
 * gesture six inches higher up the same screen.
 */
export function OutfitPostCard({
  look,
  posterName,
  voterNames,
  isMine,
  crowned,
  locked,
  picked,
  votePending,
  resolveImage,
  onToggleVote,
  onReport,
  onBlock,
  onDelete,
  onOpenComments,
  commentCount,
}: {
  look: PostedLook;
  posterName: string | null;
  /** First names of signed picks, for "Picked by Dana, Maria". */
  voterNames: string[];
  isMine: boolean;
  crowned: boolean;
  locked: boolean;
  picked: boolean;
  votePending: boolean;
  resolveImage: ResolveImage;
  onToggleVote: () => void;
  /** Present on someone else's look — you cannot report or block yourself. */
  onReport?: () => void;
  onBlock?: () => void;
  /** Present when the caller may retire this look (owner or host). */
  onDelete?: () => void;
  onOpenComments: () => void;
  commentCount: number;
}) {
  const theme = useTheme();
  const name = lookName(look.garments, look.caption);
  const a11y = `${posterName ?? 'A friend'}'s look: ${lookDescriptor(look.garments)}`;

  const openMenu = () => {
    const buttons: { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }[] = [];
    if (onReport) buttons.push({ text: 'Report', style: 'destructive', onPress: onReport });
    if (onBlock) {
      buttons.push({
        text: posterName ? `Block ${posterName.split(/\s+/)[0]}` : 'Block her',
        style: 'destructive',
        onPress: onBlock,
      });
    }
    if (onDelete) {
      buttons.push({ text: 'Retire this look', style: 'destructive', onPress: onDelete });
    }
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('This look', undefined, buttons);
  };

  const hasMenu = Boolean(onReport || onBlock || onDelete);

  return (
    <View className="rounded-plate border border-rule bg-surface p-4">
      {crowned ? (
        <View className="mb-2 flex-row items-center gap-2">
          <Crown />
          <Text variant="colophon" style={{ color: theme.accentWarm }}>
            The look · Chosen by the table
          </Text>
        </View>
      ) : null}

      <LookStack garments={look.garments} resolveImage={resolveImage} label={a11y} />

      <View className="mt-3 flex-row items-baseline justify-between gap-3">
        <Text variant="plate" numberOfLines={1} className="flex-1">
          {name}
        </Text>
        {hasMenu ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Look options"
            accessibilityHint="Report this look, block its author, or retire it"
            hitSlop={10}
            onPress={openMenu}
            style={{ minHeight: MIN_TAP_TARGET - 20, justifyContent: 'center' }}
            className="active:opacity-60">
            <SymbolView
              name="ellipsis"
              size={14}
              tintColor={theme.faint}
              resizeMode="scaleAspectFit"
            />
          </Pressable>
        ) : null}
      </View>

      <Text variant="caption" numberOfLines={1} className="mt-1">
        {lookDescriptor(look.garments)}
      </Text>

      <View className="mt-3 flex-row items-center justify-between gap-3 border-t border-rule pt-3">
        <VotePill
          votes={look.votes}
          picked={picked}
          mine={isMine}
          locked={locked}
          pending={votePending}
          onToggle={onToggleVote}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            commentCount > 0 ? `Comments, ${commentCount}` : 'Comment on this look'
          }
          onPress={onOpenComments}
          hitSlop={8}
          style={{ minHeight: MIN_TAP_TARGET - 12 }}
          className="flex-row items-center gap-1.5 active:opacity-60">
          <SymbolView name="text.bubble" size={14} tintColor={theme.muted} resizeMode="scaleAspectFit" />
          <Text variant="label">{commentCount > 0 ? String(commentCount) : 'Comment'}</Text>
        </Pressable>
      </View>

      {voterNames.length > 0 ? (
        // Signed picks, printed as social warmth — "Dana picked this one".
        <Text variant="caption" numberOfLines={1} className="mt-2">
          Picked by {voterNames.join(', ')}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The WHO'S WEARING WHAT grid cell: triptych of the look's three key pieces
 * as flat plates, the attendee's initial-avatar + first name, one muted
 * descriptor line. A summary, not a poll — voting happens on the boards
 * below the fold, so this card carries no counts and no controls beyond
 * navigation.
 */
export function AttendeeLookCard({
  look,
  attendeeName,
  resolveImage,
  onPress,
}: {
  look: PostedLook;
  attendeeName: string | null;
  resolveImage: ResolveImage;
  onPress: () => void;
}) {
  const firstName = attendeeName?.split(/\s+/)[0] ?? 'Friend';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${firstName}'s look: ${lookDescriptor(look.garments)}`}
      onPress={onPress}
      className="rounded-plate border border-hairline bg-surface p-3 active:opacity-70">
      <View className="flex-row gap-1.5">
        {keyPieces(look.garments).map((g) => (
          <View key={g.id} className="aspect-square flex-1 overflow-hidden rounded-sm bg-tray">
            <GarmentCell garment={g} uri={resolveImage(g.platePath, g.cutoutPath, g.thumbPath)} />
          </View>
        ))}
      </View>
      <View className="mt-2.5 flex-row items-center gap-2">
        <InitialAvatar name={attendeeName} size={24} />
        <Text variant="label" numberOfLines={1} className="flex-1 text-ink">
          {firstName}
        </Text>
      </View>
      <Text variant="caption" numberOfLines={1} className="mt-1">
        {lookDescriptor(look.garments)}
      </Text>
    </Pressable>
  );
}

/**
 * YOUR LOOK — the viewer's own board, blush-set (founder-mocks §1b).
 *
 * The mock draws the three swatches *beside* the look name; they are stacked
 * above it here because at gutter width the serif name has ~140px left over
 * next to a triptych, which wraps "Oxblood & Cream" onto two lines on every
 * phone narrower than a Pro Max. Same parts, same order, one row down.
 *
 * Presentational on purpose: it takes the leading look and two callbacks, so
 * the event detail page and the board page can both print it without either
 * one owning the other's queries.
 */
export function YourLookCard({
  leading,
  resolveImage,
  locked,
  onSwap,
  onShare,
}: {
  /** The viewer's pick-leading look, or null when she has shared nothing. */
  leading: PostedLook | null;
  resolveImage: ResolveImage;
  /** Board locked (the evening started): the card is a record, not a control. */
  locked: boolean;
  onSwap: () => void;
  onShare: () => void;
}) {
  const theme = useTheme();

  return (
    <View
      className="rounded-plate p-4"
      style={{ backgroundColor: BLUSH_SURFACE, borderColor: BLUSH_BORDER, borderWidth: 1 }}>
      <Text variant="colophon" style={{ color: theme.accent }}>
        Your look
      </Text>

      {leading ? (
        <>
          <View className="mt-3">
            <PlateTriptych garments={leading.garments} resolveImage={resolveImage} cell={52} />
          </View>
          <Text variant="plate" numberOfLines={1} className="mt-3">
            {lookName(leading.garments, leading.caption)}
          </Text>
          <Text variant="label" numberOfLines={1} className="mt-1">
            {lookDescriptor(leading.garments)}
          </Text>
          {leading.votes > 0 ? (
            // The one number on this card, printed the way $/wear and weather
            // are: quiet, and only when it is true.
            <Text variant="colophon" className="mt-2">
              {leading.votes === 1 ? '1 pick from the table' : `${leading.votes} picks from the table`}
            </Text>
          ) : null}
        </>
      ) : (
        <Text variant="callout" className="mt-3 text-muted">
          Nothing shared yet — pick a look from your closet and let the table
          weigh in.
        </Text>
      )}

      {!locked ? (
        <View className="mt-4 flex-row gap-2">
          {leading ? (
            <Button title="Swap a piece" variant="secondary" haptic onPress={onSwap} className="flex-1" />
          ) : null}
          <Button
            title={leading ? 'Share another' : 'Share with group'}
            variant="secondary"
            haptic
            onPress={onShare}
            className="flex-1"
          />
        </View>
      ) : null}
    </View>
  );
}

/**
 * WHO'S WEARING WHAT — the two-column grid of every attendee's leading look
 * (founder-mocks §1b). Order is the caller's (self first, then roster); this
 * only prints, and it prints nothing at all for an attendee whose board is
 * somehow empty rather than drawing a hole in the grid.
 */
export function AttendeeLookGrid({
  boards,
  nameOf,
  resolveImage,
  onOpen,
}: {
  boards: AttendeeBoard[];
  nameOf: (userId: string) => string | null;
  resolveImage: ResolveImage;
  onOpen: (look: PostedLook) => void;
}) {
  return (
    <View className="-mx-1.5 flex-row flex-wrap">
      {boards.map((board) => {
        const leading = boardLeader(board.looks) ?? board.looks[0];
        if (!leading) return null;
        return (
          <View key={board.userId} className="w-1/2 p-1.5">
            <AttendeeLookCard
              look={leading}
              attendeeName={nameOf(board.userId)}
              resolveImage={resolveImage}
              onPress={() => onOpen(leading)}
            />
          </View>
        );
      })}
    </View>
  );
}

/** "three" for 3 — small counts read as words in the stylist's voice. */
const COUNT_WORDS = ['', '', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'] as const;
const countWord = (n: number): string => COUNT_WORDS[n] ?? String(n);

/** The heaviest garment of a look — the piece that decides what it reads as. */
function anchorOf(look: PostedLook): Garment | null {
  return [...look.garments].sort((a, b) => b.visualWeight - a.visualWeight)[0] ?? null;
}

/**
 * The stylist's group note (field guide 05b, the tray-filled line under the
 * grid): one sentence about what the table is converging on, and where the
 * viewer sits inside it.
 *
 * Computed, never authored. The convergence is the hue FAMILY of each
 * attendee's leading look's heaviest garment — family, not colour name, so
 * "ecru" and "cream" count as the same room — and the colour it names is the
 * commonest name inside that family. The viewer's difference is her own
 * heaviest piece outside it.
 *
 * Returns null whenever there is nothing true to say: fewer than two boards,
 * no colours on file, or no family shared by at least two attendees. An
 * invented pattern would be the one lie on a screen whose whole promise is
 * that the numbers are real.
 */
export function groupStyleNote(boards: AttendeeBoard[], me: string | null): string | null {
  type Entry = { userId: string; family: string; colour: string; look: PostedLook };

  const entries: Entry[] = [];
  for (const board of boards) {
    const look = boardLeader(board.looks) ?? board.looks[0];
    const anchor = look ? anchorOf(look) : null;
    const colour = anchor?.colors[0];
    if (!look || !colour?.family || !colour.name) continue;
    entries.push({ userId: board.userId, family: colour.family, colour: colour.name, look });
  }
  if (entries.length < 2) return null;

  const byFamily = new Map<string, Entry[]>();
  for (const e of entries) byFamily.set(e.family, [...(byFamily.get(e.family) ?? []), e]);

  const [family, group] = [...byFamily.entries()].sort((a, b) => b[1].length - a[1].length)[0]!;
  if (group.length < 2) return null;

  // The commonest colour NAME inside the shared family is what to call it.
  const nameCounts = new Map<string, number>();
  for (const e of group) nameCounts.set(e.colour, (nameCounts.get(e.colour) ?? 0) + 1);
  const colour = [...nameCounts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
  const count = countWord(group.length);

  const mine = me ? entries.find((e) => e.userId === me) : undefined;

  if (mine && mine.family === family) {
    const contrast = [...mine.look.garments]
      .sort((a, b) => b.visualWeight - a.visualWeight)
      .find((g) => g.colors[0]?.family && g.colors[0].family !== family);
    const piece = contrast?.subcategory ?? contrast?.category;
    const contrastColour = contrast?.colors[0]?.name;
    return contrastColour && piece
      ? `${count} of you are in ${colour}. Yours reads differently with the ${contrastColour} ${piece}.`
      : `${count} of you are in ${colour} — yours will read as part of the set.`;
  }

  if (mine) {
    return `${count} of them are in ${colour}. Yours is the ${mine.colour} in the room.`;
  }

  return `${count} of them are already in ${colour} — worth knowing before you pick.`;
}
