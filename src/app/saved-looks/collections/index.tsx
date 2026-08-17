import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SavedErrorState } from '@/components/saved-looks';
import { Card } from '@/components/ui/card';
import { PressableSurface } from '@/components/ui/pressable-surface';
import { ScreenHeader } from '@/components/ui/screen-header';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { COLLECTIONS, SAVED_TITLE, collectionCountLine } from '@/features/saved-looks/copy';
import { useSavedCollections, useSavedLooks, withSavedCounts } from '@/features/saved-looks/queries';
import { collectionCounts } from '@/features/saved-looks/states';
import { useTheme } from '@/theme/tokens';

/**
 * OS-05a — the collections, and the two things you can do to one.
 *
 * ── THE COUNTS COME FROM THE SAVES, NOT FROM THE SERVER ────────────────────
 *
 * `collectionCounts` over the loaded list. A server count would be a second
 * number that can disagree with the grid one tap away, and a wrong number beside
 * a right list is read as the list being wrong. It costs nothing: the saves are
 * already cached by the screen the reader just came from.
 *
 * ── THE HINT IS DRAWN EVEN THOUGH THIS SCREEN HAS NO SWIPE ─────────────────
 *
 * OS-05a's sentence — "Swipe a collection, or tap into it, to rename or delete"
 * — is kept verbatim because its SECOND clause is the one that matters, and it
 * is the one this screen implements. §9's rule is that every gesture has a
 * visible control and that "there is no action reachable only by gesture"; here
 * the visible control is the only control, which satisfies the rule in the
 * stronger direction. The row is the door; rename and delete both live behind it.
 *
 * Its third sentence — "Deleting a collection keeps its looks in Saved" — is
 * printed BEFORE anybody taps Delete, which is the point of having it at all.
 * The confirm sheet says it again with the real number; this says it while the
 * reader is still deciding whether to go in.
 *
 * ── AN EMPTY COLLECTION IS DRAWN ───────────────────────────────────────────
 *
 * `useSavedCollections` returns every board, including the ones with nothing in
 * them. One made thirty seconds ago on the way to filling it is a real thing,
 * and a list that hid it would look like the creation had failed.
 */
export default function SavedCollectionsScreen() {
  const router = useRouter();
  const theme = useTheme();

  const collections = useSavedCollections();
  const saves = useSavedLooks();

  const shelves = useMemo(
    () => withSavedCounts(collections.data ?? [], collectionCounts(saves.data ?? [])),
    [collections.data, saves.data],
  );

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/saved-looks');
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader title={COLLECTIONS.title} align="leading" onBack={back} backLabel={SAVED_TITLE} />

      <ScrollView contentContainerClassName="px-gutter pb-24">
        <Text variant="display" trim accessibilityRole="header" className="mt-3">
          {COLLECTIONS.title}
        </Text>

        {collections.isLoading ? (
          <View className="mt-6">
            <ListSkeleton count={3} avatar={false} />
          </View>
        ) : collections.isError ? (
          <SavedErrorState
            onRetry={() => void collections.refetch()}
            retrying={collections.isRefetching}
          />
        ) : (
          <>
            {shelves.length > 0 ? (
              <>
                <Text variant="eyebrow" className="mt-6 text-muted">
                  {COLLECTIONS.section}
                </Text>
                <Card className="mt-2">
                  {shelves.map((shelf) => (
                    <PressableSurface
                      key={shelf.id}
                      onPress={() =>
                        router.push({
                          pathname: '/saved-looks/collections/[collectionId]',
                          params: { collectionId: shelf.id },
                        })
                      }
                      accessibilityRole="button"
                      // One sentence: the name and its count are one fact, and
                      // swiping through two fragments of it is worse than
                      // hearing it once.
                      accessibilityLabel={`${shelf.name}, ${collectionCountLine(shelf.savedCount)}`}
                      accessibilityHint="Opens rename and delete"
                      className="py-3"
                      contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View className="flex-1 gap-1">
                        <Text variant="label">{shelf.name}</Text>
                        <Text variant="caption" className="text-muted">
                          {collectionCountLine(shelf.savedCount)}
                        </Text>
                      </View>
                      <SymbolView name="chevron.right" size={14} tintColor={theme.faint} />
                    </PressableSurface>
                  ))}
                </Card>
              </>
            ) : null}

            <PressableSurface
              onPress={() => router.push('/saved-looks/collections/new')}
              accessibilityRole="button"
              accessibilityLabel={COLLECTIONS.create}
              className="mt-4 rounded-md border border-sand bg-surface p-3"
              contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <SymbolView name="plus" size={16} tintColor={theme.accent} />
              <Text variant="label" className="text-accent">
                {COLLECTIONS.create}
              </Text>
            </PressableSurface>

            <Text variant="caption" className="mt-4 text-muted">
              {COLLECTIONS.hint}
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
