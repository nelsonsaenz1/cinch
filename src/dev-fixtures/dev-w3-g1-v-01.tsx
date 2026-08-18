/**
 * DEV ONLY — Wave 3 Group 1 canonical fixture: V-01.
 *
 * The voice door's invitation, redesign 24. The three spoken examples are the
 * BODY of this frame now — serif italic at reading-plus scale, no rule fencing
 * them off — because what the page is teaching is what saying it out loud
 * sounds like. They stay imperfect prose and never become chips: a chip reads
 * as a controlled vocabulary and these exist to teach the opposite.
 *
 * The legal sentence is drawn by `ConsentLine`, the same component the route
 * draws, so the fixture cannot photograph a trimmed or re-wrapped copy of it —
 * there is exactly one of that sentence in the product and this frame proves
 * where it sits: verbatim, whole, its own VoiceOver stop, immediately above
 * Start recording.
 *
 * Deterministic by construction: static copy, no recorder, no permission
 * prompt, no autofocused field.
 */

import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ConsentLine,
  SpokenExamples,
  WalkthroughChrome,
} from '@/components/intake/walkthrough-parts';
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
        <WalkthroughChrome exit={{ label: 'Cancel', onPress: () => {} }} />
        <ScrollView contentContainerClassName="px-gutter" style={{ flex: 1 }}>
          <Text variant="eyebrow">{WALKTHROUGH_INVITATION.eyebrow}</Text>
          <View style={{ marginTop: 6, marginBottom: 12 }}>
            <Text variant="display" trim accessibilityRole="header">
              {WALKTHROUGH_INVITATION.headline}
            </Text>
          </View>
          <Text variant="note" style={{ fontSize: 17, lineHeight: 26 }}>
            {WALKTHROUGH_INVITATION.body}
          </Text>
          <View style={{ marginTop: 24 }}>
            <SpokenExamples examples={WALKTHROUGH_INVITATION.examples} />
          </View>
        </ScrollView>
        <View className="px-gutter">
          <ConsentLine text={WALKTHROUGH_INVITATION.consent} />
          <Button
            title={WALKTHROUGH_INVITATION.action}
            onPress={() => {}}
            className="self-stretch"
          />
          <View style={{ marginTop: 10 }}>
            <Button
              title={WALKTHROUGH_INVITATION.secondary}
              variant="secondary"
              onPress={() => {}}
              className="self-stretch"
            />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
