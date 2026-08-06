import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatPrice, parsePrice } from '@/components/review/review-card';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ErrorState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { useVerifyItem } from '@/features/closet/mutations';
import { useCloset } from '@/features/closet/queries';
import { useSignedUrls, stableImageSource } from '@/features/closet/use-image-urls';
import { useSetBorrowable } from '@/features/social-graph/mutations';
import { useItemBorrowable } from '@/features/social-graph/queries';
import { pairHarmony, toGarmentColors } from '@/lib/color';
import { costPerWear, type Item } from '@/schemas/item';
import { leading } from '@/theme/font-metrics';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * How many of the other pieces in the closet actually work with this one's
 * colours — the guide's "works with 8 of your pieces" line, computed from the
 * same OKLCH harmony model the styling engine scores outfits with rather than
 * a canned number. Each side is reduced to its dominant colour, same as
 * `analyzePalette` does for a whole outfit; 0.55 is a shade above the
 * "unremarkable but fine" midpoint the scorer itself uses, so this counts real
 * pairings, not merely inoffensive ones.
 */
const HARMONY_FLOOR = 0.55;

function harmonyCount(item: Item, closet: Item[]): number {
  const mine = toGarmentColors(item.colors)[0];
  if (!mine) return 0;

  let count = 0;
  for (const other of closet) {
    if (other.id === item.id) continue;
    const theirs = toGarmentColors(other.colors)[0];
    if (!theirs) continue;
    if (pairHarmony(mine, theirs).score >= HARMONY_FLOOR) count++;
  }
  return count;
}

/**
 * Cost-per-wear only ever falls as a piece is worn more against a fixed
 * price, so "down from $X a wear" is a real, computed fact rather than the
 * guide's invented "last winter" — it compares today's cost per wear against
 * what it was `LOOKBACK` wears ago. Silent until there is enough history to
 * make the comparison mean something, and silent again if the piece hasn't
 * actually gotten any cheaper (a brand-new higher price wouldn't have).
 */
const CPW_LOOKBACK = 8;

function cpwTrend(item: Item, cpw: number | null): string | null {
  if (cpw === null || item.purchasePrice === null || item.wearCount <= CPW_LOOKBACK) return null;
  const earlierCpw = item.purchasePrice / (item.wearCount - CPW_LOOKBACK);
  if (earlierCpw - cpw < 0.05) return null;
  return `Down from $${earlierCpw.toFixed(2)} a wear ${CPW_LOOKBACK} wears ago.`;
}

/** "Oct 2023" from an ISO date, for the owned-since line. */
function monthYear(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** How long since it was last on — the design's fourth stat. Honest when never. */
function sinceLastWorn(item: Item): string {
  if (!item.lastWornAt || item.wearCount === 0) return 'Never';
  const then = new Date(item.lastWornAt).getTime();
  if (Number.isNaN(then)) return '—';
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return '1d';
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)} mo`;
  return `${Math.round(days / 365)} yr`;
}

/** Item detail — one garment and its story. */
export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();

  // Resolved from the same live query the grid renders, so navigating here is
  // a cache hit, not a second fetch.
  const closet = useCloset();
  const item = (closet.data ?? []).find((i) => i.id === id);
  const cpw = item ? costPerWear(item) : null;
  const worksWith = item ? harmonyCount(item, closet.data ?? []) : 0;
  const trend = item ? cpwTrend(item, cpw) : null;

  const { resolve } = useSignedUrls([item?.cutoutPath, item?.thumbPath]);
  const imageUri = resolve(item?.cutoutPath, item?.thumbPath);

  // The price field, open only while it is being edited. `null` is closed —
  // one piece of state rather than a boolean and a string that can disagree.
  const [draft, setDraft] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const save = useVerifyItem();

  // The lending flag. Read separately from the closet query on purpose: the
  // generated `Item` type predates the `borrowable` column, and this is the
  // one screen that can flip it.
  const borrowable = useItemBorrowable(id ?? null);
  const setBorrowable = useSetBorrowable();

  if (closet.isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas dark:bg-canvas-dark">
        <ActivityIndicator color={theme.muted} />
      </SafeAreaView>
    );
  }

  // A failed fetch is not a deletion. This used to fall through to the
  // "no longer in your closet" branch below and tell someone the piece was
  // gone over a network error that never touched her closet.
  if (closet.isError) {
    return (
      <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark">
        <ErrorState
          title="Couldn't load this piece"
          body="Check your connection and try again."
          onRetry={() => void closet.refetch()}
        />
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas dark:bg-canvas-dark">
        <Text variant="body">This piece is no longer in your closet.</Text>
        <Button title="Back" variant="ghost" onPress={() => router.back()} className="mt-4" />
      </SafeAreaView>
    );
  }

  const ownedSince = monthYear(item.purchaseDate ?? item.createdAt);
  const colours = item.colors.slice(0, 4);

  /**
   * A price the user has typed but never worn is not a cost per wear — it is
   * the whole price, and printing "$240 / wear" the day something arrives is
   * technically true and reads like an accusation. The maths in
   * `costPerWear` is untouched (it returns null here, correctly); this is the
   * one display case that says what it means instead.
   */
  const neverWorn = item.purchasePrice !== null && item.wearCount === 0;

  const commitPrice = async () => {
    if (draft === null) return;
    const next = parsePrice(draft);
    setDraft(null);
    if (next === item.purchasePrice) return;
    setSaveFailed(false);
    try {
      // `verify: false` — saying what a coat cost is not confirming that the
      // tagger read its colours right, and must not pull it out of the review
      // queue the user has not been through yet.
      await save.mutateAsync({ id: item.id, patch: { purchasePrice: next }, verify: false });
    } catch {
      setSaveFailed(true);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark">
      {/* Circular back, category centred — the design's header. There is no
          "⋯" overflow: nothing in the app can delete or archive an item yet
          (useVerifyItem is the only item mutation), and a menu that opens onto
          nothing is worse than no menu. Add it when there are real actions. */}
      <View className="flex-row items-center justify-between px-gutter pt-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full border border-rule active:opacity-60 dark:border-rule-dark">
          <SymbolView name="chevron.left" size={15} tintColor={theme.ink} resizeMode="scaleAspectFit" />
        </Pressable>
        <Text variant="colophon">{item.category}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerClassName="px-gutter pb-24">
        <View className="mt-2 aspect-square w-full items-center justify-center overflow-hidden rounded-plate bg-tray dark:bg-tray-dark">
          {imageUri ? (
            <Image
              source={stableImageSource(imageUri)}
              contentFit="contain"
              transition={200}
              cachePolicy="memory-disk"
              style={{ width: '100%', height: '100%' }}
              accessibilityIgnoresInvertColors
            />
          ) : null}
        </View>

        <Text variant="title" className="mt-5">
          {item.subcategory ?? 'Untagged item'}
        </Text>
        {ownedSince ? (
          <Text variant="label" className="mt-1 text-faint dark:text-faint-dark">
            Owned since {ownedSince}
          </Text>
        ) : null}

        {/* The 2×2 stat grid. Cost-per-wear is the inverted hero tile — it is the
            number no competitor computes, so it gets the ink. Internal cross
            lines come from per-cell borders; the outer frame from the container. */}
        <View className="mt-6 overflow-hidden rounded-plate border border-rule dark:border-rule-dark">
          <View className="flex-row">
            <StatBox value={`${item.wearCount}×`} label="Worn" edge="rb" />
            <StatBox
              value={item.purchasePrice !== null ? formatPrice(item.purchasePrice) : '—'}
              label="Paid"
              edge="b"
            />
          </View>
          <View className="flex-row">
            <StatBox
              value={
                neverWorn
                  ? formatPrice(item.purchasePrice as number)
                  : cpw !== null
                    ? `$${cpw.toFixed(2)}`
                    : '—'
              }
              label={neverWorn ? 'Not worn yet' : 'Cost per wear'}
              edge="r"
              invert
            />
            <StatBox value={sinceLastWorn(item)} label="Since last worn" />
          </View>
        </View>

        {/* The honest commentary line under the stat grid — computed, not
            invented: cost per wear only falls as a fixed price is worn more,
            so this is a real comparison against the same piece's own earlier
            self, not a claim about a season it may not have been owned in. */}
        {trend ? (
          <Text variant="label" className="mt-2 text-muted dark:text-muted-dark">
            {trend}
          </Text>
        ) : null}

        {/* The price edit — the screen's one oxblood, spent here because this
            is the field that turns the hero tile from a dash into the number
            the whole product is about. Quiet: a line of text until it is
            tapped, never a form sitting open. */}
        {draft === null ? (
          <View className="mt-3 flex-row items-center justify-between gap-3">
            <Text variant="label" className="flex-1 text-faint dark:text-faint-dark">
              {item.purchasePrice !== null
                ? `Paid ${formatPrice(item.purchasePrice)}`
                : 'Cost per wear needs what you paid.'}
            </Text>
            <Pressable
              onPress={() =>
                setDraft(item.purchasePrice !== null ? String(item.purchasePrice) : '')
              }
              accessibilityRole="button"
              accessibilityLabel={
                item.purchasePrice !== null ? 'Edit what you paid' : 'Add what you paid'
              }
              hitSlop={8}
              style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
              className="active:opacity-60">
              <Text variant="label" className="text-accent dark:text-accent-dark">
                {item.purchasePrice !== null ? 'Edit' : 'Add price'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View className="mt-3 flex-row items-center gap-2">
            <View
              className="flex-1 flex-row items-center rounded-md border border-rule px-3 dark:border-rule-dark"
              style={{ minHeight: MIN_TAP_TARGET }}>
              <Text variant="callout" className="text-faint dark:text-faint-dark">
                $
              </Text>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                keyboardType="decimal-pad"
                inputMode="decimal"
                autoFocus
                placeholder="0"
                placeholderTextColor={theme.faint}
                accessibilityLabel="Price paid, in dollars"
                returnKeyType="done"
                onSubmitEditing={() => void commitPrice()}
                className="ml-1 flex-1 font-body text-callout"
                style={{ minHeight: MIN_TAP_TARGET, color: theme.ink }}
              />
            </View>
            <Button
              title="Save"
              variant="secondary"
              loading={save.isPending}
              onPress={() => void commitPrice()}
            />
          </View>
        )}

        {saveFailed ? (
          <Text
            variant="label"
            accessibilityLiveRegion="polite"
            className="mt-2 text-critical dark:text-critical">
            That didn&rsquo;t save. Check your connection and try again.
          </Text>
        ) : null}

        {/* Lending. Default is borrowable — generosity is the feature — and
            the copy says plainly what "off" does and does not do: the piece
            stays visible in a friend's view of the closet either way, there is
            just no ask on it. While the flag is loading the switch is withheld
            (spinner in its place), same reasoning as Profile's consent toggle:
            a control that says "off" for a beat and then flips reads as the
            app having lost the setting. */}
        <View className="mt-6 overflow-hidden rounded-plate border border-rule dark:border-rule-dark">
          <View className="flex-row items-center justify-between p-4">
            <View className="flex-1 pr-3">
              <Text variant="body">Borrowable</Text>
              <Text variant="caption" className="mt-1 text-muted">
                {borrowable.data === undefined
                  ? 'Checking…'
                  : borrowable.data
                    ? 'Friends can ask to borrow this piece.'
                    : 'Marked not for lending. Friends still see it in your closet — there’s just no way to ask.'}
              </Text>
            </View>
            {borrowable.data !== undefined ? (
              <Switch
                value={borrowable.data}
                onValueChange={(next) =>
                  setBorrowable.mutate(
                    { id: item.id, borrowable: next },
                    {
                      onError: (err) =>
                        Alert.alert(
                          'Could not update lending',
                          err instanceof Error
                            ? err.message
                            : 'Something went wrong. The setting has not changed.',
                        ),
                    },
                  )
                }
                disabled={setBorrowable.isPending}
                trackColor={{ false: theme.rule, true: theme.ink }}
                accessibilityLabel="Borrowable"
                accessibilityHint={
                  borrowable.data
                    ? 'Marks this piece not for lending'
                    : 'Lets friends ask to borrow this piece'
                }
              />
            ) : (
              <ActivityIndicator size="small" color={theme.faint} />
            )}
          </View>
        </View>

        {item.description ? (
          <Text variant="body" className="mt-5 text-muted dark:text-muted-dark">
            {item.description}
          </Text>
        ) : null}

        {item.occasions.length > 0 ? (
          <View className="mt-6">
            <Text variant="eyebrow" className="mb-3">
              Suits
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {item.occasions.map((o) => (
                <Chip key={o} label={o} />
              ))}
            </View>
          </View>
        ) : null}

        {colours.length > 0 ? (
          <View className="mt-6">
            <Text variant="eyebrow" className="mb-3">
              Colours
            </Text>
            <View className="flex-row items-center gap-2.5">
              {colours.map((c, i) =>
                c.hex ? (
                  <View
                    key={`${c.name}-${i}`}
                    className="h-6 w-6 rounded-full border border-rule dark:border-rule-dark"
                    style={{ backgroundColor: c.hex }}
                  />
                ) : null,
              )}
              <Text variant="label" className="text-muted dark:text-muted-dark">
                {colours.map((c) => c.name).join(' · ')}
              </Text>
            </View>
            {/* The half of this caption that carries the moat: how many other
                real pieces this colour actually pairs with, scored by the same
                OKLCH harmony model the outfit engine uses — not a claim any
                competitor without real closets behind it could make. */}
            {(closet.data?.length ?? 0) > 1 ? (
              <Text variant="label" className="mt-2 text-muted dark:text-muted-dark">
                Works with {worksWith} of your other pieces.
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * One cell of the stat grid. `edge` names which internal borders it draws so the
 * cross lines never double up; `invert` is the ink hero tile.
 *
 * All sizing and colour is set by `style`, not className: on the inverted tile
 * a `text-canvas` class does NOT reliably beat the `stat` variant's own
 * `text-ink` (NativeWind gives no guaranteed precedence between two `text-*`
 * utilities that land on the same element), which rendered the hero figure
 * ink-on-ink — invisible, and the same hazard would apply to stacking a size
 * class (see button.tsx L18-25). An inline style always wins.
 */
function StatBox({
  value,
  label,
  edge = '',
  invert = false,
}: {
  value: string;
  label: string;
  edge?: 'rb' | 'b' | 'r' | '';
  invert?: boolean;
}) {
  const theme = useTheme();
  const borders = `${edge.includes('r') ? 'border-r ' : ''}${edge.includes('b') ? 'border-b ' : ''}`;
  return (
    <View className={`flex-1 p-4 ${borders}border-rule dark:border-rule-dark ${invert ? 'bg-ink' : ''}`}>
      {/* The design's hero figure size (26px) — matched here at the tailwind
          config's own `figure` values rather than stacking `className="text-figure"`
          on top of the `stat` variant's `text-heading`, which is the same
          two-`text-*`-classes hazard the comment above names. */}
      <Text
        variant="stat"
        style={{
          color: invert ? theme.canvas : theme.ink,
          fontSize: 28,
          lineHeight: leading('instrument', 28, 1.05),
          letterSpacing: -0.15,
        }}>
        {value}
      </Text>
      {/* 8px, not the shared 10px `colophon` size — the guide sets these
          stat-grid labels smaller than every other colophon in the app, so
          the override is local rather than a change to the shared token. */}
      <Text
        variant="colophon"
        className="mt-1"
        style={{
          color: invert ? 'rgba(251,250,246,0.7)' : theme.faint,
          fontSize: 8,
          lineHeight: 11,
          letterSpacing: 1.1,
        }}>
        {label}
      </Text>
    </View>
  );
}
