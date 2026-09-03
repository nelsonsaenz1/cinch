import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PickerFooterTray, PiecePicker } from '@/components/share-look/piece-picker';
import { Button, ScreenHeader, Text } from '@/components/ui';
import { useToast } from '@/components/ui/toast-host';
import { AX_STACK_SCALE } from '@/features/closet/dynamic-type';
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
 *
 * ── WHY THE GRID SCROLLS AND THE FOOTER IS MEASURED ───────────────────────
 *
 * The first cut put `PiecePicker` — a wrapping grid of every garment a person
 * owns — inside a plain `flex-1` View with the tray and the two buttons under
 * it. A React Native View does not clip its overflow on iOS, so a closet of
 * any real size drew straight through the tray and the buttons: garment names
 * printed over "N pieces, in this order", the Compose ground sat on top of a
 * plate, and every row past the first screenful was unreachable at ANY type
 * size. That is directive #36's "sticky action panel overlays the item grid".
 *
 * So the grid scrolls, and the footer is a measured panel the scroll content
 * is inset by — `wall-swap.tsx`'s pattern, which is the one this app already
 * uses for a bottom panel over a list. The inset is the panel's REAL rendered
 * height, read from `onLayout`, not a constant: the panel holds two stacked
 * buttons and a status line that all grow with Dynamic Type, so any number
 * typed here would be wrong at some setting.
 *
 * At `AX_STACK_SCALE` and above the panel stops being a panel. Two 56 pt-plus
 * buttons, a status line and a tray at AX5 are most of an iPhone SE's
 * viewport; pinned to the bottom they would leave a sliver of grid to pick
 * from. Above the threshold the same controls ride at the end of the scroll —
 * the whole viewport is the grid, and the actions are where the content ends.
 */
export default function ComposeScreen() {
  const toast = useToast();
  const wardrobe = useWardrobe();
  const compose = useComposeOwnOutfit();

  const [stack, setStack] = useState<Garment[]>([]);
  const [refused, setRefused] = useState(false);
  const [saving, setSaving] = useState<'wear' | 'save' | null>(null);
  /** The footer's real rendered height, so the grid can end above it. */
  const [footerHeight, setFooterHeight] = useState(0);

  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const ax = fontScale >= AX_STACK_SCALE;

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

  /**
   * The tray and the two exits, as one block.
   *
   * The tray runs with `showAction={false}`: on the board wizard its Compose
   * button is the step-nav, but here "Wear it today" IS composing, so shipping
   * both put two filled primaries a thumb's width apart saying different words
   * for the same act. The tray keeps the job only it does — the running count,
   * the bounds before they are hit, and the refusal.
   */
  const actions = (
    <>
      <PickerFooterTray
        stack={stack}
        resolveImage={resolve}
        canCompose={canCompose(stack)}
        onCompose={() => submit(true)}
        showAction={false}
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
    </>
  );

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader title="Compose your own" onBack={() => router.back()} />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-gutter"
        contentContainerStyle={{
          paddingBottom: ax ? insets.bottom + 16 : footerHeight + 16,
        }}>
        <Text variant="body" className="mt-1 text-muted">
          Pick the pieces you’re wearing — or want to remember together.
        </Text>

        <View className="mt-4">
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

        {ax ? <View className="mt-6">{actions}</View> : null}
      </ScrollView>

      {ax ? null : (
        <View
          className="absolute inset-x-0 bottom-0 bg-canvas px-gutter"
          style={{ paddingBottom: insets.bottom }}
          onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}>
          {actions}
        </View>
      )}
    </SafeAreaView>
  );
}
