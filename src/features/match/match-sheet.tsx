import { Image } from 'expo-image';
import { useEffect } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { SearchField } from '@/components/ui/search-field';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { stableImageSource } from '@/features/closet/use-image-urls';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

import { useMatchFlow, type MatchCandidate } from './use-match';

/**
 * Finding the listing photo — the shop's own product shot for a garment the
 * user already photographed.
 *
 * The sheet's one promise is that nothing changes until a person says so: the
 * search runs the moment it opens, the candidates are offered as pictures that
 * might be the listing, and the item is untouched until "Use this photo" lands.
 * Every state carries the quiet exit — "Keep my photo" — because their own
 * photograph is never the failure case here; it is the thing that already
 * works, and the header must keep saying so.
 *
 * One oxblood element: "Use this photo". The refinement chips select in ink for
 * exactly that reason — a row of accent-filled chips above an accent button
 * would be a screen spending its one action colour three times.
 *
 * Presented as a `Modal` pageSheet, the grammar `GarmentSearchSheet` and the
 * profile sheets already use for a self-contained flow. Route-level `formSheet`
 * would mean registering the screen in app/_layout.tsx, which belongs to other
 * work; a component sheet needs nothing outside this feature.
 */

/** Ragged caption widths, same reasoning as the describe sheet's skeleton. */
const TILE_LABEL_WIDTHS = ['72%', '55%', '64%', '48%'] as const;

export function MatchSheet({
  visible,
  itemId,
  onClose,
}: {
  visible: boolean;
  itemId: string;
  onClose: () => void;
}) {
  const flow = useMatchFlow(itemId);

  // The search starts when the sheet opens — there is nothing to type first,
  // the item itself is the query. Keyed on `visible` alone, deliberately:
  // `start` closes over the mutations, whose identity changes on every state
  // transition they make, and listing it would clear results as they arrive.
  useEffect(() => {
    if (visible) flow.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <MatchSheetBody flow={flow} onClose={onClose} />
    </Modal>
  );
}

/** The flow object the body renders from — posable, same split as the describe sheet. */
export type MatchFlowView = ReturnType<typeof useMatchFlow>;

/**
 * Everything inside the modal, taking the flow as a prop rather than owning it,
 * so a fixture can pose every state without a search running.
 */
export function MatchSheetBody({ flow, onClose }: { flow: MatchFlowView; onClose: () => void }) {
  const theme = useTheme();

  const confirm = async () => {
    const landed = await flow.confirm();
    if (landed) onClose();
  };

  const hasResults = flow.candidates !== null && flow.candidates.length > 0;
  const cameBackEmpty = flow.candidates !== null && flow.candidates.length === 0 && !flow.searching;
  // Refinement is a way FORWARD, so it appears wherever there is a result to
  // refine or an empty answer to argue with — never over the skeleton, where
  // re-running a search already in flight would double-spend the allowance,
  // and never over a failure, whose own state already offers the retry.
  const showRefinement = !flow.searching && flow.candidates !== null;

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark">
      <View className="flex-row items-start justify-between px-gutter pt-6">
        <View className="flex-1 pr-4">
          <Text variant="title" trim>
            Find the listing photo
          </Text>
        </View>
        {/* The always-present exit. Named for what it DOES — nothing — rather
            than "Close": leaving this sheet is choosing the photo they already
            have, and the label should make that a decision, not an escape. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Keep my photo"
          accessibilityHint="Closes without changing this piece"
          disabled={flow.attaching}
          hitSlop={12}
          onPress={onClose}
          className="py-1 active:opacity-60">
          <Text variant="body" className="font-semibold">
            Keep my photo
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerClassName="px-gutter pb-10 pt-4"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <Text variant="body" className="text-muted dark:text-muted-dark">
          Cinch looks for the shop{'’'}s own photograph of this piece. Nothing changes until you
          choose one — your photo stays either way.
        </Text>

        {flow.errorMessage ? (
          <View className="mt-4">
            <Text variant="caption" accessibilityLiveRegion="polite" style={{ color: theme.critical }}>
              {flow.errorMessage}
            </Text>
            <Button
              title="Try again"
              variant="secondary"
              onPress={flow.retry}
              haptic
              className="mt-3 self-stretch"
            />
          </View>
        ) : null}

        {flow.searching ? <SearchingGrid /> : null}

        {hasResults && flow.candidates ? (
          <View className="mt-8">
            <SectionHeader title="From the shops" />
            {/* Two columns, hand-laid rather than a FlatList — same reasoning
                as the describe sheet: a VirtualizedList nested in this
                ScrollView is a warning and a broken gesture. */}
            <View className="mt-3 flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
              {flow.candidates.map((candidate) => (
                <CandidateTile
                  key={candidate.imageUrl}
                  candidate={candidate}
                  selected={flow.selected?.imageUrl === candidate.imageUrl}
                  dimmed={flow.attaching && flow.selected?.imageUrl !== candidate.imageUrl}
                  onPress={() => flow.choose(candidate)}
                />
              ))}
            </View>
            <Text variant="caption" className="mt-1">
              Tap the one that matches. The photo you took is kept alongside it.
            </Text>
          </View>
        ) : null}

        {cameBackEmpty ? (
          <View className="mt-8">
            <Text variant="plate">Nothing close enough</Text>
            <Text variant="body" className="mt-2 text-muted dark:text-muted-dark">
              Your photo stays. Naming the brand below sometimes finds what a broad search
              misses.
            </Text>
          </View>
        ) : null}

        {showRefinement ? (
          <BrandRefinement flow={flow} />
        ) : null}

        {hasResults ? (
          // The screen's ONE oxblood. Present from the first result and simply
          // waiting while nothing is selected, so choosing and confirming read
          // as one gesture in two halves rather than a button that appears.
          <Button
            title="Use this photo"
            onPress={() => void confirm()}
            disabled={!flow.selected || flow.attaching}
            loading={flow.attaching}
            haptic
            className="mt-6 self-stretch"
          />
        ) : null}

        {cameBackEmpty ? (
          <Button
            title="Keep my photo"
            variant="ghost"
            onPress={onClose}
            haptic
            className="mt-6 self-stretch"
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * The searching state — the grid the results will land in, not a spinner and
 * not a progress bar. There is no honest percentage for a web search, so
 * nothing here pretends to one.
 */
function SearchingGrid() {
  return (
    <View className="mt-8" accessibilityLabel="Looking through the shops">
      <SectionHeader title="From the shops" />
      <View className="mt-3 flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
        {TILE_LABEL_WIDTHS.map((width, i) => (
          <View key={i} className="mb-4" style={{ width: '50%', paddingHorizontal: 6 }}>
            <Skeleton className="aspect-[4/5] w-full rounded-lg" delay={i * 120} />
            <Skeleton className="mt-2 h-3 rounded-chip" style={{ width }} />
            <Skeleton className="mt-1.5 h-2.5 w-2/5 rounded-chip" />
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Narrowing the search to one brand — the chips the function suggested, plus a
 * field for the brand it did not. Choosing either re-runs the match scoped to
 * that brand; tapping the active chip again widens it back out.
 *
 * `SearchField` exposes no submit handler, so the typed brand gets a labelled
 * row beneath the field rather than relying on the keyboard's search key —
 * a control that exists is one VoiceOver can find.
 */
function BrandRefinement({ flow }: { flow: MatchFlowView }) {
  const theme = useTheme();
  const typed = flow.brandQuery.trim();

  return (
    <View className="mt-8">
      <SectionHeader title="Narrow by brand" />

      {flow.brands.length > 0 ? (
        <View className="mt-3 flex-row flex-wrap" style={{ gap: 8 }}>
          {flow.brands.map((brand) => (
            <Chip
              key={brand}
              label={brand}
              selected={flow.activeBrand === brand}
              // Ink, not the accent default: the confirm button below holds
              // the screen's one oxblood, and a selected chip must not compete.
              selectedGround="ink"
              onPress={() => flow.refine(brand)}
              accessibilityHint="Searches again within this brand"
            />
          ))}
        </View>
      ) : null}

      <SearchField
        value={flow.brandQuery}
        onChangeText={flow.setBrandQuery}
        placeholder="Or type a brand"
        autoCapitalize="words"
        autoCorrect={false}
        className="mt-3"
      />

      {typed ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Search within ${typed}`}
          onPress={flow.submitBrandQuery}
          style={{ minHeight: MIN_TAP_TARGET }}
          className="mt-1 flex-row items-center gap-2 active:opacity-70">
          <Text variant="label" style={{ color: theme.ink }}>
            Search within {'“'}
            {typed}
            {'”'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * One candidate — the product shot, its title and the honesty line naming the
 * site it came from. Selection is a 2px ink ring rather than a tint: the
 * pictures are the content, and washing one in colour to mark it chosen would
 * make the chosen one the hardest to judge.
 */
function CandidateTile({
  candidate,
  selected,
  dimmed,
  onPress,
}: {
  candidate: MatchCandidate;
  selected: boolean;
  dimmed: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${candidate.title}, from ${candidate.source}`}
      accessibilityHint={selected ? 'Deselects this photo' : 'Selects this photo'}
      accessibilityState={{ selected, disabled: dimmed }}
      disabled={dimmed}
      onPress={onPress}
      style={{ width: '50%', paddingHorizontal: 6, opacity: dimmed ? 0.4 : 1 }}
      className="mb-4 active:opacity-80">
      <View
        className="aspect-[4/5] w-full overflow-hidden rounded-lg bg-tray dark:bg-tray-dark"
        // Inline, not a border class: the ring appears and disappears with
        // selection, and toggling border utilities re-lays-out the tile —
        // a constant transparent border holds the geometry still.
        style={{ borderWidth: 2, borderColor: selected ? theme.ink : 'transparent' }}>
        <Image
          source={stableImageSource(candidate.imageUrl)}
          recyclingKey={candidate.imageUrl}
          contentFit="cover"
          transition={180}
          cachePolicy="memory-disk"
          style={{ width: '100%', height: '100%' }}
          accessibilityIgnoresInvertColors
        />
      </View>

      <Text variant="caption" numberOfLines={2} className="mt-2" style={{ color: theme.ink }}>
        {candidate.title}
      </Text>
      {/* The honesty line, as everywhere a found picture appears: it came from
          somewhere, and the user gets to judge whether that somewhere is the
          right shop. */}
      <Text variant="colophon" numberOfLines={1}>
        {candidate.source}
      </Text>
    </Pressable>
  );
}
