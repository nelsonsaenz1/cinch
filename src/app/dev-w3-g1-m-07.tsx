/**
 * DEV ONLY — Wave 3 Group 1 canonical fixture: M-07.
 *
 * More heard than the free closet holds. A CAPACITY FACT, not an upsell: no
 * tier is named, no price appears and no upgrade action is drawn — the paywall
 * comes after the Reveal, where the reader has seen what the closet makes.
 * "Either way, nothing you said is deleted" is the closing promise, and both
 * actions keep it.
 *
 * Deterministic by construction: ten and thirty come from `PLANS.free`, the
 * twenty-three from the frozen draft list, and every other figure is derived
 * from those three.
 */

import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Rule } from '@/components/ui/rule';
import { Text } from '@/components/ui/text';
import { PLANS } from '@/features/billing/plans';
import { ceilingCopy, ceilingRows } from '@/features/intake/walkthrough-copy';

const HEARD = 23;

export default function Fixture() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const copy = ceilingCopy(HEARD, PLANS.free.items, PLANS.free.storedItems);
  const rows = ceilingRows(HEARD, PLANS.free.items, PLANS.free.storedItems);

  return (
    <View className="flex-1 bg-canvas">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <View className="flex-1 px-gutter" style={{ paddingTop: 44 }}>
          <Text variant="eyebrow">{copy.eyebrow}</Text>
          <View style={{ marginTop: 10, marginBottom: 12 }}>
            <Text variant="title" trim accessibilityRole="header" style={{ fontSize: 36 }}>
              {copy.headline}
            </Text>
          </View>
          <Text variant="note" style={{ fontSize: 17, lineHeight: 26 }}>
            {copy.body}
          </Text>
          <View style={{ marginTop: 28 }}>
            {rows.map((row) => (
              <View key={row.label}>
                <Rule />
                <View
                  className="flex-row items-center justify-between"
                  style={{ paddingVertical: 12 }}>
                  <Text variant={row.quiet ? 'note' : 'body'} style={{ fontSize: 16 }}>
                    {row.label}
                  </Text>
                  <Text
                    variant={row.quiet ? 'note' : 'heading'}
                    style={{ fontSize: 16, fontVariant: ['tabular-nums'] }}>
                    {row.value}
                  </Text>
                </View>
              </View>
            ))}
            <Rule />
          </View>
        </View>
        <View className="px-gutter">
          <Button title={copy.primary} onPress={() => {}} className="self-stretch" />
          <Button
            title={copy.secondary}
            variant="ghost"
            onPress={() => {}}
            className="self-stretch"
          />
          <Text variant="note" style={{ textAlign: 'center', marginTop: 4, marginBottom: 8 }}>
            {copy.footer}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}
