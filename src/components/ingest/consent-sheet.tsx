import { SymbolView } from 'expo-symbols';
import { Modal, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

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
  const theme = useTheme();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark">
        <ScrollView contentContainerClassName="px-8 pb-8 pt-10">
          <View className="mb-6 h-16 w-16 items-center justify-center rounded-full bg-tray dark:bg-tray-dark">
            <SymbolView name="sparkles" size={28} tintColor={theme.accent} resizeMode="scaleAspectFit" />
          </View>

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

          <Text variant="label" className="mt-6">
            You can withdraw this at any time in Profile. Doing so keeps your
            closet but turns off tagging and outfit suggestions.
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
