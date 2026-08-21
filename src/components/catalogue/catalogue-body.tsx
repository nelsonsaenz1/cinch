/**
 * Every CPV2 state, rendered from a `CatalogueFlowView` and nothing else.
 *
 * The whole screen is a pure function of that object — no hooks of its own that
 * fetch, no navigation, no writes. That is what lets `dev-cpv2-*.tsx` pose all
 * fourteen frames for Codex without a production request, and it is the same
 * seam `GarmentSearchSheetBody` established.
 *
 * WHAT IS DELIBERATELY ABSENT, and would be easy to add by reflex: a price, a
 * "view at Mr Porter" link, a merchant logo, a sale badge, an availability
 * line. §3 lists ten words that appear nowhere and §11 forbids "that a
 * catalogue result may become an outbound link, a price, or a merchant
 * destination". The merchant's HOST is shown — that is provenance, and it is
 * the honest answer to "where did this picture come from" — but it is text, not
 * a destination.
 */

import { Pressable, ScrollView, View } from 'react-native';

import { CataloguePlate } from '@/components/catalogue/plate';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Rule } from '@/components/ui/rule';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  BROWSE_TILE_COLUMNS,
  BROWSE_TILE_GAP,
  BROWSE_TILE_HEIGHT,
  BROWSE_TILES,
  browseTileLabel,
} from '@/features/catalogue/browse-spec';
import {
  AFTER_TRANSCRIPTION,
  BROWSE_BACK_ACTION,
  BROWSE_EMPTY,
  BROWSE_HEADING,
  BROWSE_HELP,
  BROWSE_NEAR_MISS_HEADING,
  BROWSE_RETRY_ACTION,
  FAMILY_EXPLANATION,
  NEAR_MISS_HEADING,
  NO_MATCH,
  PRE_WRITE_REASSURANCE,
  PROVENANCE_LONG,
  TYPED_PRIVACY,
} from '@/features/catalogue/copy';
import { presentedTitle, representativeColour } from '@/features/catalogue/types';
import type { CatalogueFlowView } from '@/features/catalogue/use-catalogue-flow';
import { useTheme } from '@/theme/tokens';

import { ColourRow } from './colour-row';
import { FamilyCard } from './family-card';

/** §4: the family detail plate is 260 pt. */
const DETAIL_PLATE = 260;

export type CatalogueBodyProps = {
  view: CatalogueFlowView;
  /** True once a transcript has been written into the field (CPV2-03). */
  transcribed?: boolean;
  /** AX5 stress (CPV2-12). */
  large?: boolean;
  /** CPV2-08's exits. Inert in fixtures. */
  onAddAnother?: () => void;
  onBackToCloset?: () => void;
  /** CPV2-08 names its return destination. "my first ten" inside The Ten. */
  backLabel?: string;
  /** CPV2-09/10's escapes. */
  onFileWords?: () => void;
  onPhotograph?: () => void;
};

export function CatalogueBody(props: CatalogueBodyProps) {
  const { view } = props;

  switch (view.step) {
    case 'search':
      return <SearchStep {...props} />;
    case 'detail':
      return <DetailStep {...props} />;
    case 'confirm':
      return <ConfirmStep {...props} />;
    case 'importing':
      return <ImportingStep {...props} />;
    case 'done':
      return <DoneStep {...props} />;
  }
}

// ---------------------------------------------------------------------------
// CPV2-01 / 03 / 04 / 09 / 10
// ---------------------------------------------------------------------------

function SearchStep({ view, transcribed, onFileWords, onPhotograph }: CatalogueBodyProps) {
  const search = view.search;

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      // §6: the keyboard goes away when the list is dragged, so a result is
      // never hidden behind it on a small screen.
      keyboardDismissMode="on-drag">
      <View className="gap-2 px-gutter pb-4">
        <Text variant="noteSmall">{transcribed ? AFTER_TRANSCRIPTION : TYPED_PRIVACY}</Text>
      </View>

      {/* CPV2-11's hold, offered back. An OFFER and not a restore: silently
          re-ticking three colourways somebody chose yesterday, under an armed
          "Add 3 to closet", is how a kindness becomes an unwanted import. */}
      {view.heldSelection ? (
        <View className="mx-gutter mb-4 gap-2 rounded-2xl bg-tray p-4">
          <Text variant="eyebrow">Still held</Text>
          <Text variant="body">
            {`${view.heldSelection.colours.length} colours of ${presentedTitle(view.heldSelection.family)}, from when your closet was full.`}
          </Text>
          <Button title="Pick them up" variant="secondary" onPress={view.restoreHeld} />
          <Button title="Let them go" variant="ghost" onPress={view.dismissHeld} />
        </View>
      ) : null}

      {/* The door without words. Drawn only while no typed answer owns the
          page — the moment a search runs or lands, the grid yields to it, so
          two answers to two different questions can never stack. */}
      {search.status === 'idle' ? <BrowseSection view={view} /> : null}

      {search.status === 'searching' ? <ResultSkeleton /> : null}

      {search.status === 'results' ? (
        <View className="gap-2.5 px-gutter">
          {search.families.exact.map((family, i) => (
            <FamilyCard
              key={family.familyId}
              family={family}
              position={i + 1}
              onOpen={view.openFamily}
            />
          ))}

          {search.families.nearMiss.length > 0 ? (
            <View className="gap-2.5 pt-4">
              <Rule />
              <Text variant="eyebrow" className="pt-2">
                {NEAR_MISS_HEADING}
              </Text>
              {search.families.nearMiss.map((family, i) => (
                <FamilyCard
                  key={family.familyId}
                  family={family}
                  // Continues the exact list's numbering: a near-miss opened
                  // from position five IS the fifth thing on the page.
                  position={search.families.exact.length + i + 1}
                  onOpen={view.openFamily}
                />
              ))}
            </View>
          ) : null}

          <View className="pt-4">
            <Button title="Edit search" variant="ghost" onPress={view.editSearch} />
          </View>
        </View>
      ) : null}

      {search.status === 'empty' ? (
        <View className="gap-4 px-gutter">
          <Text variant="body">{NO_MATCH}</Text>
          {/* §2: four peer exits, none of them louder than the others. */}
          <View className="gap-2">
            <Button title="Edit the words" variant="secondary" onPress={view.editSearch} />
            <Button title="Photograph it" variant="secondary" onPress={onPhotograph} />
            <Button title="File the words instead" variant="ghost" onPress={onFileWords} />
          </View>
        </View>
      ) : null}

      {search.status === 'failed' ? (
        <View className="gap-4 px-gutter">
          <Notice tone="critical" message={FAILURE_COPY[search.failure]} />
          <View className="gap-2">
            <Button title="Try again" variant="secondary" onPress={view.submit} />
            <Button title="Photograph it" variant="secondary" onPress={onPhotograph} />
            <Button title="File the words instead" variant="ghost" onPress={onFileWords} />
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

/**
 * CPV2-10's four notices.
 *
 * Four sentences and not one, because which one a person hits decides what they
 * should do next — the same reason the link path has four. §9.4 of the handoff
 * says the atlas drew a daily search ceiling "without a number, because no such
 * limit exists in current behaviour. Delete the notice if there is no limit."
 * There IS a monthly allowance in `catalog_quota`, so `quota` keeps a notice —
 * and it says what it is, never offering an upgrade, because §9.4 also says it
 * "must never become a paywall".
 */
const FAILURE_COPY: Record<string, string> = {
  offline: 'You are offline, so the catalogue could not be reached. The words are still here.',
  timeout: 'The catalogue is taking longer than usual.',
  quota: "You've used this month's catalogue searches.",
  partner_unavailable: 'The shop catalogue is unavailable right now.',
};

/**
 * CPV2-04's geometry, held while the answer is in flight.
 *
 * Matched to `FamilyCard` — 104 × 124 plate, same padding, same gap — so the
 * page does not jump when the results land. A skeleton of a different shape is
 * worse than none: it teaches the eye where to look and then moves it.
 */
function ResultSkeleton() {
  const theme = useTheme();
  return (
    <View accessibilityLabel="Searching the catalogue" className="gap-2.5 px-gutter">
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          className="flex-row gap-3.5 rounded-2xl bg-surface p-3.5"
          style={{ borderWidth: 1, borderColor: theme.rule }}>
          <Skeleton style={{ width: 104, height: 124, borderRadius: 12 }} delay={i * 120} />
          <View className="flex-1 justify-center gap-2">
            <Skeleton style={{ height: 18, borderRadius: 6 }} delay={i * 120} />
            <Skeleton style={{ height: 13, width: '55%', borderRadius: 6 }} delay={i * 120} />
            <Skeleton style={{ height: 26, width: '75%', borderRadius: 6 }} delay={i * 120} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// The category grid — browse, beside the field
// ---------------------------------------------------------------------------

/**
 * Nine tiles under the search field, and what a tapped tile answers with.
 *
 * The browsed families render through the SAME `FamilyCard` and open through
 * the same `view.openFamily`, so from the detail screen on there is no browse
 * path at all — only the one import flow, which is the point. The near-miss
 * group keeps its subordinate heading for the same reason it has one under a
 * typed search: a browsed "Top" that surfaces a henley is close, not exact,
 * and the page should say which.
 */
function BrowseSection({ view }: { view: CatalogueFlowView }) {
  const theme = useTheme();
  const browse = view.browse;

  if (browse.status === 'idle') {
    return (
      <View className="gap-2 px-gutter">
        <Text variant="eyebrow">{BROWSE_HEADING}</Text>
        <Text variant="noteSmall">{BROWSE_HELP}</Text>
        <View
          className="flex-row flex-wrap pt-1"
          style={{ gap: BROWSE_TILE_GAP }}>
          {BROWSE_TILES.map((tile) => (
            <Pressable
              key={tile.slot}
              accessibilityRole="button"
              accessibilityLabel={`Browse ${tile.label}`}
              onPress={() => view.browseSlot(tile.slot)}
              className="items-center justify-center rounded-2xl bg-surface"
              style={{
                borderWidth: 1,
                borderColor: theme.rule,
                height: BROWSE_TILE_HEIGHT,
                // Three across regardless of width: each tile claims a third
                // of the row minus its share of the two gaps between tiles.
                flexBasis: `${Math.floor(100 / BROWSE_TILE_COLUMNS) - 2}%`,
                flexGrow: 1,
              }}>
              <Text variant="body">{tile.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  if (browse.status === 'loading') {
    return <ResultSkeleton />;
  }

  if (browse.status === 'offline' || browse.status === 'failed') {
    const failure = browse.status === 'offline' ? 'offline' : browse.failure;
    return (
      <View className="gap-4 px-gutter">
        <Notice tone="critical" message={FAILURE_COPY[failure]} />
        <View className="gap-2">
          <Button title={BROWSE_RETRY_ACTION} variant="secondary" onPress={view.retryBrowse} />
          <Button title={BROWSE_BACK_ACTION} variant="ghost" onPress={view.closeBrowse} />
        </View>
      </View>
    );
  }

  const { families } = browse;
  const total = families.exact.length + families.nearMiss.length;

  return (
    <View className="gap-2.5 px-gutter">
      <Text variant="eyebrow">{browseTileLabel(browse.slot)}</Text>

      {total === 0 ? <Text variant="body">{BROWSE_EMPTY}</Text> : null}

      {families.exact.map((family, i) => (
        <FamilyCard key={family.familyId} family={family} position={i + 1} onOpen={view.openFamily} />
      ))}

      {families.nearMiss.length > 0 ? (
        <View className="gap-2.5 pt-4">
          <Rule />
          <Text variant="eyebrow" className="pt-2">
            {BROWSE_NEAR_MISS_HEADING}
          </Text>
          {families.nearMiss.map((family, i) => (
            <FamilyCard
              key={family.familyId}
              family={family}
              position={families.exact.length + i + 1}
              onOpen={view.openFamily}
            />
          ))}
        </View>
      ) : null}

      <View className="pt-4">
        <Button title={BROWSE_BACK_ACTION} variant="ghost" onPress={view.closeBrowse} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// CPV2-05 / CPV2-12
// ---------------------------------------------------------------------------

function DetailStep({ view, large }: CatalogueBodyProps) {
  // Hoisted above the early return. A `useTheme()` inside the JSX below reads
  // fine and is a rules-of-hooks violation: the return two lines down means it
  // would not run on every render, and the hook order would differ between a
  // family that exists and one that does not.
  const theme = useTheme();
  const family = view.family;
  if (!family) return null;

  const title = presentedTitle(family);
  const hero = view.selectedColours[0] ?? representativeColour(family);
  const n = view.selectedColours.length;

  return (
    <View className="flex-1">
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="px-gutter">
          <CataloguePlate
            uri={hero?.imageUrl ?? null}
            contentFit="contain"
            className="overflow-hidden rounded-2xl bg-tray"
            style={{ height: large ? DETAIL_PLATE * 0.8 : DETAIL_PLATE }}
          />

          <View className="gap-1 pt-3.5">
            <Text variant="door">{title}</Text>
            {family.brand ? <Text variant="note">{family.brand}</Text> : null}
            {/* Provenance is text. Never a link — §11. */}
            <Text variant="noteSmall">{PROVENANCE_LONG}</Text>
            {family.merchants.length > 0 ? (
              <Text variant="noteSmall">{family.merchants.join(' · ')}</Text>
            ) : null}
          </View>
        </View>

        <View className="pt-4">
          <Rule />
          {family.colours.map((colour) => (
            <ColourRow
              key={colour.externalId}
              colour={colour}
              familyTitle={title}
              selected={view.selected.includes(colour.externalId)}
              onToggle={view.toggleColour}
              large={large}
            />
          ))}
        </View>
      </ScrollView>

      {/* §6: "The action bar is pinned and never falls behind content or the
          keyboard." The count sentence is the first thing dropped at AX5. */}
      <View
        className="gap-2 border-t bg-canvas px-gutter pb-2 pt-3"
        style={{ borderTopColor: theme.rule }}>
        {large ? null : <Text variant="noteSmall">{PRE_WRITE_REASSURANCE}</Text>}
        <Button
          title={n === 0 ? 'Choose a colour' : `Add ${n} to closet`}
          accessibilityLabel={n === 0 ? 'Choose a colour' : `Add ${n} to closet`}
          disabled={n === 0}
          onPress={view.review}
        />
        <Button title="Back to results" variant="ghost" onPress={view.closeFamily} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// CPV2-06 / CPV2-11
// ---------------------------------------------------------------------------

function ConfirmStep({ view }: CatalogueBodyProps) {
  const theme = useTheme();
  const family = view.family;
  if (!family) return null;
  const n = view.selectedColours.length;
  const title = presentedTitle(family);

  return (
    <View className="flex-1">
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="gap-2.5 px-gutter">
          {view.selectedColours.map((colour) => (
            <View
              key={colour.externalId}
              accessibilityLabel={`${title}, ${colour.label}`}
              className="flex-row items-center gap-3 rounded-2xl bg-surface p-3.5"
              style={{ borderWidth: 1, borderColor: theme.rule }}>
              <CataloguePlate
                uri={colour.imageUrl}
                contentFit="cover"
                compact
                className="overflow-hidden rounded-xl bg-tray"
                style={{ width: 56, height: 68 }}
              />
              <View className="flex-1">
                <Text variant="body">{title}</Text>
                <Text variant="noteSmall">{colour.label}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* CPV2-11 — the shelf filled up. The selection is HELD, not discarded:
            it is the thing the user just made, and throwing it away to show a
            limit would make the limit cost them the work as well. */}
        {view.refusal ? (
          <View className="gap-3 px-gutter pt-4">
            <View className="gap-1.5 rounded-2xl bg-tray p-4">
              <Text variant="body">{capacitySentence(view.refusal)}</Text>
              <Text variant="noteSmall">
                Your {n === 1 ? 'colour is' : `${n} colours are`} still selected.
              </Text>
            </View>
          </View>
        ) : null}

        {view.errorMessage ? (
          <View className="px-gutter pt-4">
            <Notice tone="critical" message={view.errorMessage} />
          </View>
        ) : null}
      </ScrollView>

      <View
        className="gap-2 border-t bg-canvas px-gutter pb-2 pt-3"
        style={{ borderTopColor: theme.rule }}>
        <Button
          title={`Add ${n} to closet`}
          loading={view.importing}
          disabled={view.importing || Boolean(view.refusal)}
          onPress={view.confirm}
        />
        <Button title="Change colours" variant="ghost" onPress={view.backToDetail} />
      </View>
    </View>
  );
}

/**
 * CPV2-11's sentence, built from the numbers the server sent.
 *
 * Two ceilings, two remedies: a full ACTIVE closet is fixed by storing a piece,
 * and a full ACCOUNT is not. Telling somebody to make room when making room
 * will not help is the dead end migration 20260808190100 exists to remove, so
 * the two never share a sentence.
 */
function capacitySentence(refusal: NonNullable<CatalogueFlowView['refusal']>): string {
  if (refusal.code === 'storage_limit_reached') {
    return `Your closet and its archive are both full at ${refusal.totalLimit ?? 0} pieces.`;
  }
  const room = Math.max(0, (refusal.activeLimit ?? 0) - (refusal.active ?? 0));
  if (room === 0) return `Your closet is full at ${refusal.activeLimit ?? 0} pieces.`;
  return `There is room for ${room} more, and you chose ${refusal.requested}.`;
}

// ---------------------------------------------------------------------------
// CPV2-07
// ---------------------------------------------------------------------------

function ImportingStep({ view }: CatalogueBodyProps) {
  const theme = useTheme();
  const family = view.family;
  const title = family ? presentedTitle(family) : '';
  const anyFailed = view.results.some((r) => r.status === 'failed');

  return (
    <View className="flex-1">
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="px-gutter">
          {view.selectedColours.map((colour) => {
            const row = view.results.find((r) => r.externalId === colour.externalId);
            const state =
              row?.status === 'failed'
                ? 'Could not be added'
                : row?.status === 'already-added'
                  ? 'Already in your closet'
                  : row?.status === 'added'
                    ? 'Added'
                    : 'Adding…';
            return (
              <View
                key={colour.externalId}
                accessibilityLiveRegion="polite"
                accessibilityLabel={`${colour.label}. ${state}.`}
                className="flex-row items-center justify-between py-3"
                style={{ minHeight: 44 }}>
                <Text variant="body">{colour.label}</Text>
                <Text variant="noteSmall">{state}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {anyFailed ? (
        <View
          className="gap-2 border-t bg-canvas px-gutter pb-2 pt-3"
          style={{ borderTopColor: theme.rule }}>
          <Text variant="noteSmall">
            {/* §11: successes are never rolled back. Said out loud, because the
                natural fear at a partial failure is that nothing landed. */}
            The ones that succeeded are already in your closet.
          </Text>
          <Button title="Try the rest again" onPress={view.retryFailed} loading={view.importing} />
          <Button title="Leave them out" variant="ghost" onPress={view.reset} />
        </View>
      ) : null}
      {title ? null : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// CPV2-08
// ---------------------------------------------------------------------------

function DoneStep({ view, onAddAnother, onBackToCloset, backLabel }: CatalogueBodyProps) {
  const n = view.addedItemIds.length;
  const family = view.family;

  return (
    <View className="flex-1 justify-between">
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="gap-3 px-gutter">
          <Text variant="display">
            {n} {n === 1 ? 'piece added' : 'pieces added'}
          </Text>
          {family ? <Text variant="body">{presentedTitle(family)}</Text> : null}
          {/* The family sentence is only true of a family, so it is only said
              when more than one colourway landed. */}
          {n > 1 ? <Text variant="note">{FAMILY_EXPLANATION}</Text> : null}
        </View>
      </ScrollView>

      <View className="gap-2 px-gutter pb-2">
        <Button title="Add another piece" onPress={onAddAnother} />
        <Button title={backLabel ?? 'Back to the closet'} variant="ghost" onPress={onBackToCloset} />
      </View>
    </View>
  );
}
