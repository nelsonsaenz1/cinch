import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddTagSheet } from '@/components/item/add-tag-sheet';
import { DeleteSheet } from '@/components/item/delete-sheet';
import { ItemChips } from '@/components/item/item-chips';
import { ItemEditSheet, type ItemEditDraft } from '@/components/item/item-edit-sheet';
import { ItemHero } from '@/components/item/item-hero';
import { ItemMissing } from '@/components/item/item-missing';
import { ItemSkeleton } from '@/components/item/item-skeleton';
import { ItemStats } from '@/components/item/item-stats';
import { MaintenancePlate, type MaintenanceRow } from '@/components/item/maintenance-plate';
import {
  ManualTagSections,
  OnThisPhonePill,
  type ManualTags,
} from '@/components/item/manual-tag-sections';
import { TaggingHeader } from '@/components/item/tagging-header';
import { WearsWellWith, type RailPiece } from '@/components/item/wears-well-with';
import { formatPrice, parsePrice } from '@/components/review/review-card';
import { ErrorState } from '@/components/ui/empty-state';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { useCoWear } from '@/features/closet/co-wear';
import { pieceName } from '@/features/closet/item-name';
import {
  useRemoveItems,
  useRetagItem,
  useUnverifyItem,
  useVerifyItem,
} from '@/features/closet/mutations';
import { useCloset } from '@/features/closet/queries';
import { useArchiveItems } from '@/features/closet/storage';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { useLocalPhoto } from '@/features/ingest/local-photos';
import { useSetBorrowable } from '@/features/social-graph/mutations';
import { useItemBorrowable } from '@/features/social-graph/queries';
import { pairHarmony, toGarmentColors } from '@/lib/color';
import { costPerWear, type Item } from '@/schemas/item';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * How close two garments' colours have to sit before the app will claim they go
 * together. Scored by the same OKLCH harmony model the styling engine ranks
 * whole outfits with, not a canned number; 0.55 is a shade above the
 * "unremarkable but fine" midpoint the scorer itself uses, so this counts real
 * pairings rather than merely inoffensive ones.
 */
const HARMONY_FLOOR = 0.55;

/** How many pieces the rail will carry before it stops being a rail. */
const RAIL_LIMIT = 12;

/**
 * The pieces this garment's colours actually work with, best first.
 *
 * This is the FALLBACK half of "Wears well with". The rail's first choice is
 * real shared wear history (`useCoWear`), which is a fact about what the user
 * does; this is a fact about the clothes themselves, and it is what the rail
 * shows for a piece that has not been out of the house yet. The two are never
 * mixed and never share a caption — see the `mode` prop on `WearsWellWith`.
 */
function harmonyPeers(item: Item, closet: Item[]): Item[] {
  const mine = toGarmentColors(item.colors)[0];
  if (!mine) return [];

  const scored: { piece: Item; score: number }[] = [];
  for (const other of closet) {
    if (other.id === item.id) continue;
    const theirs = toGarmentColors(other.colors)[0];
    if (!theirs) continue;
    const score = pairHarmony(mine, theirs).score;
    if (score >= HARMONY_FLOOR) scored.push({ piece: other, score });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, RAIL_LIMIT)
    .map((s) => s.piece);
}

/** "14 Mar 2025" — the atlas's added-on date. */
function addedOn(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** How long since it was last on. Honest when never. */
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

/**
 * Item detail — one garment, told as its own story.
 *
 * ── Three compositions, not one ───────────────────────────────────────────
 *
 * The Item Detail State Atlas (I-01…I-04) draws the SETTLED piece: a photograph
 * that carries the top of the screen, everything Cinch knows underneath it, and
 * the destructive work at the foot in a plate of its own. That is the `else`
 * branch below, and it is full-bleed — no `SafeAreaView` top edge, no gutter on
 * the scroll container, because the hero runs under a transparent status bar and
 * every block beneath it carries its own margin.
 *
 * The other two presentations keep the old `ScreenHeader` composition on
 * purpose, because the atlas never drew them and forcing a full-bleed hero onto
 * them would be inventing design rather than implementing it:
 *
 * — IN FLIGHT (A-03): the tagger is mid-read. `pending_tag` is the status both
 *   the upload queue and `useRetagItem` write while a read is out;
 *   `pending_upload` is the beat before it, when there are no tags to show
 *   either. Never true for a local item — nothing is coming back for those.
 *
 * — LOCAL (A-05): `imagePath` null means the photograph never left the phone —
 *   AI processing is off, and the photo is resolved from the on-device store
 *   instead of a signed URL. The screen becomes the manual tagging editor: same
 *   page, chips instead of returned tags.
 */
export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();

  // Resolved from the same live query the grid renders, so navigating here is
  // a cache hit, not a second fetch.
  const closet = useCloset();
  const items = closet.data ?? [];
  const item = items.find((i) => i.id === id);
  const cpw = item ? costPerWear(item) : null;

  /**
   * MEMOISED BY THE COMPILER, deliberately not by hand.
   *
   * This walks the WHOLE closet and runs an OKLCH pair comparison per garment —
   * at two hundred pieces, two hundred colour conversions. The obvious fix is a
   * `useMemo` around it, and that fix is worse: `item` is derived from
   * `closet.data` by a `.find()` in this same body, which React Compiler cannot
   * prove stable, so the manual memo makes the whole component BAIL OUT of
   * optimisation (see `react-hooks/preserve-manual-memoization`). Left plain,
   * the compiler memoises this call and everything around it. Do not "fix" this
   * by adding a dependency array.
   */
  const peers = item ? harmonyPeers(item, items) : [];

  /**
   * What this piece actually goes out with. Only outfits with a real `worn_at`
   * count — see the docblock on `useCoWear`.
   */
  const coWear = useCoWear(id ?? null);

  /**
   * The rail's two modes, decided here rather than inside the component.
   *
   * Shared wear history wins whenever there is any: it is a fact about what the
   * user does, and it is the claim the atlas actually draws. Colour harmony is
   * the fallback for a piece with no history, and it is presented under a
   * different header with no per-tile count, because "worn together" said about
   * a pairing that has never been worn would be a lie the rail tells silently.
   */
  const coWorn = coWear.data ?? [];
  const railSource: { piece: Item; count?: number }[] = coWorn.length
    ? coWorn.flatMap((c) => {
        const piece = items.find((i) => i.id === c.itemId);
        return piece ? [{ piece, count: c.count }] : [];
      })
    : peers.map((piece) => ({ piece }));
  const railMode = coWorn.length ? 'coWear' : 'harmony';

  /**
   * One signing request for every photograph this screen shows — the hero and
   * the whole rail — rather than one per image. `useSignedUrls` dedupes and
   * sorts, so the same set in a different order is a cache hit.
   */
  const { resolve } = useSignedUrls([
    item?.cutoutPath,
    item?.thumbPath,
    ...railSource.flatMap((r) => [r.piece.cutoutPath, r.piece.thumbPath]),
  ]);
  const imageUri = resolve(item?.cutoutPath, item?.thumbPath);

  const rail: RailPiece[] = railSource.slice(0, RAIL_LIMIT).map(({ piece, count }) => ({
    id: piece.id,
    name: pieceName(piece),
    imageUri: resolve(piece.cutoutPath, piece.thumbPath) ?? null,
    coWearCount: count,
  }));

  // The edit sheet behind the pencil — name and price, the two fields the atlas
  // moved off the reading surface. `null` is closed.
  const [editing, setEditing] = useState(false);
  // The sheet behind the dashed "+ Tag" chip.
  const [tagging, setTagging] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const save = useVerifyItem();

  // The things you can do TO a piece rather than with it. `maintenanceError`
  // holds the server's refusal — the allowance is enforced server-side, and a
  // refusal that vanishes into a console log is a feature the user thinks is
  // broken rather than one they have run out of.
  const retag = useRetagItem();
  const sendBack = useUnverifyItem();
  const remove = useRemoveItems();
  const archive = useArchiveItems();
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // The lending flag. Read separately from the closet query on purpose: the
  // generated `Item` type predates the `borrowable` column, and this is the
  // one screen that can flip it.
  const borrowable = useItemBorrowable(id ?? null);
  const setBorrowable = useSetBorrowable();

  const isLocal = item ? item.imagePath === null : false;
  const inflight =
    !isLocal && !!item && (item.status === 'pending_tag' || item.status === 'pending_upload');

  const localPhoto = useLocalPhoto(isLocal && item ? item.id : null);

  /**
   * The manual editor's unsaved edits, or null when the screen shows what the
   * row holds. One nullable object rather than per-field state, so "is there
   * anything to save" is a single comparison and a discard is one assignment.
   */
  const [manualDraft, setManualDraft] = useState<(ManualTags & { name: string }) | null>(null);
  const [editingName, setEditingName] = useState(false);
  const savedManual: (ManualTags & { name: string }) | null = item
    ? {
        name: item.subcategory ?? '',
        category: item.category,
        colors: item.colors,
        material: item.material,
      }
    : null;
  const manual = manualDraft ?? savedManual;
  const manualDirty =
    manualDraft !== null && JSON.stringify(manualDraft) !== JSON.stringify(savedManual);

  /**
   * The status bar has to survive a photograph scrolling out from under it.
   *
   * Light content is right while the hero fills the top of the screen and wrong
   * the moment it does not — canvas-on-canvas is an invisible clock. One
   * threshold flip rather than a continuously animated value: there are exactly
   * two correct appearances here, and the scroll position only ever crosses
   * between them.
   */
  const [pastHero, setPastHero] = useState(false);

  /**
   * While a read is out, keep asking. The queue already invalidates `closet`
   * when an item settles, but only while the app's queue is the one doing the
   * tagging — a re-read from this screen, or a read finishing while the queue
   * screen is long gone, lands server-side with nothing to tell this page. A
   * modest interval while (and only while) the row says in-flight is the
   * refresh; the moment the status settles the interval unmounts.
   */
  const qc = useQueryClient();
  useEffect(() => {
    if (!inflight) return;
    const interval = setInterval(() => {
      void qc.invalidateQueries({ queryKey: ['closet'] });
    }, 4000);
    return () => clearInterval(interval);
  }, [inflight, qc]);

  if (closet.isLoading) {
    return (
      <View className="flex-1 bg-canvas dark:bg-canvas-dark">
        <StatusBar style="dark" />
        <ItemSkeleton onBack={() => router.back()} />
      </View>
    );
  }

  // A failed fetch is not a deletion. This used to fall through to the
  // "no longer in your closet" branch below and tell someone the piece was
  // gone over a network error that never touched her closet.
  if (closet.isError) {
    return (
      <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
        <ErrorState
          title="Couldn't load this piece"
          body="Check your connection and try again."
          onRetry={() => void closet.refetch()}
        />
      </SafeAreaView>
    );
  }

  if (!item) {
    // `ItemMissing` expects the route to own the safe-area top edge, matching
    // the error branch above rather than the full-bleed hero below.
    return (
      <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
        <StatusBar style="dark" />
        <ItemMissing
          onBack={() => router.back()}
          onBackToCloset={() => router.back()}
          onCheckStorage={() => router.push('/storage')}
        />
      </SafeAreaView>
    );
  }

  /**
   * A price the user has typed but never worn is not a cost per wear — it is
   * the whole price, and printing "$240 / wear" the day something arrives is
   * technically true and reads like an accusation. The maths in `costPerWear`
   * is untouched (it returns null here, correctly); this is the one display
   * case that says what it means instead.
   */
  const neverWorn = item.purchasePrice !== null && item.wearCount === 0;

  /**
   * True while the tagger is looking at this photograph again.
   *
   * Read from the ROW as well as the mutation, because `useRetagItem` writes
   * `pending_tag` before it calls: a user who backs out mid-read and comes
   * straight back should find the same in-progress state, not tags that are
   * about to be replaced presented as settled. It also covers a piece that has
   * never finished its first tagging pass, which is the same fact.
   */
  const retagging = retag.isPending || item.status === 'pending_tag';

  const startRetag = () => {
    setMaintenanceError(null);
    retag.mutate(
      { item },
      {
        onError: (err) =>
          setMaintenanceError(
            err instanceof Error ? err.message : 'Cinch couldn’t re-read this piece. Try again.',
          ),
      },
    );
  };

  /**
   * Reopen a question already answered.
   *
   * No dialog: this undoes a confirmation rather than destroying anything, and
   * it says so in its own caption. The row disappears on success — the piece is
   * back in the queue, so there is nothing left to send.
   */
  const startSendBack = () => {
    setMaintenanceError(null);
    sendBack.mutate(
      { item },
      {
        onError: (err) =>
          setMaintenanceError(
            err instanceof Error
              ? err.message
              : 'Cinch couldn’t put this piece back in the deck. Try again.',
          ),
      },
    );
  };

  /**
   * Storage — the reversible half of the delete sheet, and the reason the sheet
   * exists at all. Keeps the row and every photograph; only `is_archived` moves,
   * so the piece can come back whole from the storage screen.
   */
  const moveToStorage = () => {
    archive.mutate(
      { ids: [item.id] },
      {
        onSuccess: () => {
          setConfirmingDelete(false);
          router.back();
        },
        onError: (err) =>
          Alert.alert(
            'Could not move this piece to storage',
            err instanceof Error
              ? err.message
              : 'Something went wrong. The piece is still in your closet.',
          ),
      },
    );
  };

  /**
   * The removal. Fired only from the sheet's second button, never from the row —
   * the sheet has already named both consequences and offered the reversible
   * option first and in the only filled button, which is the whole point of
   * frame I-02.
   */
  const deleteForever = () => {
    remove.mutate(
      { ids: [item.id] },
      {
        onSuccess: () => {
          setConfirmingDelete(false);
          router.back();
        },
        onError: (err) =>
          Alert.alert(
            'Could not remove this piece',
            err instanceof Error
              ? err.message
              : 'Something went wrong. The piece is still in your closet.',
          ),
      },
    );
  };

  /**
   * The edit sheet's write.
   *
   * `verify: false` throughout — saying what a coat cost, or what to call it,
   * is not confirming that the tagger read its colours right, and must not pull
   * the piece out of a review queue the user has not been through yet. The typed
   * name goes to `subcategory`, exactly the column `pieceName` reads, so the
   * grid, the rails and this title all call it what its owner does.
   */
  const commitEdit = (next: ItemEditDraft) => {
    setSaveFailed(false);
    const price = next.price.trim() === '' ? null : parsePrice(next.price);
    save.mutate(
      {
        id: item.id,
        verify: false,
        patch: {
          subcategory: next.name.trim() ? next.name.trim() : null,
          purchasePrice: price,
        },
      },
      {
        onSuccess: () => setEditing(false),
        onError: () => setSaveFailed(true),
      },
    );
  };

  /**
   * The tag sheet's write. Same `verify: false` reasoning as the edit sheet —
   * saying a coat suits the office is not confirming the tagger read its
   * colours right, and must not pull it out of a queue unreviewed.
   */
  const commitTags = (next: { occasions: string[]; seasons: string[] }) => {
    setSaveFailed(false);
    save.mutate(
      { id: item.id, verify: false, patch: { occasions: next.occasions, seasons: next.seasons } },
      {
        onSuccess: () => setTagging(false),
        onError: () => setSaveFailed(true),
      },
    );
  };

  /**
   * The manual editor's write — the four taps landing. Same mutation and the
   * same `verify: false` reasoning as the edit sheet above; a local item was
   * never in a review queue to be pulled out of.
   */
  const saveManual = () => {
    if (!manual) return;
    setSaveFailed(false);
    setEditingName(false);
    save.mutate(
      {
        id: item.id,
        verify: false,
        patch: {
          category: manual.category,
          subcategory: manual.name.trim() ? manual.name.trim() : null,
          colors: manual.colors,
          material: manual.material,
        },
      },
      {
        onSuccess: () => setManualDraft(null),
        onError: () => setSaveFailed(true),
      },
    );
  };

  /**
   * The maintenance plate's rows, assembled here because which of them EXIST is
   * a fact about the piece, not a styling choice.
   *
   * The two AI rows only exist for a piece the tagger can reach: a local item's
   * photograph was never uploaded, so there is nothing server-side to re-read
   * and no review deck it belongs to, and offering either would be a button
   * guaranteed to disappoint. "Send back" additionally requires a piece that has
   * been confirmed — an item still in the queue cannot be sent somewhere it
   * already is.
   */
  const maintenanceRows: MaintenanceRow[] = [
    ...(!isLocal && item.userVerified
      ? [
          {
            label: 'Send back to review',
            caption: 'Returns it to the tag queue for a second pass. Nothing is re-read.',
            onPress: startSendBack,
            loading: sendBack.isPending,
          } satisfies MaintenanceRow,
        ]
      : []),
    ...(!isLocal
      ? [
          {
            label: retagging ? 'Reading this piece…' : 'Re-read this piece',
            caption: retagging
              ? // Not "again": this row also lights up for a piece still on its
                // FIRST tagging pass, and telling that user her garment is being
                // re-read would be describing something that never happened.
                'Cinch is reading the photo. This takes a moment.'
              : 'Cinch re-describes the photo and refreshes tags. It goes back in the review deck.',
            onPress: startRetag,
            loading: retagging,
          } satisfies MaintenanceRow,
        ]
      : []),
    {
      label: 'Delete this piece',
      caption: 'Storage first — outfit history is kept either way.',
      onPress: () => setConfirmingDelete(true),
      tone: 'accent',
      loading: remove.isPending || archive.isPending,
    },
  ];

  // ── The two special presentations, on the old composition ─────────────────
  if (inflight || isLocal) {
    return (
      <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
        <StatusBar style="dark" />
        <ScreenHeader
          title={item.category}
          trailing={
            isLocal && manualDirty ? (
              <Pressable
                onPress={saveManual}
                disabled={save.isPending}
                accessibilityRole="button"
                accessibilityLabel="Save changes"
                accessibilityState={{ disabled: save.isPending, busy: save.isPending }}
                hitSlop={8}
                style={{ minHeight: 36, minWidth: 36, justifyContent: 'center' }}
                className="active:opacity-60">
                {save.isPending ? (
                  <ActivityIndicator size="small" color={theme.accent} />
                ) : (
                  <Text variant="label" className="text-accent dark:text-accent-dark">
                    Save
                  </Text>
                )}
              </Pressable>
            ) : undefined
          }
        />

        <KeyboardAwareScrollView contentContainerClassName="px-gutter pb-24">
          {inflight ? (
            <TaggingHeader item={item} imageUri={imageUri} />
          ) : (
            <View className="mt-2 flex-row items-start gap-4">
              <View className="h-[136px] w-[104px] items-center justify-center overflow-hidden rounded-md bg-tray dark:bg-tray-dark">
                {localPhoto.imageUri || localPhoto.thumbUri ? (
                  <Image
                    source={{ uri: (localPhoto.imageUri ?? localPhoto.thumbUri) as string }}
                    contentFit="cover"
                    transition={200}
                    style={{ width: '100%', height: '100%' }}
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  // The file is gone — another device, a reinstall. The same
                  // considered placeholder the grid shows, never a broken image.
                  <SymbolView
                    name="tshirt"
                    size={26}
                    tintColor={theme.hairline}
                    resizeMode="scaleAspectFit"
                  />
                )}
              </View>
              <View className="flex-1 pt-0.5">
                <OnThisPhonePill />
                {editingName && manual ? (
                  <TextInput
                    value={manual.name}
                    onChangeText={(next) => setManualDraft({ ...manual, name: next })}
                    autoFocus
                    placeholder="Untitled item"
                    placeholderTextColor={theme.faint}
                    accessibilityLabel="Item name"
                    returnKeyType="done"
                    onSubmitEditing={() => setEditingName(false)}
                    onBlur={() => setEditingName(false)}
                    className="mt-3 font-title text-title"
                    style={{ color: theme.ink, padding: 0 }}
                  />
                ) : (
                  <Pressable
                    onPress={() => setEditingName(true)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      manual?.name.trim() ? `Rename ${manual.name}` : 'Name this item'
                    }
                    accessibilityHint="Edits the name in place"
                    hitSlop={8}
                    className="active:opacity-60">
                    <Text
                      variant="title"
                      className="mt-3"
                      style={manual?.name.trim() ? undefined : { color: theme.faint }}>
                      {manual?.name.trim() ? manual.name : 'Untitled item'}
                    </Text>
                  </Pressable>
                )}
                <Text variant="label" className="mt-2">
                  Name it, or leave it — the photo is enough.
                </Text>
              </View>
            </View>
          )}

          {isLocal && manual ? (
            <ManualTagSections
              value={manual}
              onChange={(next) => setManualDraft({ ...manual, ...next })}
            />
          ) : null}

          {saveFailed ? (
            <Text
              variant="label"
              accessibilityLiveRegion="polite"
              className="mt-2 text-critical dark:text-critical">
              That didn&rsquo;t save. Check your connection and try again.
            </Text>
          ) : null}

          <View className="mt-8">
            <MaintenancePlate rows={maintenanceRows} />
          </View>

          {maintenanceError ? (
            <Text
              variant="label"
              accessibilityLiveRegion="polite"
              className="mt-2 text-critical dark:text-critical">
              {maintenanceError}
            </Text>
          ) : null}
        </KeyboardAwareScrollView>

        <DeleteSheet
          visible={confirmingDelete}
          wears={item.wearCount}
          onStore={moveToStorage}
          onDeleteForever={deleteForever}
          onCancel={() => setConfirmingDelete(false)}
          busy={remove.isPending || archive.isPending}
        />
      </SafeAreaView>
    );
  }

  // ── I-01: the settled piece ───────────────────────────────────────────────
  const added = addedOn(item.purchaseDate ?? item.createdAt);
  const priced = item.purchasePrice !== null ? formatPrice(item.purchasePrice) : null;

  return (
    <View className="flex-1 bg-canvas dark:bg-canvas-dark">
      {/* Light while the photograph is under the clock, dark once it is not. */}
      <StatusBar style={pastHero ? 'dark' : 'light'} />

      <ScrollView
        // `flex-1` is load-bearing, not decoration: a ScrollView with no flex
        // in a flex column measures against its own content rather than the
        // viewport, and lands scrolled into the middle of the page on mount.
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        contentInsetAdjustmentBehavior="never"
        scrollEventThrottle={16}
        onScroll={(e) => {
          // The hero is 430/393 of the screen width; flipping a little before
          // its true bottom keeps the clock legible over the last dark band of
          // a photograph rather than exactly at the seam.
          const next = e.nativeEvent.contentOffset.y > 120;
          if (next !== pastHero) setPastHero(next);
        }}>
        <ItemHero
          imageUri={imageUri ?? null}
          label={pieceName(item)}
          onBack={() => router.back()}
          onEdit={() => setEditing(true)}
        />

        <View className="px-gutter pt-5">
          {/* 36px, between the 40px `display` and 28px `title` steps. The size is
              the atlas's; it moves inline rather than into the scale because one
              screen's hero is not a new token. Colour and family stay with the
              variant — see the precedence hazard in ui/text.tsx. */}
          <Text variant="display" style={{ fontSize: 36, lineHeight: 47 }}>
            {pieceName(item)}
          </Text>

          {/* "Added 14 Mar 2025 · $346". The price half is the atlas's only place
              for it, so when there is no price this line carries the invitation
              instead — the figure the whole cost-per-wear idea rests on cannot
              be unreachable just because the frame did not draw an empty case. */}
          <Pressable
            onPress={() => setEditing(true)}
            accessibilityRole="button"
            accessibilityLabel={priced ? 'Edit what you paid' : 'Add what you paid'}
            hitSlop={8}
            style={{ minHeight: 24, justifyContent: 'center' }}
            className="active:opacity-60">
            <Text variant="label" className="mt-1.5 text-muted dark:text-muted-dark">
              {added ? `Added ${added}` : 'Added'}
              {' · '}
              {priced ?? <Text className="text-accent dark:text-accent-dark">Add what you paid</Text>}
            </Text>
          </Pressable>
        </View>

        <View className="pt-4">
          <ItemChips
            category={item.category}
            colors={item.colors}
            occasions={item.occasions}
            seasons={item.seasons}
            onAddTag={() => setTagging(true)}
          />
        </View>

        <View className="pt-5">
          <ItemStats
            wears={item.wearCount}
            costPerWear={
              neverWorn
                ? formatPrice(item.purchasePrice as number)
                : cpw !== null
                  ? `$${cpw.toFixed(2)}`
                  : null
            }
            sinceLast={sinceLastWorn(item)}
            neverWorn={neverWorn}
          />
        </View>

        <BorrowableCard
          value={borrowable.data}
          pending={setBorrowable.isPending}
          onChange={(next) =>
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
        />

        <View className="pt-6">
          <WearsWellWith
            pieces={rail}
            mode={railMode}
            onPressPiece={(pieceId) => router.push(`/item/${pieceId}`)}
          />
        </View>

        <View className="pt-6">
          <MaintenancePlate rows={maintenanceRows} />
        </View>

        {maintenanceError ? (
          <Text
            variant="label"
            accessibilityLiveRegion="polite"
            className="mx-gutter mt-2 text-critical dark:text-critical">
            {maintenanceError}
          </Text>
        ) : null}
      </ScrollView>

      <DeleteSheet
        visible={confirmingDelete}
        wears={item.wearCount}
        onStore={moveToStorage}
        onDeleteForever={deleteForever}
        onCancel={() => setConfirmingDelete(false)}
        busy={remove.isPending || archive.isPending}
      />

      <ItemEditSheet
        visible={editing}
        initial={{
          name: item.subcategory ?? '',
          price: item.purchasePrice !== null ? String(item.purchasePrice) : '',
        }}
        onSave={commitEdit}
        onCancel={() => {
          setSaveFailed(false);
          setEditing(false);
        }}
        busy={save.isPending}
        error={saveFailed ? 'That didn’t save. Check your connection and try again.' : null}
      />

      <AddTagSheet
        visible={tagging}
        initial={{ occasions: item.occasions, seasons: item.seasons }}
        onSave={commitTags}
        onCancel={() => setTagging(false)}
        busy={save.isPending}
      />
    </View>
  );
}

/**
 * Lending, per I-01.
 *
 * Default is borrowable — generosity is the feature — and the copy says plainly
 * what "off" does and does not do: the piece stays visible in a friend's view of
 * the closet either way, there is just no ask on it.
 *
 * While the flag is loading the switch is WITHHELD rather than shown off, same
 * reasoning as Profile's consent toggle: a control that says "off" for a beat
 * and then flips reads as the app having lost the setting.
 */
function BorrowableCard({
  value,
  pending,
  onChange,
}: {
  value: boolean | undefined;
  pending: boolean;
  onChange: (next: boolean) => void;
}) {
  const theme = useTheme();

  return (
    <View
      className="mx-gutter mt-4 flex-row items-center gap-3 bg-tray px-3.5 py-3 dark:bg-tray-dark"
      // 14, from the atlas. Between `md` (12) and `lg` (16) with no token of its
      // own; inline rather than a second `rounded-*` class, which has no defined
      // precedence against the one already on this element.
      style={{ borderRadius: 14 }}>
      <View className="flex-1">
        <Text variant="body" style={{ fontSize: 14, fontWeight: '600' }}>
          Borrowable
        </Text>
        <Text variant="caption" className="mt-0.5 text-muted dark:text-muted-dark">
          {value === undefined
            ? 'Checking…'
            : value
              ? 'Friends following you can ask for this piece.'
              : 'Marked not for lending. Friends still see it in your closet — there’s just no way to ask.'}
        </Text>
      </View>
      {value !== undefined ? (
        <Switch
          value={value}
          onValueChange={onChange}
          disabled={pending}
          trackColor={{ false: theme.rule, true: theme.ink }}
          accessibilityLabel="Borrowable"
          accessibilityHint={
            value ? 'Marks this piece not for lending' : 'Lets friends ask to borrow this piece'
          }
          style={{ minHeight: MIN_TAP_TARGET - 14 }}
        />
      ) : (
        <ActivityIndicator size="small" color={theme.faint} />
      )}
    </View>
  );
}
