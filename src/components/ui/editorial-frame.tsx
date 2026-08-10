import { View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

/**
 * The full-bleed editorial spread — an eyebrow, a serif headline, a paragraph,
 * and one action at the foot.
 *
 * Built for the first-run tour (TR-01…03), which is the only place in the app
 * that gets to use the largest type there is. Kept in the shared kit rather
 * than inside the tour because it is the same furniture a Season in review
 * cover needs, and the last three waves each rebuilt a component that already
 * existed one screen over.
 *
 * ON THE DARK GROUND
 *
 * `ground="ink"` paints the frame in ink and inverts the type. This is NOT a
 * dark mode — the app is light-only and the palette is locked. It is ink used
 * as a ground, the way a magazine prints one spread on black, and the atlases
 * ration it deliberately: "the dark ground appears on frame one only. The tour
 * walks from the announcement onto the paper the app is printed on." Spend it
 * on the announcement and nowhere else, or it stops meaning anything.
 *
 * The inverted colours are set with inline `style`, never a second `text-*`
 * class, for the reason recorded in text.tsx: NativeWind gives no precedence
 * between two utilities of the same kind on one element, so a `text-canvas` on
 * top of a variant's `text-ink` is a coin toss.
 */
export function EditorialFrame({
  /** The frame number spelled out, then the subject — "One · The promise". */
  eyebrow,
  /**
   * Two or three words a line, set in the `spread` step — 56px, the size the
   * atlas asks for and calls "the largest type anywhere in the app". That
   * claim is only true while nothing else reaches for it, which is why the
   * step exists for this component alone. See the note in tailwind.config.js.
   */
  headline,
  /** 17/1.55, and never past three lines. Brevity is the specification. */
  body,
  ground = 'canvas',
  /** The one primary action, full width, at the foot. */
  action,
  /** Text, never a second button. The atlas is explicit about this. */
  secondary,
  /** Skip, top-right. Absent on the last frame, where the two real choices replace it. */
  corner,
  children,
  ...rest
}: {
  eyebrow?: string;
  headline: string;
  body?: string;
  ground?: 'canvas' | 'ink';
  action?: React.ReactNode;
  secondary?: React.ReactNode;
  corner?: React.ReactNode;
  children?: React.ReactNode;
} & ViewProps) {
  const theme = useTheme();
  const dark = ground === 'ink';

  // On ink, `muted` would be a dark grey on a dark ground — the same AA failure
  // `faint` is on canvas, arrived at from the other direction. The quiet layer
  // on ink is the canvas colour held back, not a grey.
  const quiet = dark ? 'rgba(251,250,246,0.62)' : theme.muted;
  const loud = dark ? theme.canvas : theme.ink;

  return (
    <View style={{ flex: 1, backgroundColor: dark ? theme.ink : theme.canvas }} {...rest}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {corner ? (
          <View className="flex-row justify-end px-5 pt-2">{corner}</View>
        ) : (
          <View className="pt-2" />
        )}

        {/* The spread itself sits optically high rather than centred: a
            headline centred in the full height reads as a splash screen, and
            the atlas hangs it from the upper third with the action at the
            foot. `justify-center` on a flex-1 with the action outside it is
            what produces that without hard-coding a top offset. */}
        {/* 34pt, not the app's 24pt gutter.
            The wider margin is not decoration — it is what produces the
            atlas's "two or three words a line". At the gutter, "Your whole
            closet," fits on one line and the announcement sets in two;
            at 34 it breaks where the design breaks it, in three. The measure
            and the type size are one decision, and this is the only screen in
            the app set to it. */}
        <View className="flex-1 justify-center" style={{ paddingHorizontal: 34 }}>
          {eyebrow ? (
            <Text variant="eyebrow" style={{ color: quiet }} className="mb-4">
              {eyebrow}
            </Text>
          ) : null}

          <Text variant="spread" trim style={{ color: loud }}>
            {headline}
          </Text>

          {body ? (
            // `mt-*` on a trim'd serif Text cancels to roughly nothing — the
            // cap-trim eats it — so the space belongs to this element's own
            // margin-top only because the sibling above is the trimmed one.
            // See the trim/margin note in the design memory before changing it.
            <Text variant="body" style={{ color: quiet, marginTop: 20 }}>
              {body}
            </Text>
          ) : null}

          {children}
        </View>

        <View className="px-6 pb-4">
          {action}
          {secondary ? <View className="mt-3 items-center">{secondary}</View> : null}
        </View>
      </SafeAreaView>
    </View>
  );
}
