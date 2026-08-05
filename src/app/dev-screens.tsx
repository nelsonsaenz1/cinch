import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Rule } from '@/components/ui/rule';
import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

/** Throwaway preview — item-detail stat grid + the "nothing works" card. */
export default function DevScreens() {
  const theme = useTheme();
  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
      <ScrollView contentContainerClassName="px-gutter pb-16">
        <Text variant="title" className="mt-2">
          Charcoal wool coat
        </Text>
        <Text variant="label" className="mt-1 text-faint dark:text-faint-dark">
          Owned since Oct 2023
        </Text>

        <View className="mt-6 overflow-hidden rounded-plate border border-rule dark:border-rule-dark">
          <View className="flex-row">
            <Box value="42×" label="Worn" edge="rb" />
            <Box value="$197" label="Paid" edge="b" />
          </View>
          <View className="flex-row">
            <Box value="$4.70" label="Cost per wear" edge="r" invert />
            <Box value="4d" label="Since last worn" />
          </View>
        </View>

        <View className="mt-6">
          <Text variant="eyebrow" className="mb-3">
            Suits
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <Chip label="office" />
            <Chip label="outdoor" />
            <Chip label="formal" />
          </View>
        </View>

        <View className="mt-6">
          <Text variant="eyebrow" className="mb-3">
            Colours
          </Text>
          <View className="flex-row items-center gap-2.5">
            <View className="h-6 w-6 rounded-full border border-rule" style={{ backgroundColor: '#3A3A38' }} />
            <View className="h-6 w-6 rounded-full border border-rule" style={{ backgroundColor: '#1C1A16' }} />
            <Text variant="label" className="text-muted dark:text-muted-dark">
              Charcoal · Ink
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 32 }} />

        {/* Nothing-works card */}
        <View className="rounded-plate border border-rule bg-surface p-5 dark:border-rule-dark dark:bg-surface-dark">
          <Text variant="title">Nothing today feels right — and I won&apos;t pretend it does.</Text>
          <Text variant="body" className="mt-3 text-muted dark:text-muted-dark">
            Cinch couldn&apos;t build an outfit that holds together from what&apos;s in your closet
            right now. One more layer, or a pair of shoes, usually unlocks it.
          </Text>
          <View className="my-4">
            <Rule />
          </View>
          <Text variant="eyebrow" className="mb-3">
            What might help
          </Text>
          <View className="gap-3">
            {(
              [
                ['bubble.left.and.text.bubble.right', 'Ask the stylist for a way around it'],
                ['plus', 'Add a piece Cinch is missing'],
                ['arrow.clockwise', 'Try again once things change'],
              ] as const
            ).map(([icon, label]) => (
              <View key={label} className="flex-row items-center gap-3">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-accent-light">
                  <SymbolView name={icon} size={15} tintColor={theme.accent} resizeMode="scaleAspectFit" />
                </View>
                <Text variant="body">{label}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Box({
  value,
  label,
  edge = '',
  invert = false,
}: {
  value: string;
  label: string;
  edge?: 'rb' | 'b' | 'r' | '';
  invert?: boolean;
}) {
  const theme = useTheme();
  const borders = `${edge.includes('r') ? 'border-r ' : ''}${edge.includes('b') ? 'border-b ' : ''}`;
  return (
    <View className={`flex-1 p-4 ${borders}border-rule dark:border-rule-dark ${invert ? 'bg-ink' : ''}`}>
      <Text variant="stat" className="text-figure" style={{ color: invert ? theme.canvas : theme.ink }}>
        {value}
      </Text>
      <Text
        variant="colophon"
        className="mt-1"
        style={{ color: invert ? 'rgba(251,250,246,0.7)' : theme.faint }}>
        {label}
      </Text>
    </View>
  );
}
