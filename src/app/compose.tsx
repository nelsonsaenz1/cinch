import { router } from 'expo-router';
import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PickerFooterTray, PiecePicker } from '@/components/share-look/piece-picker';
import { Button, ScreenHeader, Text } from '@/components/ui';
import { useToast } from '@/components/ui/toast-host';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { canCompose, titleFromPieces } from '@/features/share-look/compose';
import { useComposeOwnOutfit } from '@/features/styling/compose-own';
import { useWardrobe } from '@/features/styling/queries';
import type { Garment } from '@/lib/styling';

/**
 * Compose your own — the door the app's first support email asked for.
 *
 * "I want to be able to make my own outfits so that if I'm already wearing
 * something or I don't like what the app suggested I can add my outfit to my
 * calendar anyway." (2026-08-30.) She was right that it wasn't an option:
 * composing by hand existed only inside an event board. This screen is that
 * same picker with no event attached — the person's own pieces, their own
 * order, and the two honest exits: wear it today (a real wear, counted, on
 * the diary), or keep it for later.
 *
 * Reuses the share-look picker and rules wholesale: same six-piece ceiling,
 * same tray, same AX behaviour — one composing grammar in the whole app.
 */
export default function ComposeScreen() {
  const toast = useToast();
  const wardrobe = useWardrobe();
  const compose = useComposeOwnOutfit();

  const [stack, setStack] = useState<Garment[]>([]);
  const [refused, setRefused] = useState(false);
  const [saving, setSaving] = useState<'wear' | 'save' | null>(null);

  const { fontScale } = useWindowDimensions();
  const ax = fontScale >= 1.5;

  const candidates = wardrobe.data ?? [];
  const { resolve } = useSignedUrls(
    candidates.flatMap((g) => [g.platePath, g.cutoutPath, g.thumbPath]),
  );

  const submit = (wearNow: boolean) => {
    if (compose.isPending) return;
    setSaving(wearNow ? 'wear' : 'save');
    compose.mutate(
      {
        itemIds: stack.map((g) => g.id),
        name: titleFromPieces(stack) || null,
        wearNow,
      },
      {
        onSuccess: () => {
          toast.show(wearNow ? 'Worn today — it’s on your diary' : 'Saved to your outfits');
          router.back();
        },
        onError: () => {
          setSaving(null);
          toast.show('Couldn’t save — try again');
        },
      },
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'bottom']}>
      <ScreenHeader title="Compose your own" onBack={() => router.back()} />

      <View className="flex-1 px-gutter">
        <Text variant="body" className="mt-1 text-muted">
          Pick the pieces you’re wearing — or want to remember together.
        </Text>

        <View className="mt-4 flex-1">
          <PiecePicker
            candidates={candidates}
            stack={stack}
            resolveImage={resolve}
            onChangeStack={(next) => {
              setRefused(false);
              setStack(next);
            }}
            onRefused={() => setRefused(true)}
            ax={ax}
          />
        </View>

        <PickerFooterTray
          stack={stack}
          resolveImage={resolve}
          canCompose={canCompose(stack)}
          onCompose={() => submit(true)}
          refused={refused}
          ax={ax}
        />

        <View className="mb-2 mt-3 gap-2">
          <Button
            title="Wear it today"
            loading={saving === 'wear' && compose.isPending}
            disabled={!canCompose(stack) || compose.isPending}
            onPress={() => submit(true)}
          />
          <Button
            title="Just save it for later"
            variant="ghost"
            loading={saving === 'save' && compose.isPending}
            disabled={!canCompose(stack) || compose.isPending}
            onPress={() => submit(false)}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
