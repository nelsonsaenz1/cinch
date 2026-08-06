import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LookStack, PlateTriptych, lookName } from '@/components/event-outfits/OutfitPostCard';
import { PostComposer } from '@/components/event-outfits/PostComposer';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/use-session';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { useEventPosts, useMyPostableOutfits } from '@/features/event-outfits/queries';
import { socialErrorMessage, usePostOutfit } from '@/features/event-outfits/mutations';
import { MAX_LOOKS_PER_BOARD } from '@/features/event-outfits/types';
import { useWardrobe } from '@/features/styling/queries';
import type { Garment } from '@/lib/styling';
import { useTheme } from '@/theme/tokens';

/**
 * Pick one of MY outfits to share with the event — never a camera, never an
 * upload. The list is the caller's own saved outfits read under owner RLS;
 * the garments come from the wardrobe cache the styling engine already keeps
 * warm. Posting is publication to the event's audience, and the composer
 * says so in words before the button.
 */
export default function PostLookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = id ?? null;
  const router = useRouter();
  const theme = useTheme();
  const session = useSession();

  const outfits = useMyPostableOutfits();
  const wardrobe = useWardrobe();
  const posts = useEventPosts(eventId);
  const postOutfit = usePostOutfit();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const garmentById = useMemo(
    () => new Map((wardrobe.data ?? []).map((g) => [g.id, g])),
    [wardrobe.data],
  );

  /** Outfit id -> its garments, dropping pieces that left the closet. */
  const garmentsFor = (itemIds: string[]): Garment[] =>
    itemIds.map((iid) => garmentById.get(iid)).filter((g): g is Garment => Boolean(g));

  const myLooks = (posts.data?.looks ?? []).filter((l) => l.userId === session.userId);
  const postedOutfitIds = new Set((posts.data?.looks ?? []).map((l) => l.outfitId));
  const atCap = myLooks.length >= MAX_LOOKS_PER_BOARD;

  const candidates = (outfits.data ?? []).filter((o) => garmentsFor(o.itemIds).length > 0);
  const selected = candidates.find((o) => o.id === selectedId) ?? null;
  const selectedGarments = selected ? garmentsFor(selected.itemIds) : [];

  const { resolve } = useSignedUrls(
    candidates.flatMap((o) =>
      garmentsFor(o.itemIds).flatMap((g) => [g.platePath, g.cutoutPath, g.thumbPath]),
    ),
  );

  const submit = (caption: string | null) => {
    if (!eventId || !selected) return;
    postOutfit.mutate(
      { eventId, outfitId: selected.id, caption },
      {
        onSuccess: () => router.back(),
        onError: (error) => Alert.alert('That didn’t post', socialErrorMessage(error)),
      },
    );
  };

  const loading = outfits.isLoading || wardrobe.isLoading || posts.isLoading;

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="flex-row items-center gap-3 px-gutter pt-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full border border-rule active:opacity-60">
          <SymbolView name="chevron.left" size={15} tintColor={theme.ink} resizeMode="scaleAspectFit" />
        </Pressable>
        <Text variant="colophon">Share a look</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={theme.muted} />
        </View>
      ) : candidates.length === 0 ? (
        <EmptyState
          symbol="hanger"
          title="No saved looks yet"
          body="Save an outfit from Today or build one in your closet, then share it with the table."
          actionTitle="Back"
          onAction={() => router.back()}
        />
      ) : (
        <ScrollView contentContainerClassName="px-gutter pb-24">
          <Text variant="title" trim className="mt-5">
            Which one for the table?
          </Text>

          {atCap ? (
            <Text variant="label" className="mt-3" style={{ color: theme.warning }}>
              Three looks is the board’s limit — retire one first to share
              another.
            </Text>
          ) : null}

          <View className="mt-5 gap-3">
            {candidates.map((outfit) => {
              const garments = garmentsFor(outfit.itemIds);
              const posted = postedOutfitIds.has(outfit.id);
              const isSelected = selectedId === outfit.id;
              return (
                <Pressable
                  key={outfit.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected, disabled: posted }}
                  accessibilityLabel={outfit.name ?? lookName(garments, null)}
                  disabled={posted}
                  onPress={() => setSelectedId(isSelected ? null : outfit.id)}
                  className={[
                    'rounded-plate border bg-surface p-3.5 active:opacity-70',
                    isSelected ? 'border-ink' : 'border-hairline',
                    posted ? 'opacity-40' : '',
                  ].join(' ')}>
                  <View className="flex-row items-center gap-3">
                    <PlateTriptych garments={garments} resolveImage={resolve} cell={44} />
                    <View className="flex-1">
                      <Text variant="body" numberOfLines={1}>
                        {outfit.name ?? lookName(garments, null)}
                      </Text>
                      <Text variant="caption" numberOfLines={1} className="mt-0.5">
                        {posted
                          ? 'Already on the board'
                          : outfit.occasion ?? `${garments.length} pieces`}
                      </Text>
                    </View>
                    {isSelected ? (
                      <SymbolView
                        name="checkmark.circle.fill"
                        size={18}
                        tintColor={theme.ink}
                        resizeMode="scaleAspectFit"
                      />
                    ) : null}
                  </View>

                  {isSelected ? (
                    <View className="mt-4">
                      <LookStack
                        garments={garments}
                        resolveImage={resolve}
                        label={`Preview: ${outfit.name ?? lookName(garments, null)}`}
                      />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          {selected && selectedGarments.length > 0 ? (
            <View className="mt-6">
              <PostComposer
                pending={postOutfit.isPending}
                disabled={atCap || postOutfit.isPending}
                onSubmit={submit}
              />
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
