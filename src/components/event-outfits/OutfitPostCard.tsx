import { Canvas, Image as SkiaImage, Shadow, useImage } from '@shopify/react-native-skia';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { ActionSheetIOS, Pressable, StyleSheet, Text as RNText, View } from 'react-native';

import {
  GarmentCell,
  STACK_ASPECT,
  platePathOf,
  stackLayout,
  stackRegime,
  type StackedPiece,
} from '@/components/today/garment-cell';
import { AddYoursPill, VotePill } from '@/components/event-outfits/VotePill';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { PickLine } from '@/features/event-outfits/board-logic';
import { voteCountLine } from '@/features/event-outfits/board-copy';
import { lookCells } from '@/features/event-outfits/look-layout';
import { boardLeader, type AttendeeBoard, type PostedLook } from '@/features/event-outfits/types';
import { lookDescriptor, lookName } from '@/features/events/look-copy';
import type { Garment } from '@/lib/styling';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/** Same contact shadow the Today plate casts — one light source app-wide. */
const CONTACT = { dx: 0, dy: 5, blur: 11, color: 'rgba(28,26,22,0.16)' } as const;

const TILE_RADIUS = 12;

type ResolveImage = (...paths: (string | null | undefined)[]) => string | undefined;

/**
 * "Oxblood & Cream" — a look named by its own palette when the poster wrote
 * no caption. Derived from the two heaviest garments' first colours, which
 * are the values the engine actually scored — honest, like every printed
 * number in the app.
 */
/**
 * A look's title and its one-line descriptor.
 *
 * Re-exported, not defined. An identical copy of both lived here and in
 * `features/events/look-copy.ts` after two units built the same thing — the
 * board, the comments header and the comments sheet read this one, the event
 * page read that one, and nothing forced them to agree. They happened to be
 * identical on the day they merged, which is the most dangerous version of
 * this bug: the drift would have shown up later as one look carrying two
 * different names depending on which screen you opened it from.
 */
export { lookDescriptor, lookName } from '@/features/events/look-copy';

/** The look's three key pieces, heaviest first — what the triptych prints. */
export function keyPieces(garments: Garment[], count = 3): Garment[] {
  return [...garments].sort((a, b) => b.visualWeight - a.visualWeight).slice(0, count);
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
 * posted look on the board and the plate seen this morning must be the same
 * picture. Layout comes from `stackLayout`; this only draws. Static (no
 * landing choreography): the board is a reading surface, and the one animated
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
 * THE CROWN IS GONE (D-2b). `LeaderBadge` — a blush pill with `crown.fill` in
 * it, drawn on the locked board's favourite — lived here until the founder
 * resolved the conflict in favour of the finalized atlas, which crowns nothing.
 * It went with `favouriteId` and the board's sticky-tie state, because each of
 * the three existed only for the other two.
 *
 * What is left is `Ahead`: 13 pt regular secondary text, computed from the
 * counts, present only while a look genuinely leads and only before the lock.
 * Audit 96 asked for exactly that and said what it must not be — "neither is a
 * bar, a badge or a percentage" — and with the pill gone there is nothing on a
 * card that could be mistaken for one.
 */

/**
 * Audit 95 — "tiles at 74 pt so all four garments stay visible."
 *
 * A row of fixed 74 pt tiles rather than the full-width `LookPlate` the card
 * used to open with. Two reasons, both in the audit:
 *
 * · "Every garment in a look stays visible." A plate scaled to the card width
 *   is as tall as the card is wide, which is what pushed the caption into a
 *   clamp; a 74 pt row is a known, small height, so the caption above it can
 *   take as many lines as it needs and the card still fits the rail.
 * · The measurement is FIXED, not a fraction of the card. Six 74 pt tiles wrap
 *   to a second row rather than shrinking to fit, because shrinking is how the
 *   sixth garment stops being visible — the same rule `lookCells` already
 *   holds when it collapses a seventh piece into a counted cell instead of
 *   making all six smaller.
 */
const BOARD_TILE = 74;

function BoardLookTiles({
  pieces,
  resolveImage,
}: {
  pieces: readonly Garment[];
  resolveImage: ResolveImage;
}) {
  const theme = useTheme();
  return (
    <View className="flex-row flex-wrap" style={{ gap: 6 }}>
      {lookCells(pieces).map((cell, i) =>
        cell.kind === 'garment' ? (
          <View
            key={cell.garment.id}
            className="overflow-hidden rounded-md bg-tray"
            style={{ width: BOARD_TILE, height: BOARD_TILE }}>
            <GarmentCell
              garment={cell.garment}
              uri={resolveImage(
                cell.garment.platePath,
                cell.garment.cutoutPath,
                cell.garment.thumbPath,
              )}
            />
          </View>
        ) : (
          // The counted cell — sand ground with type in it, which is what
          // stops it reading as a photograph that failed to load (audit 98's
          // rule, borrowed here because the failure mode is identical).
          <View
            key={`more-${i}`}
            className="items-center justify-center rounded-md"
            style={{ width: BOARD_TILE, height: BOARD_TILE, backgroundColor: theme.sand }}>
            <Text variant="label" className="font-medium text-ink">
              {`+${cell.count}`}
            </Text>
          </View>
        ),
      )}
    </View>
  );
}

/**
 * One posted look on the board: the poster (`LookPlate` — see the contract's
 * "one object, four sizes", the reason `stackLayout` is gone from here),
 * whose look it is, the caption, the vote pill, comments and the voter line.
 * Order follows the atlas exactly: "Poster on top, then whose look it is,
 * then the caption, then the stack" — the person is named before the clothes
 * so a vote is never cast blind.
 *
 * `badge` is computed by the caller across the WHOLE board, never per poster — see
 * `board-logic.ts`'s header for why this board is one rail, not one per
 * attendee.
 *
 * The ⋯ carries the App Store UGC minimum set on the post itself, not only on
 * its comments (Guideline 1.2: every piece of user content is reportable, and
 * its author blockable) — L-04's two menus, someone else's look vs your own.
 */
export function OutfitPostCard({
  look,
  posterName,
  pickLine: line,
  isMine,
  badge,
  locked,
  picked,
  votePending,
  voteFailed,
  resolveImage,
  onToggleVote,
  onRetryVote,
  onReport,
  onBlock,
  onShare,
  onShareAnother,
  onDelete,
  onOpenComments,
  commentCount,
  width,
  onAddYours,
}: {
  look: PostedLook;
  posterName: string | null;
  /** Full signed-pick names, "you" carried apart — `null` prints no line at all. */
  pickLine: PickLine | null;
  isMine: boolean;
  /** The board's one leading look — never computed per poster. */
  /** `'ahead'` while one look genuinely leads an open board. Never a crown. */
  badge: 'ahead' | null;
  locked: boolean;
  picked: boolean;
  votePending: boolean;
  /** The last cast/move on THIS look was refused. */
  voteFailed?: boolean;
  resolveImage: ResolveImage;
  onToggleVote: () => void;
  onRetryVote?: () => void;
  /** Present on someone else's look — you cannot report or block yourself. */
  onReport?: () => void;
  onBlock?: () => void;
  /** Present on someone else's look. */
  onShare?: () => void;
  /** Present on your own look, when another option can still be shared. */
  onShareAnother?: () => void;
  /** Present when the caller may retire this look (owner or host). */
  onDelete?: () => void;
  onOpenComments: () => void;
  commentCount: number;
  /** The card's own width — the poster (`LookPlate`) draws at exactly this. */
  width: number;
  /**
   * L-06's one-look board: "the Vote pill is replaced by `Add yours`... a
   * vote against nothing is not a vote." Present only when this is the only
   * look on the whole board, whoever posted it — replaces the pill entirely.
   */
  onAddYours?: () => void;
}) {
  const theme = useTheme();
  const name = lookName(look.garments, look.caption);
  const a11y = `${posterName ?? 'A friend'}'s look: ${lookDescriptor(look.garments)}`;
  const firstName = posterName?.split(/\s+/)[0];

  /**
   * The overflow, as an action sheet rather than an `Alert` with buttons in
   * it — L-04. Two exclusive menus: someone else's look offers Share/Report/
   * Block; your own offers Share another/Take it off. A host holding both
   * `onDelete` and `onReport/onBlock` (someone else's look, moderated) gets
   * the union of the two.
   */
  const openMenu = () => {
    const actions: { label: string; destructive: boolean; run: () => void }[] = [];
    if (onShare) actions.push({ label: 'Share this look', destructive: false, run: onShare });
    if (onShareAnother) {
      actions.push({ label: 'Share another option', destructive: false, run: onShareAnother });
    }
    if (onReport) actions.push({ label: 'Report this look', destructive: true, run: onReport });
    if (onBlock) {
      actions.push({
        label: firstName ? `Block ${firstName}` : 'Block this person',
        destructive: true,
        run: onBlock,
      });
    }
    if (onDelete) {
      actions.push({
        label: isMine ? 'Take it off the board' : 'Retire this look',
        destructive: true,
        run: onDelete,
      });
    }
    if (actions.length === 0) return;

    // One destructive index is all iOS will tint. Every row here ends
    // something, so the tint goes to the one that ends the most: retiring
    // the look outright when it is on offer, then block, then report —
    // pushed in that order above, so the last destructive row wins.
    const destructiveLabel = [...actions].reverse().find((a) => a.destructive)?.label;

    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'This look',
        options: [...actions.map((a) => a.label), 'Cancel'],
        cancelButtonIndex: actions.length,
        destructiveButtonIndex: actions.findIndex((a) => a.label === destructiveLabel),
      },
      (index) => actions[index]?.run(),
    );
  };

  const hasMenu = Boolean(onShare || onShareAnother || onReport || onBlock || onDelete);

  /**
   * "Blush is spent twice and both times means chosen — the hairline on the
   * card you picked, and the crown pill. When they land on the same card,
   * only the crown keeps the fill." (contract §2) — a rule about a collision
   * that can no longer happen, since the crown is gone (D-2b) and `Ahead` is
   * plain text rather than a filled pill. The blush hairline is now simply the
   * caller's own pick, with nothing left to yield to.
   */
  const cardBorder = picked ? theme.blushRule : theme.hairline;

  const countLine = voteCountLine(line?.count ?? look.votes);

  return (
    <View
      className="overflow-hidden rounded-plate bg-surface"
      style={{ borderWidth: 1, borderColor: cardBorder }}
      // The label was computed and never attached, so the card announced its
      // children one by one and never said whose look it was — the single fact
      // the atlas insists comes before the clothes ("the person is named before
      // the clothes so a vote is never cast blind").
      accessible
      accessibilityLabel={a11y}>
      {/*
        ── Audit 95: the caption gets its height BEFORE the image does ────────

        The type block used to sit UNDER a full-width `LookPlate`, which is the
        arrangement that produces the defect the audit names: the image takes
        the card's height first and whatever is left has to hold a caption, so
        a three-line caption gets `numberOfLines` clamped onto it and the last
        third of somebody's sentence is thrown away. Reversing the order fixes
        it structurally rather than by picking a bigger clamp — the text lays
        out at its natural height and the tiles take the remainder.

        Every `numberOfLines` in this block is gone with it. "No caption is
        truncated" is audit 95's acceptance criterion, and a clamp is exactly
        how a caption gets truncated.
      */}
      <View className="p-4 pb-3">
        <View className="flex-row items-start gap-2">
          <Text variant="plate" trim className="flex-1">
            {name}
          </Text>
          {hasMenu ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Look options"
              accessibilityHint="Share, report, block or retire this look"
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

        {/*
          Audit 96 — "Ahead is 13 pt regular SECONDARY TEXT, computed from the
          counts and present only while a look genuinely leads; neither is a
          bar, a badge or a percentage."

          So the leader carries a word rather than the blush crown pill it used
          to, and the LOCKED board carries nothing at all: the atlas removes the
          crown entirely and D-2b resolved that conflict in the atlas's favour.
          Nothing is crowned at any point, which is what audit 96 asked for.
        */}
        {badge === 'ahead' ? (
          <Text variant="note" className="mt-1.5">
            Ahead
          </Text>
        ) : null}

        {/*
          Correction 24 — "each card names whose look it is. That single 13 pt
          line is what turns two options into a shared rail."

          It was an avatar-plus-name row above the title; it is now a plain
          line under it, in the reading order the atlas draws (caption, ahead,
          owner, prose).
        */}
        <Text variant="note" className="mt-1.5">
          {isMine ? 'You' : (posterName ?? 'A friend')}
        </Text>

        {/*
          The line under the owner, and never the title again.

          `lookName` returns the caption when there is one — `event_posts` has a
          caption column and no title column — so printing `look.caption` here
          unconditionally rendered the same sentence twice, once truncated as a
          heading and once in full beneath it. The atlas draws a name and then a
          different line under it ("The Long Cognac" / "Shearling over the linen
          blouse"). Until a post can carry both, the second line is what the
          garments say: the caption when the title did not already consume it,
          the descriptor otherwise.
        */}
        <Text variant="caption" className="mt-2">
          {look.caption && name !== look.caption ? look.caption : lookDescriptor(look.garments)}
        </Text>
      </View>

      <View style={{ position: 'relative' }} className="px-4">
        <BoardLookTiles pieces={look.garments} resolveImage={resolveImage} />
      </View>

      <View className="p-4 pt-3">
        <View className="flex-row items-center justify-between gap-2 border-t border-rule pt-3">
          {onAddYours ? (
            <AddYoursPill onPress={onAddYours} />
          ) : (
            <VotePill
              votes={look.votes}
              picked={picked}
              mine={isMine}
              locked={locked}
              pending={votePending}
              failed={voteFailed}
              onToggle={onToggleVote}
              onRetry={onRetryVote}
            />
          )}
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
            {commentCount > 0 ? <Text variant="label">{commentCount}</Text> : null}
          </Pressable>
        </View>

        {/*
          Audit 96 — "zero counts are omitted entirely: a look with no picks
          prints no count line at all, never '0 picks'." `voteCountLine`
          returns null at zero and this block is absent for it.

          The VOTER NAMES are gone. `pickLine()` in `board-logic.ts` still
          builds them and still has its callers elsewhere; what changed is that
          the board no longer prints them. LB-01 and LB-02 draw a bare "3
          votes" on every card, and a rail that prints who voted for which
          friend's clothes turns a vote into a public statement about somebody
          else's outfit — which is the thing this whole group's privacy rules
          are consistently about. `line.iVoted` still earns the blush "Your
          vote" beside the pill; it no longer earns a list of names.
        */}
        {countLine ? (
          <Text variant="note" className="mt-2.5">
            {countLine}
            {line?.iVoted ? (
              <RNText style={{ color: theme.accent, fontWeight: '500' }}>{' · Your vote'}</RNText>
            ) : null}
          </Text>
        ) : null}
      </View>
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
        <Avatar name={attendeeName} size={24} tone="accent" />
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
  /** The viewer's pick-leading look, or null when they have shared nothing. */
  leading: PostedLook | null;
  resolveImage: ResolveImage;
  /** Board locked (the evening started): the card is a record, not a control. */
  locked: boolean;
  onSwap: () => void;
  onShare: () => void;
}) {
  const theme = useTheme();

  return (
    // `theme.blush` / `theme.blushRule` — the two tokens that exist for exactly
    // this card (tokens.ts: "one blush card per screen"). They carry the same
    // values the local literals here used to, so this is a rename, not a
    // repaint; what it buys is that the next surface tempted by rose-tinted
    // sand has to reach for a documented token and read its rule first.
    <View
      className="rounded-plate p-4"
      style={{ backgroundColor: theme.blush, borderColor: theme.blushRule, borderWidth: 1 }}>
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
        // N-09's empty card: a serif line, a sentence, and one thing to do.
        //
        // The atlas writes that sentence as "Cinch can pull three from your
        // closet that read cocktail and hold up outdoors at 75°." It does not
        // ship, and the reason is not effort: picking a look for an occasion
        // is choosing from outfits already saved (see `./post`), with no
        // ranking by dress code and no reading of the venue's weather. A card
        // that offers to do both would be the app promising a feature the
        // button underneath cannot deliver. The geometry is the atlas's; the
        // claim is the one the app can actually keep.
        <>
          <Text variant="plate" className="mt-3">
            Nothing picked yet
          </Text>
          <Text variant="callout" className="mt-2 text-muted">
            Pick a look from your closet and let the table weigh in.
          </Text>
        </>
      )}

      {!locked ? (
        <View className="mt-4 flex-row gap-2">
          {leading ? (
            <Button title="Swap a piece" variant="secondary" haptic onPress={onSwap} className="flex-1" />
          ) : null}
          <Button
            title={leading ? 'Share another' : 'Pick a look'}
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
 * commonest name inside that family. The viewer's difference is their own
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
