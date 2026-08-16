import { Link, type Href } from 'expo-router';
import { memo, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { GarmentWell } from '@/components/social/garment-well';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { profileName, type SocialProfile } from '@/features/social-graph/types';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

import { FALLBACK_GLYPH_INK, HangerGlyph } from './glyphs';
import type { NewAddition } from './queries';
import { sinceLabel } from './timeline';

/** The plate well's side. Big enough to read a garment, small enough to list. */
const PLATE = 76;

/**
 * The attribution line's tracking. The colophon token carries 1.4 for the
 * plate data lines; the Lately atlas sets its elapsed marks and swatch
 * captions a shade tighter, at 1.2.
 */
const ATTRIBUTION_TRACKING = 1.2;

/**
 * Legibility flip for the fallback swatch's caption — the same relative-luminance
 * call `plate-thumb.tsx` makes, and deliberately the same constants: two
 * different answers to "is this swatch dark?" in one app is how a caption ends
 * up invisible on exactly one screen.
 */
function isDarkHex(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  if (Number.isNaN(n)) return false;
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.55;
}

export type NewAdditionRowProps = {
  entry: NewAddition;
  /** The owner's identity. Null for the caller's own pieces, and when a profile won't resolve. */
  owner: SocialProfile | null;
  /** Signed URL for the plate — storage paths are not URLs. */
  imageUri?: string;
  onPress?: (entry: NewAddition) => void;
  /**
   * UX-09 — where the row goes, as a route rather than a callback, which is
   * what `Link.Preview` needs in order to render the destination. When set, the
   * tap is the Link's; `onPress` is ignored. Fixtures and any caller without a
   * route keep the plain Pressable, so this component never depends on a
   * navigator to render.
   */
  href?: Href;
  /** `Link.MenuAction` elements. Only meaningful alongside `href`. */
  menu?: ReactNode;
  isLast?: boolean;
};

/**
 * One lately-added garment, set as a catalogue line.
 *
 * The composition is the field guide's plate-and-caption, turned on its side:
 * the garment in its recessed tray well on the left, and to the right the
 * spec-line stack a printed lookbook puts under a photograph — piece, colour
 * and label, then whose it is and when it arrived. It is explicitly not a
 * social-feed cell: no counts, no likes, no square photo grid. The design
 * direction's first rule is that this app is "not a dashboard, not a feed, not
 * a shop", and Explore is the screen most likely to forget it.
 *
 * The garment data here is only ever what `friend_items` publishes — no price,
 * no wear count, no original photograph — so, as with `FriendItemCard`, this
 * component could not leak those columns if it tried.
 */
function NewAdditionRowComponent({
  entry,
  owner,
  imageUri,
  onPress,
  href,
  menu,
  isLast,
}: NewAdditionRowProps) {
  const theme = useTheme();
  const { item, isSelf } = entry;

  // Capitalized to the approved frames' register ("Skirt", not "skirt") —
  // the same rule as the Today plate's labelFor and the Plan day rows.
  const rawPiece = item.subcategory ?? item.category;
  const piece = rawPiece.charAt(0).toUpperCase() + rawPiece.slice(1);
  const spec = [item.colors[0]?.name, item.brand].filter(Boolean).join(' · ');
  const who = isSelf ? 'You' : owner ? profileName(owner) : 'A friend';
  const when = sinceLabel(item.createdAt);
  const swatch = item.colors[0]?.hex ?? null;

  const interactive = Boolean(href || onPress);

  /**
   * UX-06 — what the well shows when there is no photograph, in preference
   * order. The colour swatch first, because the tagger's answer is a fact about
   * the garment and a mark is not; the hanger only when even that is unknown.
   * Both are drawn at the well's full size, so a decode failure is the same
   * square as a success.
   */
  const fallback = swatch ? (
    // No render, but the tagger knew the colour — print the colour. An honest
    // swatch beats a broken-image glyph.
    <View
      className="h-full w-full items-center justify-center px-1"
      style={{ backgroundColor: swatch }}>
      <Text
        variant="colophon"
        numberOfLines={2}
        className="text-center"
        style={{
          letterSpacing: ATTRIBUTION_TRACKING,
          color: isDarkHex(swatch) ? '#FFFFFFCC' : '#1C1A16AA',
        }}>
        {piece}
      </Text>
    </View>
  ) : (
    // The coat hanger, not an SF tshirt: the atlas's own garment mark, so an
    // unrendered piece reads as "closet piece", not "missing image".
    <HangerGlyph size={24} color={FALLBACK_GLYPH_INK} />
  );

  const row = (
    <Pressable
      accessibilityRole={interactive ? 'button' : 'text'}
      accessibilityLabel={[piece, spec, `added by ${who}`, when].filter(Boolean).join(', ')}
      accessibilityHint={
        interactive ? (isSelf ? 'Open this piece' : `Open ${who}’s closet`) : undefined
      }
      onPress={onPress ? () => onPress(entry) : undefined}
      disabled={!interactive}
      style={{ minHeight: MIN_TAP_TARGET }}
      className={[
 'flex-row items-center gap-3.5 px-4 py-3.5 active:opacity-60',
        isLast ? '' : 'border-b border-hairline',
      ].join(' ')}>
      {/* The well. `contain`, never `cover`: a cutout that has been scale-
          normalised by the ingest pipeline must not be cropped back out of
          true. */}
      <View
        style={{ width: PLATE, height: PLATE }}
        className="items-center justify-center overflow-hidden rounded-lg bg-tray">
        <GarmentWell
          imageUri={imageUri}
          recyclingKey={item.id}
          contentFit="contain"
          fallback={fallback}
          style={{ width: '100%', height: '100%' }}
        />
      </View>

      <View className="flex-1">
        {/* The atlas's spec-line sizes, not the app scale: 15 for the piece,
            12 for the colour-and-label line. A catalogue line is set smaller
            than prose. */}
        <Text variant="body" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>
          {piece}
        </Text>
        {spec ? (
          <Text
            variant="caption"
            numberOfLines={1}
            className="mt-0.5"
            // Inline, not a `text-*` class: the caption variant carries its
            // own colour utility and NativeWind gives no precedence between
            // two of them on one element.
            style={{ fontSize: 12, lineHeight: 16, color: theme.faint }}>
            {spec}
          </Text>
        ) : null}

        <View className="mt-2 flex-row items-center gap-2">
          {/* "ME" reversed on ink, per the atlas — your own chip is the one
              dark mark on the line; a friend's stays the quiet sand disc. */}
          <Avatar
            name={isSelf ? null : (owner?.displayName ?? owner?.username)}
            imageUri={isSelf ? null : owner?.avatarUrl}
            size={22}
            tone={isSelf ? 'ink' : 'sand'}
            fallback={isSelf ? 'ME' : '?'}
          />
          <Text
            variant="caption"
            numberOfLines={1}
            className="flex-1"
            style={{ fontSize: 12, lineHeight: 16, color: theme.byline }}>
            {who}
          </Text>
          {when ? (
            <Text
              variant="colophon"
              style={{ letterSpacing: ATTRIBUTION_TRACKING, color: theme.byline }}>
              {when}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );

  if (!href) return row;

  /**
   * UX-09 — the native accelerator, wrapped around the row that already works.
   *
   * `asChild` so the Link does not wrap the row in a `<Text>`; `Link.Trigger`
   * so the preview machinery knows which element is the source. Off iOS, and
   * inside a preview, `expo-router` drops `Link.Preview`/`Link.Menu` and renders
   * the trigger through the ordinary link — so the visible fallback is not
   * something this file has to arrange, it is the only thing that was ever
   * there. `Link.Preview` with no children previews the `href` itself, which is
   * the friend's closet: the destination, not a mock-up of it.
   */
  return (
    <Link href={href} asChild>
      <Link.Trigger>{row}</Link.Trigger>
      <Link.Preview />
      {menu ? <Link.Menu>{menu}</Link.Menu> : null}
    </Link>
  );
}

/** A circle's worth of additions can be long; same memo as the closet grids. */
export const NewAdditionRow = memo(NewAdditionRowComponent);

// Widths vary so a column of bars reads as lines about to arrive rather than
// as a loading graphic — the reasoning `skeleton.tsx` already applies to lists.
const BAR_WIDTHS = ['58%', '72%', '46%', '64%'] as const;

/**
 * The timeline, before it has a timeline.
 *
 * `ListSkeleton` is the wrong shape here — its rows are a 32pt disc and two
 * bars, and this row is a 76pt square well and three lines. A skeleton whose
 * geometry differs from what replaces it makes the page jump when the data
 * lands, which reads as a bug rather than as content arriving.
 */
export function NewAdditionsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View accessibilityLabel="Reading your circle">
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          className={[
 'flex-row items-center gap-3.5 px-4 py-3.5',
            i === count - 1 ? '' : 'border-b border-hairline',
          ].join(' ')}>
          {/* 120ms per row, per the atlas — the card reads as lines arriving
              in order rather than one graphic pulsing. */}
          <Skeleton style={{ width: PLATE, height: PLATE }} className="rounded-lg" delay={i * 120} />
          <View className="flex-1 gap-2">
            <Skeleton
              className="h-3.5 rounded-chip"
              style={{ width: BAR_WIDTHS[i % BAR_WIDTHS.length] }}
              delay={i * 120}
            />
            <Skeleton className="h-2.5 w-1/3 rounded-chip" delay={i * 120} />
            <Skeleton className="mt-1 h-5 w-2/5 rounded-chip" delay={i * 120} />
          </View>
        </View>
      ))}
    </View>
  );
}
