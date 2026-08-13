/**
 * Every catalogue photograph in the feature goes through here.
 *
 * WHY THIS EXISTS. The five image sites in this feature all had the same shape:
 * render `<Image>` when there is a URL, render nothing when there is not. That
 * makes two very different situations look identical on screen — a listing the
 * feed shipped without a picture, and a picture that was there and failed to
 * arrive — and both of them come out as an empty tray plate that says nothing.
 * A live CPV2-04 run showed a page of those, and the screen gave no way to tell
 * which of the two had happened, or that anything had happened at all.
 *
 * So the three states are drawn, and they are drawn differently:
 *
 *   ABSENT   the feed had no image for this row. §6 already has the sentence
 *            for it — `NO_PHOTO` — and `ColourRow` already says it aloud.
 *   PENDING  a photograph is on its way. This is the state that caused the
 *            trouble: Mr Porter's CDN takes seconds to answer for a 250KB
 *            product shot over a simulator's network, and for those seconds a
 *            plate that draws nothing is indistinguishable from a plate that
 *            never will. It reads as "this garment has no picture", which is
 *            wrong, and it reads as a bug, which is also wrong.
 *   FAILED   there was a URL and it did not load. Never silent: a blank plate
 *            under a garment somebody is about to file reads as "this is what
 *            it looks like".
 *   LOADED   the photograph.
 *
 * The small sites — the 26pt preview chip and the 36pt selection swatch — have
 * no room for a sentence, so they carry a mark instead of copy. `compact` is
 * that, and nothing else; it never changes which state is shown.
 *
 * ONE MORE THING IT IS NOT: a retry. A failed plate does not re-request on its
 * own. `expo-image` already retries within a load, and a component that keeps
 * re-fetching a dead merchant URL every time it scrolls into view would spend
 * the user's bandwidth to redraw the same empty rectangle.
 */

import { Image, type ImageContentFit } from 'expo-image';
import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { NO_PHOTO, PHOTO_FAILED } from '@/features/catalogue/copy';
import { useTheme } from '@/theme/tokens';

type Status = 'pending' | 'loaded' | 'failed';

export type CataloguePlateProps = {
  /** The merchant's image URL, or null when the feed shipped none. */
  uri: string | null;
  contentFit?: ImageContentFit;
  /** Tailwind classes for the plate frame — radius and background live there. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  /** Chips and swatches: draw a mark rather than a sentence. */
  compact?: boolean;
};

export function CataloguePlate({
  uri,
  contentFit = 'contain',
  className,
  style,
  compact = false,
}: CataloguePlateProps) {
  const theme = useTheme();

  /**
   * The load outcome, TIED TO THE URL IT BELONGS TO.
   *
   * A new URL is a new load: without that, swapping the preview chip on a
   * family card would keep the previous colourway's failure on screen. The
   * obvious way to write it is an effect that resets on `[uri]`, but that is a
   * synchronous `setState` inside an effect — a cascading render, and a lint
   * error the repo treats as one. Storing the URL alongside the status makes
   * the reset a comparison during render instead, with no second pass.
   */
  const [loaded, setLoaded] = useState<{ uri: string | null; status: Status }>({
    uri,
    status: 'pending',
  });
  const status: Status = loaded.uri === uri ? loaded.status : 'pending';
  const settle = (next: Status) => setLoaded({ uri, status: next });

  const message = uri === null ? NO_PHOTO : status === 'failed' ? PHOTO_FAILED : null;

  return (
    <View className={className} style={style}>
      {/* Under the photograph, not instead of it: the image mounts either way,
          and the sweep is simply what shows through until the first frame
          lands. Swapping components on load would restart the request. */}
      {uri !== null && status === 'pending' ? (
        <Skeleton className="absolute inset-0" />
      ) : null}

      {uri !== null && status !== 'failed' ? (
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          contentFit={contentFit}
          transition={0}
          onLoad={() => settle('loaded')}
          onError={() => settle('failed')}
        />
      ) : null}

      {message ? (
        <View
          // The message is decoration here: `ColourRow` and the family card
          // already put the state into their own spoken labels, and a second
          // focusable "No photo in the catalogue" beside them would be read
          // twice.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="absolute inset-0 items-center justify-center px-1.5">
          {compact ? (
            // A rule across the plate. Visible at 26pt, where four words are not.
            <View style={{ width: '55%', height: 1, backgroundColor: theme.rule }} />
          ) : (
            <Text variant="noteSmall" style={{ textAlign: 'center' }} numberOfLines={3}>
              {message}
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}
