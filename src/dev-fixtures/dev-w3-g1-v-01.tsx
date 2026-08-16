/**
 * DEV ONLY — Wave 3 Group 1 canonical fixture: V-01.
 *
 * The voice door's invitation, at the same weight as the camera. The examples
 * are deliberately imperfect phrasing set as italic PROSE rather than chips —
 * they teach that the parser tolerates how people actually speak, and a chip
 * would read as a controlled vocabulary. "Photograph them instead" keeps the
 * other door one tap away.
 *
 * Deterministic by construction: static copy, no recorder, no permission
 * prompt, no autofocused field.
 */

import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { WALKTHROUGH_INVITATION } from '@/features/intake/walkthrough-copy';

export default function Fixture() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-canvas">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <ScrollView contentContainerClassName="px-gutter" style={{ flex: 1 }}>
          <Text variant="eyebrow" className="pt-4">
            {WALKTHROUGH_INVITATION.eyebrow}
          </Text>
          <View style={{ marginTop: 6, marginBottom: 12 }}>
            <Text variant="display" trim accessibilityRole="header">
              {WALKTHROUGH_INVITATION.headline}
            </Text>
          </View>
          <Text variant="note" style={{ fontSize: 17, lineHeight: 26 }}>
            {WALKTHROUGH_INVITATION.body}
          </Text>
          <View style={{ marginTop: 22, gap: 6 }}>
            {WALKTHROUGH_INVITATION.examples.map((e) => (
              <Text key={e} variant="note" className="italic" style={{ fontSize: 17 }}>
                {e}
              </Text>
            ))}
          </View>
        </ScrollView>
        <View className="px-gutter">
          <View style={{ marginBottom: 12 }}>
            <Text variant="note" style={{ fontSize: 14, lineHeight: 21 }}>
              {WALKTHROUGH_INVITATION.consent}
            </Text>
          </View>
          <Button
            title={WALKTHROUGH_INVITATION.action}
            onPress={() => {}}
            className="self-stretch"
          />
          <Button
            title={WALKTHROUGH_INVITATION.secondary}
            variant="ghost"
            onPress={() => {}}
            className="self-stretch"
          />
        </View>
      </SafeAreaView>
    </View>
  );
}
