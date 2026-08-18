import { Pressable, Text as RNText, View } from 'react-native';

import { atlas } from '@/components/auth/chrome';
import { RUN } from '@/features/auth/auth-run-spec';

/**
 * DEV ONLY — the tap-to-cycle chips the redesign-19 fixtures share.
 *
 * Deliberately NOT named `dev-*`: everything matching that pattern in this
 * directory is a route, and `tests/dev-route-index.test.ts` requires every one
 * of them to appear in the fixture index. This is a component the routes
 * import, not a frame anybody opens, so it takes a plain name and stays out of
 * the index. It is still reached through the `@/` alias, so a fixture copied
 * alone into `src/app/` for a simulator pass keeps working.
 */
export function PosePicker<T extends string>({
  poses,
  pose,
  onPick,
}: {
  poses: readonly T[];
  pose: T;
  onPick: (p: T) => void;
}) {
  return (
    <View style={{ marginTop: 40, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {poses.map((p) => (
        <Pressable
          key={p}
          onPress={() => onPick(p)}
          accessibilityRole="button"
          accessibilityLabel={p}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 10,
            backgroundColor: p === pose ? atlas.oxblood : RUN.well,
          }}>
          <RNText
            style={{
              fontFamily: 'HelveticaNeue',
              fontSize: 12,
              color: p === pose ? atlas.cream : atlas.ink,
            }}>
            {p}
          </RNText>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * The `?pose=` reader every fixture repeats: the URL is the source of truth and
 * a tap is an override the URL clears. Returned as a validated pose rather than
 * a raw string, so an unknown link falls back to the first frame instead of
 * rendering an empty screen nobody can diagnose.
 */
export function linkedPose<T extends string>(
  poses: readonly T[],
  raw: string | undefined,
  fallback: T,
): T {
  return (poses as readonly string[]).includes(raw ?? '') ? (raw as T) : fallback;
}
