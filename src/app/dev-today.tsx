import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FIXTURE_OUTFIT } from '@/components/dev/fixtures';
import { Plate } from '@/components/today/plate';
import { Rule } from '@/components/ui/rule';
import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * DEV ONLY — a signed-out preview of Today at `cinch://dev-today`.
 *
 * The real screen lives behind auth, a populated closet, a weather fetch and a
 * 15-second re-rank, so its states are near-impossible to see side by side.
 * This stacks the three the handoff draws — a normal day (02a), the empty
 * closet (02b), and offline (02d) — with hand-built mock data, each labelled,
 * so the whole screen can be judged in one screenshot. It mirrors
 * (tabs)/index.tsx; the fixtures live in src/components/dev/fixtures.ts.
 *
 * Dev-only, like dev-plate / dev-closet: __DEV__-gated in the auth gate, and it
 * renders a refusal outside it so it ships nothing.
 */
export default function DevTodayScreen() {
  const theme = useTheme();

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas dark:bg-canvas-dark">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
      <ScrollView contentContainerClassName="pb-16">
        {/* ── 02a · a normal day ─────────────────────────────────────────── */}
        <StateLabel>02a · a normal day</StateLabel>

        <View className="px-gutter pt-2" style={{ paddingBottom: 18 }}>
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text variant="eyebrow">Tue 5 Aug · London</Text>
              <View style={{ marginTop: 6 }}>
                <Text variant="display" trim accessibilityRole="header">
                  Good morning
                </Text>
              </View>
            </View>
            <View className="flex-row gap-2" style={{ marginTop: 2 }}>
              <View
                style={{ width: 34, height: 34 }}
                className="items-center justify-center rounded-full border border-rule">
                <SymbolView
                  name="sparkles"
                  size={16}
                  tintColor={theme.accent}
                  resizeMode="scaleAspectFit"
                />
              </View>
              <View
                style={{ width: 34, height: 34 }}
                className="items-center justify-center rounded-full bg-ink">
                <SymbolView
                  name="person.fill"
                  size={15}
                  tintColor={theme.canvas}
                  resizeMode="scaleAspectFit"
                />
              </View>
            </View>
          </View>
          <View style={{ marginTop: 14 }}>
            <Rule />
          </View>
        </View>

        <View className="mt-2 px-gutter">
          <Text variant="label" numberOfLines={2}>
            Feels 54°F · light rain clearing by noon
          </Text>
        </View>

        {/* The plans note, set as the design's tray pill with a leading "+". */}
        <View className="mx-gutter mt-4 flex-row items-center gap-2 rounded-md bg-tray px-3.5 py-2.5 dark:bg-tray-dark">
          <SymbolView name="plus" size={15} tintColor={theme.accentWarm} resizeMode="scaleAspectFit" />
          <Text variant="callout" className="text-muted dark:text-muted-dark">
            Dinner at 7, then drinks — tell Cinch
          </Text>
        </View>

        <View className="mt-6">
          <Plate
            outfit={FIXTURE_OUTFIT}
            index={0}
            occasion="dinner at 7"
            colophon={{ city: 'London', feelsLikeC: 12 }}
            resolveImage={() => undefined}
            onWear={() => {}}
            onReact={() => {}}
          />
        </View>

        <View className="px-gutter">
          <Text variant="label">
            6 more reactions and Cinch will start recognising your taste.
          </Text>
        </View>

        {/* ── 02b · empty closet ─────────────────────────────────────────── */}
        <StateLabel className="mt-10">02b · new user · empty closet</StateLabel>

        <View className="px-gutter pt-2">
          <Text variant="eyebrow">Tue 5 Aug · London</Text>
          <View style={{ marginTop: 6 }}>
            <Text variant="display" trim>
              Today
            </Text>
          </View>
        </View>

        <View className="items-center px-gutter" style={{ paddingVertical: 36 }}>
          <View
            className="items-center justify-end bg-tray dark:bg-tray-dark"
            style={{
              width: 132,
              height: 152,
              borderRadius: 8,
              borderWidth: 1.5,
              borderColor: theme.rule,
              borderStyle: 'dashed',
              paddingBottom: 12,
            }}>
            <Text variant="colophon">Nothing to style yet</Text>
          </View>

          <View style={{ marginTop: 26 }}>
            <Text variant="title" className="text-center">
              I can&apos;t style{'\n'}what I can&apos;t see
            </Text>
          </View>

          <Text
            variant="body"
            className="mt-3 text-center text-muted dark:text-muted-dark"
            style={{ maxWidth: 264 }}>
            Photograph your wardrobe once and I&apos;ll build outfits from your real clothes each
            morning. No shopping, ever.
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add your clothes"
            style={{ minHeight: MIN_TAP_TARGET }}
            className="mt-7 flex-row items-center justify-center rounded-md bg-ink px-6 active:opacity-70 dark:bg-ink-dark">
            <Text variant="body" className="font-semibold" style={{ color: theme.canvas }}>
              Add your clothes
            </Text>
          </Pressable>
        </View>

        {/* ── 02d · offline ──────────────────────────────────────────────── */}
        <StateLabel className="mt-10">02d · offline</StateLabel>

        <View className="mx-gutter flex-row items-center gap-2.5 rounded-md bg-ink px-3.5 py-2.5">
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: theme.accentWarm }} />
          <Text variant="label" className="flex-1 font-medium" style={{ color: theme.canvas }}>
            Offline — showing this morning&rsquo;s set. Weather and plans may have moved on.
          </Text>
        </View>

        <View className="px-gutter pt-3">
          <Text variant="eyebrow">Last synced 8:12am</Text>
          <View style={{ marginTop: 6 }}>
            <Text variant="display" trim>
              Today
            </Text>
          </View>
        </View>

        {/* Offline dims the set: it is real, but it is this morning's. */}
        <View className="mt-4" style={{ opacity: 0.62 }}>
          <Plate
            outfit={FIXTURE_OUTFIT}
            index={0}
            occasion="dinner at 7"
            colophon={{ city: 'London', feelsLikeC: 12 }}
            resolveImage={() => undefined}
            onWear={() => {}}
            onReact={() => {}}
          />
        </View>

        <Text variant="caption" className="mt-4 px-gutter text-center">
          Reactions will sync once you&rsquo;re back online.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/** A small caption marking each stacked state — dev chrome, not app UI. */
function StateLabel({ children, className = '' }: { children: string; className?: string }) {
  return (
    <View className={`px-gutter ${className}`} style={{ paddingTop: 8, paddingBottom: 4 }}>
      <Text variant="colophon" className="text-accent dark:text-accent-dark">
        {children}
      </Text>
    </View>
  );
}
