import { Linking, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import {
  failureCopy,
  type WalkthroughFailureCause,
} from '@/features/intake/walkthrough-copy';

/**
 * V-13a…e — five named causes, five screens, five actions.
 *
 * A failure is a phase with its own screen and its own action, never a generic
 * error card with swapped copy. The first sentence states the fact; the second
 * states the consequence and names the exits.
 *
 * The `unparsed` branch shows the transcript in full, and that is the whole
 * design of this state: it turns "it did not work" into "here is what it heard,
 * and now you can see why". The transcript is the reader's own speech and never
 * leaves this screen — not into analytics, not into the closet.
 *
 * A COMPONENT, not a branch inside the route, so every cause can be rendered on
 * its own fixture route without booting the walkthrough's state machine.
 */

/** The failure the walkthrough hands over. `retry` exists only where a retry
 *  could actually succeed — which is the offline branch and nowhere else. */
export type WalkthroughFailure =
  | { cause: 'denied' }
  | { cause: 'silent' }
  | { cause: 'unparsed'; transcript: string }
  | { cause: 'offline'; retry: () => void }
  | { cause: 'signed_out' };

export function FailureScreen({
  failure,
  durationMs,
  onPhotograph,
  onRetake,
  onSignIn,
  onLeaveForLater,
}: {
  failure: WalkthroughFailure;
  durationMs: number | null;
  onPhotograph: () => void;
  /** Back to V-01 with a clean slate — "Record again" means another take, not
   *  another app. Routing this to The Ten was the first walk's second bug. */
  onRetake: () => void;
  onSignIn: () => void;
  onLeaveForLater: () => void;
}) {
  const copy = failureCopy(failure.cause as WalkthroughFailureCause, durationMs);

  /** The one action each cause is actually asking for. */
  const primaryPress = () => {
    switch (failure.cause) {
      case 'denied':
        return onPhotograph();
      case 'silent':
      case 'unparsed':
        return onRetake();
      case 'offline':
        return failure.retry();
      case 'signed_out':
        return onSignIn();
    }
  };

  /** The named exits, in the atlas's own order for each cause. */
  const secondaryPress = (label: string) => {
    if (label === 'Open Settings') return () => void Linking.openSettings();
    if (label === 'Leave it for later') return onLeaveForLater;
    return onPhotograph;
  };

  return (
    <View className="flex-1 bg-canvas">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <ScrollView contentContainerClassName="px-gutter" style={{ flex: 1 }}>
          <View accessibilityRole="alert" style={{ marginTop: 44, marginBottom: 10 }}>
            <Text variant="title" trim accessibilityRole="header" style={{ fontSize: 30 }}>
              {copy.headline}
            </Text>
          </View>
          <Text variant="note" style={{ fontSize: 16, lineHeight: 25 }}>
            {copy.body}
          </Text>
          {failure.cause === 'unparsed' ? (
            // Showing the transcript is the whole design: it turns "it did not
            // work" into "here is what it heard, and now you can see why". It
            // is the reader's own speech and never leaves this screen — not to
            // analytics, not to the closet.
            <View className="bg-tray" style={{ marginTop: 20, borderRadius: 12, padding: 16 }}>
              <Text variant="body" style={{ fontSize: 16, lineHeight: 25 }}>
                {failure.transcript}
              </Text>
            </View>
          ) : null}
        </ScrollView>
        <View className="px-gutter">
          <Button title={copy.primary} onPress={primaryPress} haptic className="self-stretch" />
          {copy.secondaries.map((label, i) => (
            // The wrapper carries the offset: `Button` omits `style` from its
            // props on purpose, so spacing is spent outside it.
            <View key={label} style={{ marginTop: i === 0 ? 10 : 0 }}>
              <Button
                title={label}
                // The first named exit is a real control; anything after it is
                // the quiet way out. Neither is oxblood — the frame spent it.
                variant={i === 0 && copy.secondaries.length > 1 ? 'secondary' : 'ghost'}
                onPress={secondaryPress(label)}
                className="self-stretch"
              />
            </View>
          ))}
        </View>
      </SafeAreaView>
    </View>
  );
}

