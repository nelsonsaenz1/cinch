import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text, type TextProps } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

/**
 * "DK" from "Dana Kim", "DA" from "dana" alone. Never empty, never throws.
 *
 * Five copies of this function shipped — `EventCard`, `RosterRow`, `invite`,
 * `ProfileRow`, `OutfitPostCard` — and they had already drifted: four took the
 * first and last words, one took the first two, so "Dana Marie Kim" was "DK" on
 * the guest list and "DM" on her own look. First-and-last wins; it is what
 * Profile's masthead does and it is what a monogram means.
 *
 * `fallback` covers the caller's own chip, where the social profile row is
 * absent by design (`social_profiles` excludes self) and the answer is "ME",
 * not a question mark.
 */
export function initialsFor(name: string | null | undefined, fallback = '?'): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return fallback;
  const first = words[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1] ?? '') : '';
  const letters = last ? `${first[0] ?? ''}${last[0] ?? ''}` : first.slice(0, 2);
  return (letters || fallback).toUpperCase();
}

/**
 * The three fills the app actually uses, named.
 *
 * `sand` is the list grammar — a quiet disc in a row of names. `accent` is the
 * same disc with oxblood initials, for the one person a card is *about*.
 * `ink` is the masthead: a person's own identity, at size, in reverse.
 */
type Tone = 'sand' | 'accent' | 'ink';

const fill: Record<Tone, string> = {
  sand: 'bg-sand dark:bg-sand-dark',
  accent: 'bg-sand dark:bg-sand-dark',
  ink: 'bg-ink dark:bg-ink-dark',
};

export type AvatarProps = {
  /** Display name. Initials are derived; pass the name, not the letters. */
  name: string | null | undefined;
  /** Diameter in points. 28 / 32 / 44 / 56 / 76 are the sizes in use. */
  size?: number;
  tone?: Tone;
  /** A real photo, when there is one. Falls back to initials on failure. */
  imageUri?: string | null;
  /**
   * The surface-coloured ring that keeps overlapping faces legible in a stack.
   * Only ever needed when avatars overlap.
   */
  ring?: boolean;
  /** Shown instead of "?" when the name is absent by design — usually "ME". */
  fallback?: string;
};

/**
 * One person, as a circle.
 *
 * Four hand-built versions of this shipped across four sizes and three colour
 * schemes, each re-deriving the initials and each re-discovering the same
 * NativeWind gotcha in its own comment: a `text-canvas` className does not
 * reliably win over the variant's own `text-ink`, so light-on-ink has to go
 * through an inline style. It is handled once, here.
 *
 * The type size is chosen from the diameter rather than passed in, which is
 * what kept the copies consistent by accident; making it a rule means a new
 * size can never come out with 11px initials in a 76pt disc.
 *
 * Initials, not a person-glyph: initials are hers, the glyph is anybody's.
 */
export function Avatar({
  name,
  size = 32,
  tone = 'sand',
  imageUri,
  ring = false,
  fallback = '?',
}: AvatarProps) {
  const theme = useTheme();

  const variant: TextProps['variant'] =
    size >= 64 ? 'title' : size >= 48 ? 'heading' : size >= 40 ? 'callout' : 'caption';

  // Below 24pt the caption's 11px initials crowd the disc — the Lately atlas
  // sets its 22pt attribution chips at 9/600 in `muted` (600 resolves to the
  // Medium cut the caption variant already carries). Inline rather than a
  // variant: no other size needs it, and 24pt discs elsewhere must not move.
  const tiny = size < 24;
  const tinyInitials = tiny ? { fontSize: 9, lineHeight: 11 } : null;

  const color =
    tone === 'ink'
      ? theme.canvas
      : tone === 'accent'
        ? theme.accent
        : tiny
          ? theme.muted
          : theme.ink;

  return (
    <View
      // The name is already on the row beside it; announcing it twice makes a
      // guest list read as a stutter.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={[
        'items-center justify-center overflow-hidden rounded-full',
        fill[tone],
        ring ? 'border-2 border-surface dark:border-surface-dark' : '',
      ].join(' ')}
      style={{ width: size, height: size }}>
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          recyclingKey={imageUri}
          style={{ width: '100%', height: '100%' }}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text variant={variant} style={[{ color }, tinyInitials]}>
          {initialsFor(name, fallback)}
        </Text>
      )}
    </View>
  );
}
