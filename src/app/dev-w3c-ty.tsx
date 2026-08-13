import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { VARIANTS } from '@/components/ui/button-spec';

/**
 * TY-01 / TY-02 — the type system with the Medium cut taken out of it.
 *
 * ── WHAT TO LOOK FOR, WHICH IS DELIBERATELY NOT MUCH ──────────────────────
 *
 * "The pair reads the same at a glance, which is the point: nothing was
 * carrying meaning through weight." So this fixture is not trying to show a
 * dramatic change. It is trying to let somebody confirm that the hierarchy
 * still works — that a title still outranks a caption, that a selected chip is
 * still visibly selected, that a primary button is still obviously the thing to
 * press — with size, colour, case and space doing all of it.
 *
 * The six button variants are drawn together because they are where weight used
 * to be spent: three of them carried Medium and three did not, and the whole
 * argument for that was that a filled button needs its label to shout. What
 * separates them now is the ground, the label colour and, on the primary alone,
 * the contact shadow — which is what was separating them all along.
 */
export default function DevW3cTy() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScrollView contentContainerClassName="px-gutter pb-16 pt-4">
        <Text variant="eyebrow">Display — serif regular</Text>
        <View className="mt-2">
          <Text variant="greeting" trim>
            Good morning, Nelson.
          </Text>
        </View>
        <Text variant="plate" className="mt-3">
          Quiet authority
        </Text>

        <Text variant="eyebrow" className="mt-8">
          Body and supporting — sans regular
        </Text>
        <Text variant="body" className="mt-2">
          Cognac and cream anchor the look while the charcoal trousers ground it.
        </Text>
        <Text variant="note" className="mt-2">
          Filed as a knit top. You can correct the category later.
        </Text>
        <Text variant="noteSmall" className="mt-2">
          Photographs supplied by the shops.
        </Text>

        <Text variant="eyebrow" className="mt-8">
          Buttons — colour carries the weight
        </Text>
        <View className="mt-2" style={{ gap: 8 }}>
          {VARIANTS.map((v) => (
            <Button key={v} title={`${v} — Start your closet`} variant={v} onPress={() => {}} />
          ))}
        </View>

        <Text variant="eyebrow" className="mt-8">
          Chips — selection is ground and colour, never weight
        </Text>
        <View className="mt-2 flex-row flex-wrap" style={{ gap: 8 }}>
          <Chip label="All" selected onPress={() => {}} />
          <Chip label="Tops" onPress={() => {}} />
          <Chip label="Shoes" onPress={() => {}} />
        </View>

        <Text variant="eyebrow" className="mt-8">
          Settings values and the weekday strip
        </Text>
        <View className="mt-2 flex-row justify-between">
          <Text variant="body">Membership</Text>
          <Text variant="body" className="text-muted">
            Free
          </Text>
        </View>
        <View className="mt-1 flex-row justify-between">
          <Text variant="body">Packing reminders</Text>
          <Text variant="body" className="text-muted">
            On
          </Text>
        </View>
        <View className="mt-3 flex-row justify-between">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
            <Text key={d} variant="note" className={i === 3 ? 'text-accent' : ''}>
              {d}
            </Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
