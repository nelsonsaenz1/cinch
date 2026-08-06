import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { stableImageSource } from '@/features/closet/use-image-urls';
import { useGarmentSearchFlow, type GarmentCandidate } from '@/features/ingest/use-garment-search';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * Describing a garment instead of photographing it.
 *
 * The screen exists because of one number: most people who install a wardrobe
 * app never finish adding their clothes. Photographing forty garments on a
 * hanger is a chore, and the app is useless until it is done. Typing "Reformation
 * midi dress, size 2, navy" is not.
 *
 * THE PROMISE THIS SCREEN MAKES IS SMALL ON PURPOSE. It offers found pictures,
 * not certainty — so the copy says "pictures that might match", the tiles carry
 * the site they came from, and nothing is added until a person taps the right
 * one. An app that quietly picked the top result would fill closets with the
 * wrong dress and be trusted exactly once.
 *
 * One oxblood element, as everywhere: the Find button. The chosen tile is
 * marked in ink, the source labels are faint, and the rest is canvas.
 */

const PLACEHOLDER = 'Reformation midi dress, size 2, navy…';

/** Mirrors the server's own ceiling, so the field cannot compose a rejection. */
const MAX_DESCRIPTION_CHARS = 240;

export function GarmentSearchSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();
  const flow = useGarmentSearchFlow();

  // A sheet that reopens holding the last search would be showing results for a
  // garment already added. Clearing on open, not on close, keeps the dismissal
  // animation from playing over a suddenly empty screen.
  useEffect(() => {
    if (visible) flow.reset();
    // Keyed on `visible` alone, deliberately. `reset` closes over the two
    // mutations, whose identity changes on every state transition they make —
    // listing it would clear the results in the same tick they arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const canSearch = flow.description.trim().length >= 3 && !flow.searching;

  // On a successful import the sheet simply gets out of the way. The garment
  // joins the capture queue behind it (see `useGarmentImport`), so what the
  // user drops back onto is the progress rail with their piece on it — not a
  // review deck that cannot see an untagged row yet.
  const choose = async (candidate: GarmentCandidate) => {
    const itemId = await flow.choose(candidate);
    if (itemId) onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark">
        <View className="flex-row items-start justify-between px-gutter pt-6">
          <View className="flex-1 pr-4">
            <Text variant="title" trim>
              Describe it instead
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={12}
            onPress={onClose}
            className="py-1">
            <Text variant="body" className="font-semibold">
              Close
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerClassName="px-gutter pb-10 pt-4"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          <Text variant="body" className="text-muted dark:text-muted-dark">
            Say what it is — the brand, the kind of garment, the colour. Cinch looks for pictures
            that might match, and you pick the right one.
          </Text>

          <View className="mt-5 rounded-plate border border-rule px-4 py-3 dark:border-rule-dark">
            <TextInput
              accessibilityLabel="What is the garment"
              value={flow.description}
              onChangeText={flow.setDescription}
              placeholder={PLACEHOLDER}
              placeholderTextColor={theme.faint}
              maxLength={MAX_DESCRIPTION_CHARS}
              multiline
              returnKeyType="search"
              submitBehavior="blurAndSubmit"
              onSubmitEditing={() => {
                if (canSearch) void flow.run();
              }}
              // The field carries body type like everything else; the colour is
              // inline because NativeWind gives no guaranteed precedence
              // between two text utilities on one element.
              style={{ color: theme.ink, fontSize: 17, minHeight: 66, textAlignVertical: 'top' }}
            />
          </View>

          {/* The colour photo is genuinely optional and reads that way: a quiet
              row, not a second call to action. It exists because "navy" covers
              a dozen navies and a photograph of the actual fabric settles it. */}
          {flow.swatch ? (
            <View className="mt-3 flex-row items-center gap-3">
              <Image
                source={stableImageSource(flow.swatch.uri)}
                contentFit="cover"
                style={{ width: 44, height: 44, borderRadius: 8 }}
                accessibilityIgnoresInvertColors
              />
              <Text variant="label" className="flex-1">
                Colour photo attached
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove colour photo"
                hitSlop={12}
                onPress={flow.clearSwatch}>
                <Text variant="label">Remove</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add a photo of the colour"
              onPress={() => void flow.attachSwatch()}
              style={{ minHeight: MIN_TAP_TARGET }}
              className="mt-2 flex-row items-center gap-2 active:opacity-70">
              <SymbolView name="camera" size={15} tintColor={theme.muted} resizeMode="scaleAspectFit" />
              <Text variant="label">Add a photo of the colour</Text>
            </Pressable>
          )}

          <Button
            title={flow.searching ? 'Looking' : 'Find it'}
            onPress={() => void flow.run()}
            disabled={!canSearch}
            loading={flow.searching}
            haptic
            className="mt-4 self-stretch"
          />

          {flow.errorMessage ? (
            <Text variant="caption" className="mt-3" style={{ color: theme.critical }}>
              {flow.errorMessage}
            </Text>
          ) : null}

          <Results flow={flow} onChoose={choose} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// Ragged caption widths, so the placeholder grid reads as product titles about
// to arrive rather than a loading graphic.
const TILE_LABEL_WIDTHS = ['72%', '55%', '64%', '48%'] as const;

/**
 * The candidate grid, and the two honest ways it can be empty.
 *
 * `results === null` means no search has run — nothing is said, because there is
 * nothing to say yet. An empty array means the search ran and found nothing
 * usable, which deserves a real sentence and a way forward rather than a shrug.
 * While the search is out, the grid's own shape stands in for it — the tiles
 * the results will land in, not a spinner floating in nothing.
 */
function Results({
  flow,
  onChoose,
}: {
  flow: ReturnType<typeof useGarmentSearchFlow>;
  onChoose: (candidate: GarmentCandidate) => void;
}) {
  if (flow.searching) {
    return (
      <View className="mt-8" accessibilityLabel="Looking for pictures">
        <Text variant="eyebrow">Pictures that might match</Text>
        <View className="mt-3 flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
          {TILE_LABEL_WIDTHS.map((width, i) => (
            <View key={i} className="mb-4" style={{ width: '50%', paddingHorizontal: 6 }}>
              <Skeleton className="aspect-[4/5] w-full rounded-lg" />
              <Skeleton className="mt-2 h-3 rounded-chip" style={{ width }} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (flow.results === null) return null;

  if (flow.results.length === 0 && !flow.searching) {
    return (
      <View className="mt-8">
        <Text variant="plate">Nothing matched that</Text>
        <Text variant="body" className="mt-2 text-muted dark:text-muted-dark">
          Try the brand and the kind of garment — {'“'}Everlane cotton shirt{'”'} finds
          more than {'“'}blue top{'”'}. Photographing it works too, and always finds the
          right one.
        </Text>
      </View>
    );
  }

  return (
    <View className="mt-8">
      <Text variant="eyebrow">Pictures that might match</Text>

      {/* Two columns, hand-laid rather than a FlatList: six tiles inside a
          ScrollView do not want a second scroll container, and a nested
          VirtualizedList is a warning and a broken gesture. */}
      <View className="mt-3 flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
        {flow.results.map((candidate) => (
          <CandidateTile
            key={candidate.imageUrl}
            candidate={candidate}
            busy={flow.importingUrl === candidate.imageUrl}
            dimmed={flow.importingUrl !== null && flow.importingUrl !== candidate.imageUrl}
            onPress={() => onChoose(candidate)}
          />
        ))}
      </View>

      <Text variant="caption" className="mt-4">
        Tap one to add it. Cinch saves the picture and tags the garment for you.
      </Text>
    </View>
  );
}

function CandidateTile({
  candidate,
  busy,
  dimmed,
  onPress,
}: {
  candidate: GarmentCandidate;
  busy: boolean;
  dimmed: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Add ${candidate.title}, from ${candidate.source}`}
      accessibilityState={{ busy, disabled: dimmed }}
      disabled={dimmed || busy}
      onPress={onPress}
      style={{ width: '50%', paddingHorizontal: 6, opacity: dimmed ? 0.4 : 1 }}
      className="mb-4 active:opacity-80">
      {/* Product shots arrive on white with wide margins, so the tray sits
          behind them and `contain` keeps the garment whole rather than cropping
          a sleeve off to fill a square. */}
      <View className="aspect-[4/5] w-full overflow-hidden rounded-lg bg-tray dark:bg-tray-dark">
        <Image
          source={stableImageSource(candidate.imageUrl)}
          contentFit="contain"
          transition={180}
          cachePolicy="memory-disk"
          style={{ flex: 1 }}
          accessibilityIgnoresInvertColors
        />
        {busy ? (
          <View
            className="absolute inset-0 items-center justify-center"
            style={{ backgroundColor: 'rgba(251,250,246,0.72)' }}>
            <ActivityIndicator color={theme.ink} />
          </View>
        ) : null}
      </View>

      <Text variant="caption" numberOfLines={2} className="mt-2" style={{ color: theme.ink }}>
        {candidate.title}
      </Text>
      {/* The source is the honesty line: this picture came from somewhere, and
          the user gets to judge whether that somewhere is the right shop. */}
      <Text variant="colophon" numberOfLines={1}>
        {candidate.source}
      </Text>
    </Pressable>
  );
}
