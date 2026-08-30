import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ScreenHeader, Text } from '@/components/ui';
import { useToast } from '@/components/ui/toast-host';
import { pieceName } from '@/features/closet/item-name';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { useSaveRecreatedLook } from '@/features/recreate/save-look';
import type { PieceMatch } from '@/features/recreate/types';
import { useRecreate, type RecreateFailure } from '@/features/recreate/use-recreate';
import { useWardrobe } from '@/features/styling/queries';
import { track } from '@/lib/posthog';
import { useTheme } from '@/theme/tokens';

/**
 * Recreate this look — upload inspiration, see your version.
 *
 * The whole promise is on one screen: a saved screenshot goes up, the pieces
 * the model read come back, and each is answered FROM THE CLOSET — a real
 * garment tile, or an honest gap card. Nothing here shops, nothing names a
 * brand, and the flow never invents a piece: `match.ts` can only rank
 * garments it was handed, and a piece below the threshold is shown as
 * missing rather than papered over. That refusal is the feature.
 *
 * Layout in the app's own reading order: eyebrow, one serif line, then the
 * work. The inspiration photograph is kept small once results land — the
 * person has seen it; the closet's answer is the content.
 */

const FAILURE_COPY: Record<RecreateFailure, { title: string; body: string }> = {
  consent: {
    title: 'AI processing is off',
    body: 'Reading a photo means sending it for analysis. Turn on AI processing in Privacy & data first.',
  },
  quota: {
    title: 'That’s this month’s allowance',
    body: 'Look analysis resets monthly. Your saved photo is still in your library — bring it back then.',
  },
  disabled: {
    title: 'Analysis is taking a break',
    body: 'This isn’t you — the analysis service is off right now. Try again later.',
  },
  offline: {
    title: 'No connection',
    body: 'Reading a photo needs the network. Your closet is untouched — try again when you’re back.',
  },
  unreadable: {
    title: 'Could not read that one',
    body: 'A clearer, closer shot of the outfit works best. Screenshots are fine.',
  },
  unauthorized_source: {
    title: 'That one can’t be read',
    body: 'Cinch doesn’t have permission to send this picture for analysis. A photo from your own library works.',
  },
};

export default function RecreateScreen() {
  const theme = useTheme();
  const toast = useToast();
  const wardrobe = useWardrobe();
  const { phase, start, reset } = useRecreate(wardrobe.data ?? []);
  const save = useSaveRecreatedLook();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    track('recreate_opened');
  }, []);

  const done = phase.kind === 'done';
  const matches = done ? phase.result.matches : [];
  const matchedItems = done ? phase.result.matchedItems : [];

  // Sign every matched garment's best display path in one batch.
  const paths = matches.map((m) =>
    m.item ? (m.item.platePath ?? m.item.cutoutPath ?? m.item.thumbPath) : null,
  );
  const signed = useSignedUrls(paths);

  const onSave = () => {
    save.mutate(
      { itemIds: matchedItems.map((g) => g.id), name: 'Recreated look' },
      {
        onSuccess: () => {
          setSaved(true);
          toast.show('Saved to your outfits');
        },
        onError: () => toast.show('Couldn’t save — try again'),
      },
    );
  };

  const tryAnother = () => {
    setSaved(false);
    save.reset();
    reset();
    void start();
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'bottom']}>
      <ScreenHeader title="Style inspiration" onBack={() => router.back()} />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-gutter pb-10 pt-4"
        showsVerticalScrollIndicator={false}>
        {phase.kind === 'idle' ? (
          <>
            <Text variant="eyebrow">From a photo you saved</Text>
            <Text variant="title" trim className="mt-3">
              Saw a look you loved?
            </Text>
            <Text variant="body" className="mt-2 text-muted">
              Screenshot it, drop it here. Cinch rebuilds the look from clothes you already
              own — and says so, honestly, where nothing comes close.
            </Text>

            <View
              className="mt-8 items-center justify-center rounded-lg border border-rule"
              style={{ height: 220 }}>
              <SymbolView
                name="photo.on.rectangle.angled"
                size={40}
                tintColor={theme.muted}
                resizeMode="scaleAspectFit"
              />
              <Text variant="note" className="mt-3 text-muted">
                Outfit photos and screenshots both work.
              </Text>
            </View>

            <View className="mt-6">
              <Button title="Choose a photo" onPress={() => void start()} />
            </View>
            <Text variant="note" className="mt-3 text-muted">
              Cinch names the pieces. Your phone does the matching — the closet never leaves it.
            </Text>
          </>
        ) : null}

        {phase.kind === 'uploading' || phase.kind === 'analyzing' ? (
          <>
            <Text variant="eyebrow">
              {phase.kind === 'uploading' ? 'Sending the photo' : 'Reading the look'}
            </Text>
            <View className="mt-4 overflow-hidden rounded-lg border border-rule">
              <Image
                source={{ uri: phase.candidate.imageUri }}
                style={{ width: '100%', height: 320 }}
                contentFit="cover"
                accessibilityIgnoresInvertColors
              />
            </View>
            <View className="mt-6 flex-row items-center gap-3">
              <ActivityIndicator color={theme.accent} />
              <Text variant="body" className="flex-1 text-muted">
                {phase.kind === 'uploading'
                  ? 'On its way…'
                  : 'Naming each piece, then checking your closet…'}
              </Text>
            </View>
          </>
        ) : null}

        {phase.kind === 'empty' ? (
          <>
            <Text variant="title" trim className="mt-3">
              No outfit to read in that one
            </Text>
            <Text variant="body" className="mt-2 text-muted">
              Cinch couldn’t make out any clothes. A shot where the outfit fills more of the
              frame reads best.
            </Text>
            <View className="mt-6">
              <Button title="Try another photo" onPress={tryAnother} />
            </View>
          </>
        ) : null}

        {phase.kind === 'error' ? (
          <>
            <Text variant="title" trim className="mt-3">
              {FAILURE_COPY[phase.cause].title}
            </Text>
            <Text variant="body" className="mt-2 text-muted">
              {FAILURE_COPY[phase.cause].body}
            </Text>
            {phase.cause !== 'quota' ? (
              <View className="mt-6">
                <Button title="Try again" onPress={tryAnother} />
              </View>
            ) : null}
          </>
        ) : null}

        {done ? (
          <>
            <View className="flex-row items-center gap-4">
              <View className="overflow-hidden rounded-md border border-rule">
                <Image
                  source={{ uri: phase.candidate.imageUri }}
                  style={{ width: 88, height: 118 }}
                  contentFit="cover"
                  accessibilityIgnoresInvertColors
                  accessibilityLabel="The inspiration photo"
                />
              </View>
              <View className="flex-1">
                <Text variant="eyebrow">Your version</Text>
                <Text variant="title" trim className="mt-2">
                  {phase.result.gapCount === 0
                    ? 'All from your closet'
                    : `${matchedItems.length} of ${matches.length} from your closet`}
                </Text>
              </View>
            </View>

            <View className="mt-6 gap-3">
              {matches.map((m, i) => (
                <MatchRow key={i} match={m} url={m.item ? (signed.urls[paths[i] ?? ''] ?? null) : null} />
              ))}
            </View>

            {matchedItems.length >= 2 && !saved ? (
              <View className="mt-8">
                <Button title="Save this look" loading={save.isPending} onPress={onSave} />
              </View>
            ) : null}
            {matchedItems.length === 1 && !saved ? (
              <Text variant="note" className="mt-8 text-muted">
                One piece isn’t a look yet — it’s saved in your closet already, so nothing is
                lost.
              </Text>
            ) : null}
            <View className="mt-3">
              <Button title="Try another photo" variant="ghost" onPress={tryAnother} />
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * One piece of the inspiration, answered. A garment tile with the analysis's
 * own sentence under it — or the honest gap, worded as a fact about the
 * closet rather than a failure of the person.
 */
function MatchRow({ match, url }: { match: PieceMatch; url: string | null }) {
  const theme = useTheme();

  if (!match.item) {
    return (
      <View className="rounded-md border border-rule px-4 py-3">
        <View className="flex-row items-center gap-3">
          <SymbolView
            name="questionmark.circle"
            size={18}
            tintColor={theme.muted}
            resizeMode="scaleAspectFit"
          />
          <Text variant="label" className="flex-1 text-muted">
            Nothing close in your closet
          </Text>
        </View>
        <Text variant="note" className="mt-2 text-muted">
          {match.piece.description}
        </Text>
      </View>
    );
  }

  return (
    <View
      className="flex-row items-center gap-3 rounded-md border border-rule px-3 py-3"
      accessible
      accessibilityLabel={`${pieceName(match.item)}, standing in for: ${match.piece.description}`}>
      <View
        className="items-center justify-center overflow-hidden rounded-sm bg-tray"
        style={{ width: 64, height: 64 }}>
        {url ? (
          <Image
            source={{ uri: url }}
            style={{ width: 64, height: 64 }}
            contentFit="contain"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <SymbolView name="tshirt" size={22} tintColor={theme.muted} resizeMode="scaleAspectFit" />
        )}
      </View>
      <View className="flex-1">
        <Text variant="label">{pieceName(match.item)}</Text>
        <Text variant="note" className="mt-1 text-muted" numberOfLines={2}>
          {match.piece.description}
        </Text>
      </View>
    </View>
  );
}
