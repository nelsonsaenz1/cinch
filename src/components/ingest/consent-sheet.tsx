import { Modal, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

/**
 * The AI processing consent interaction required by Guideline 5.1.2(i).
 *
 * Copy principles, because this is a compliance surface and a trust surface at
 * once: say what leaves the device, say what does not, name the recipient, and
 * do not bury any of it. The "stays on your phone" line is genuinely true —
 * background removal runs on-device via Apple Vision — and it is worth saying
 * plainly rather than hiding behind a policy link.
 */
export function ConsentSheet({
  visible,
  onAccept,
  onDecline,
  busy,
}: {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
  busy?: boolean;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark">
        <ScrollView contentContainerClassName="px-8 pb-8 pt-10">
          <Text variant="eyebrow" className="mb-3 text-accent dark:text-accent-dark">
            Before Cinch looks
          </Text>
          <Text variant="title">Cinch uses AI to tag your clothes</Text>

          <Text variant="body" className="mt-4 text-muted dark:text-muted-dark">
            To build your closet, photos of your clothes are sent to our AI
            provider, OpenRouter, which identifies what each piece is — the
            category, colours, how formal it is, and what weather it suits.
          </Text>

          <View className="mt-6 rounded-card border border-hairline p-5 dark:border-hairline-dark">
            <Text variant="caption" className="mb-3">
              What gets sent
            </Text>
            <Text variant="body">
              Photos of individual clothing items, and later the weather and
              plans you ask about.
            </Text>

            <Text variant="caption" className="mb-3 mt-6">
              What stays on your phone
            </Text>
            <Text variant="body">
              Cutting the background out of your photos happens entirely on your
              device. Your photo library is never read — you choose exactly which
              pictures to share, one at a time.
            </Text>
          </View>

          {/* This promise is kept in Profile → "AI features" → Turn off, which
              nulls the consent record the Edge Functions check on every call.
              The second sentence used to say withdrawal turned off "outfit
              suggestions", which was not true: outfits are built by the
              on-device engine and keep working without any AI at all. Only the
              naming and the reasoning prose come from the model. */}
          <Text variant="label" className="mt-6">
            You can withdraw this at any time in Profile. Your closet stays, and
            Cinch keeps putting outfits together on your phone — what stops is
            tagging new pieces, the stylist chat, and having the AI rewrite the
            suggestions.
          </Text>

          <View className="mt-8 gap-3">
            <Button title="Continue" onPress={onAccept} loading={busy} haptic />
            <Button title="Not now" variant="ghost" onPress={onDecline} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
