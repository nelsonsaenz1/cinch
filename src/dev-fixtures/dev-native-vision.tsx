/**
 * What this device can actually measure, read off the device.
 *
 * The acceptance evidence for Packet 5 is not "the Swift compiles" — it is
 * "the module is reachable from JavaScript and reports honestly about a machine
 * that cannot do half of this". The Simulator has no Neural Engine and no
 * speech stack, so this screen's correct output there is a mixture of trues and
 * falses, and a screen of all-trues would be the bug.
 */

import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { routeFor, speechSupport } from '@/features/catalogue/local-speech';
import { GarmentVision, LocalSpeech } from '../../modules/garment-cutout';

/**
 * Read outside the component so the React Compiler is not asked to memoize a
 * try/catch it cannot preserve. Both native calls are synchronous and cheap —
 * `capabilities()` is a struct literal — so there is nothing to memoize anyway.
 */
function readCapabilities(): Record<string, unknown> | null {
  try {
    return GarmentVision
      ? (GarmentVision.capabilities() as unknown as Record<string, unknown>)
      : null;
  } catch (err) {
    return { error: String(err) };
  }
}

function Row({ label, value }: { label: string; value: unknown }) {
  return (
    <View className="flex-row justify-between gap-4 py-1">
      <Text variant="noteSmall">{label}</Text>
      <Text variant="noteSmall">{String(value)}</Text>
    </View>
  );
}

export default function DevNativeVisionScreen() {
  // Both native calls are SYNCHRONOUS — `capabilities()` and `support()` are
  // `Function`, not `AsyncFunction` — so this is a render-time read rather than
  // an effect. Reading it in an effect and calling setState would be a
  // cascading render, and the lint says so.
  const vision = readCapabilities();
  const support = speechSupport();
  // Also written to the device log, because this build's Superwall debug sheet
  // presents over everything on launch and a screenshot cannot be relied on.
  console.log('CINCH_NATIVE_EVIDENCE', JSON.stringify({ vision, support }));
  const speech = support as unknown as Record<string, unknown> | null;
  const route = JSON.stringify(routeFor(support));

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-canvas">
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text variant="eyebrow">Native · vision</Text>
        <Text variant="noteSmall" className="mb-2">
          module present: {String(Boolean(GarmentVision))}
        </Text>
        {vision
          ? Object.entries(vision).map(([k, v]) => <Row key={k} label={k} value={v} />)
          : <Text variant="noteSmall">no module</Text>}

        <Text variant="eyebrow" className="mt-6">
          Native · speech
        </Text>
        <Text variant="noteSmall" className="mb-2">
          module present: {String(Boolean(LocalSpeech))}
        </Text>
        {speech
          ? Object.entries(speech).map(([k, v]) => <Row key={k} label={k} value={v} />)
          : <Text variant="noteSmall">no module</Text>}

        <Text variant="eyebrow" className="mt-6">
          Route
        </Text>
        <Text variant="noteSmall">{route}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
