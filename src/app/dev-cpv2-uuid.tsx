/**
 * Which UUID source actually answers on this device.
 *
 * Exists because two attempts at this line had a runtime precondition no
 * typecheck could see — see `features/catalogue/request-id.ts`. A route is the
 * only way to find out, because the answer depends on native bindings that are
 * present in a built app and absent from a bundler.
 *
 * Read-only: it prints which rung fired and one sample id. It writes nothing,
 * uploads nothing and records nothing.
 */

import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { newRequestId, requestIdSource } from '@/features/catalogue/request-id';

export default function DevCpv2UuidScreen() {
  const source = requestIdSource();
  const sample = newRequestId();
  const shaped = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sample);

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-canvas">
      <View className="gap-3 px-gutter pt-4">
        <Text variant="eyebrow">CPV2 · request id source</Text>
        <Text variant="display">{source}</Text>
        <Text variant="body">{sample}</Text>
        <Text variant="note">
          {shaped
            ? 'Shape accepted by the server guard.'
            : 'REJECTED by the server guard — this would 400.'}
        </Text>
      </View>
    </SafeAreaView>
  );
}
