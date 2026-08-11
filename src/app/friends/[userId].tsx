import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FriendItemCard } from '@/components/social/FriendItemCard';
import { FriendItemSheet } from '@/components/social/FriendItemSheet';
import {
  FriendOverflowSheet,
  friendsSinceClause,
  type FriendSheetRow,
} from '@/components/social/FriendOverflowSheet';
import { ReportProfileSheet } from '@/components/social/ReportProfileSheet';
import { BlockConfirmSheet, RemoveFriendDialog } from '@/components/social/friend-sheets';
import { Avatar, Button, Chip, ScreenHeader, Skeleton, Text } from '@/components/ui';
import { KeyboardAvoidingScreen } from '@/components/ui/keyboard-aware-scroll-view';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { useBlockUser, useReportContent } from '@/features/social-graph/moderation';
import { useSocialTermsGate } from '@/features/auth/use-social-terms-gate';
import { useRequestBorrow, useUnfollow } from '@/features/social-graph/mutations';
import { useMutedIds } from '@/features/social-graph/muted';
import {
  useFriendCloset,
  useFriendClosetMeta,
  useFriends,
  useFriendshipSince,
} from '@/features/social-graph/queries';
import { profileName, type FriendItem, type SocialProfile } from '@/features/social-graph/types';
import { leading } from '@/theme/font-metrics';
import { GUTTER, MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * A friend's closet — her wardrobe, with her consent (Friend Closet atlas
 * FC-01…FC-06).
 *
 * The page is the Closet you already know — same two-up grid, same card size,
 * same wear counts — served through the privacy layer, so it holds nothing
 * she has not chosen to show. What is different is what is missing: no edit,
 * no select, no add, and the absences are absences, not disabled controls.
 * The only new thing on a card is whether she is willing to lend it.
 *
 * "Their closet", never "Her closet": the app knows this person's name and
 * nothing about their pronouns, and it has no business guessing (commit
 * 9026e08). Every possessive here is the name itself or they/them; the rest
 * of the atlas copy is kept word for word.
 *
 * Split in two: `FriendClosetView` is the render tree, a pure function of the
 * props below, and this file's default export is the state machine and the
 * mutations wired around it. `dev-friend-closet` mounts the same view over
 * fixtures, so what the fixture shows is what this screen ships.
 */

/**
 * The gap between one transparent Modal fading out and the next fading in —
 * iOS refuses to present while a dismissal is still animating, so a follow-on
 * sheet opened in the same commit sometimes never appears. Same constant,
 * same reason as friends/index.tsx.
 */
const SHEET_HANDOFF_MS = 280;

// ---------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------

/**
 * Which of the atlas's six frames the page is in. Exactly one at a time, and
 * the order of the checks matters: the privacy layer answers before the
 * closet (a hidden closet must never flash its contents), and a meta row
 * that came back null is the friendship having lapsed mid-visit — a
 * different fact from an empty closet, told without accusation.
 */
export type FriendClosetStatus = 'loading' | 'error' | 'hidden' | 'lapsed' | 'empty' | 'loaded';

/** Nulls are the owner declining to show that number — never rendered as 0. */
export type FriendClosetStats = {
  pieces: number | null;
  wearsLogged: number | null;
  costPerWear: number | null;
};

export type FriendClosetViewProps = {
  /** Painted from the friend row you tapped — never skeletoned. */
  name: string;
  /** `@adam · friends since March`, already assembled; null renders nothing. */
  handleLine: string | null;
  avatarUri?: string | null;
  bio: string | null;
  /** The three headline counts, or null when the block is absent entirely. */
  stats: FriendClosetStats | null;
  status: FriendClosetStatus;
  items: FriendItem[];
  resolveImage: (item: FriendItem) => string | undefined;
  onBack: () => void;
  onOverflow: () => void;
  onItemPress: (item: FriendItem) => void;
  /** FC-05 only — the one state that earns a retry. */
  onRetry: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  listRef?: React.RefObject<FlashListRef<FriendItem> | null>;
};

/** `1,340`, `$3.10` — the stat block's two spellings. */
function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

function StatCell({ value, label, a11y }: { value: string; label: string; a11y: string }) {
  return (
    // `items-center`, per §2.2 of the Refacing — both lines centre in an
    // equal-width figure-over-label column, and a friend's-closet stat is one.
    <View
      className="flex-1 items-center px-3 py-[13px]"
      accessible
      accessibilityRole="text"
      accessibilityLabel={a11y}>
      {/* 19/600: `heading`'s semibold family at the atlas's drawn size — an
          inline size on the named variant, never a second text-* class
          (the item-stats.tsx precedent). */}
      <Text variant="heading" style={{ fontSize: 19, lineHeight: leading('helvetica', 19, 1.25) }}>
        {value}
      </Text>
      <Text variant="caption" className="mt-0.5">
        {label}
      </Text>
    </View>
  );
}

/**
 * The inset three-part stat row. Renders ONLY the stats she shows — a hidden
 * stat leaves no gap and no dash, and when all three are off the block is
 * absent entirely, which is why the caller passes `stats: null` for it.
 */
function StatBlock({ stats }: { stats: FriendClosetStats }) {
  const cells: { value: string; label: string; a11y: string }[] = [];
  if (stats.pieces !== null)
    cells.push({
      value: formatCount(stats.pieces),
      label: 'Pieces',
      a11y: `${stats.pieces} pieces`,
    });
  if (stats.wearsLogged !== null)
    cells.push({
      value: formatCount(stats.wearsLogged),
      label: 'Wears logged',
      a11y: `${stats.wearsLogged} wears logged`,
    });
  if (stats.costPerWear !== null)
    cells.push({
      value: `$${stats.costPerWear.toFixed(2)}`,
      label: 'Per wear',
      a11y: `$${stats.costPerWear.toFixed(2)} per wear`,
    });
  if (cells.length === 0) return null;

  return (
    <View className="mt-4 flex-row overflow-hidden rounded-lg bg-tray">
      {cells.map((cell, i) => (
        <View key={cell.label} className="flex-1 flex-row">
          {/* `rule`, not the mock's .10 — hairlines on this page use the
              token (settled precedent). */}
          {i > 0 ? <View className="w-hair bg-rule" /> : null}
          <StatCell {...cell} />
        </View>
      ))}
    </View>
  );
}

/** Avatar, serif name, handle line, bio — present in every state but lapsed's void. */
function IdentityHeader({
  name,
  handleLine,
  avatarUri,
  bio,
}: Pick<FriendClosetViewProps, 'name' | 'handleLine' | 'avatarUri' | 'bio'>) {
  return (
    <View>
      <View className="flex-row items-center gap-3.5 pt-3.5">
        <Avatar name={name} size={62} imageUri={avatarUri} />
        <View className="min-w-0 flex-1">
          {/* 32pt serif — the atlas's size; no type token sits at 32, so the
              named display variant carries an inline size (the item-stats.tsx
              escape hatch), with the line computed so CoreText cannot shave
              the caps. */}
          <Text
            variant="display"
            accessibilityRole="header"
            numberOfLines={2}
            style={{ fontSize: 32, lineHeight: leading('instrument', 32, 1.05) }}>
            {name}
          </Text>
          {handleLine ? (
            // `note`, not the mock's #8A8578: faint fails AA on small text.
            <Text variant="note" className="mt-0.5" numberOfLines={1}>
              {handleLine}
            </Text>
          ) : null}
        </View>
      </View>
      {bio ? (
        <Text variant="callout" className="mt-3">
          {bio}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * FC-06 — the wait. Identity is already painted above this (it came from the
 * row you tapped); only the stats and the grid wait, as a stat-block bone and
 * four card bones with caption bars. Local rather than a `skeleton.tsx`
 * variant: the stat bone is this page's shape and nobody else's.
 */
const CAPTION_BONE_WIDTHS = [96, 80, 88, 70] as const;

function FriendClosetSkeleton({ name }: { name: string }) {
  return (
    <View accessibilityLabel={`Loading ${name}’s closet`}>
      <Skeleton className="mt-4 rounded-lg" style={{ height: 62 }} />
      <View className="mt-2.5 flex-row flex-wrap">
        {CAPTION_BONE_WIDTHS.map((width, i) => (
          <View key={i} className="w-1/2 px-1.5 pb-2.5" style={{ marginTop: 6 }}>
            {/* Geometry tracks FriendItemCard exactly — 196pt well, 12pt
                radius — so nothing jumps when the closet lands. */}
            <Skeleton className="h-[196px] w-full rounded-md" delay={i * 120} />
            <Skeleton className="mt-[7px] h-3 rounded-chip" style={{ width }} delay={i * 120} />
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * FC-05 — the one blank grid that is on us. Her name and avatar stay above,
 * so the failure is clearly the grid rather than the friendship, and the
 * first line rules out the reading people jump to. The only retry on the
 * page lives here: an empty closet is her choice and a hidden one is her
 * setting, and neither is a thing to try again.
 */
function ErrorBody({ name, onRetry, onBack }: { name: string; onRetry: () => void; onBack: () => void }) {
  const theme = useTheme();
  return (
    <View className="flex-1 items-center justify-center px-[34px] pb-16">
      <View
        className="h-11 w-11 items-center justify-center rounded-full"
        // The atlas's .22 ring — between `rule` and the chip's dashed .30;
        // no token holds it, so the drawn value rides inline.
        style={{ borderWidth: 1.5, borderColor: 'rgba(28,26,22,0.22)' }}>
        <Text variant="plate" style={{ fontSize: 22, color: theme.muted }}>
          !
        </Text>
      </View>
      <Text variant="title" className="mt-4 text-center" accessibilityRole="header">
        {name}’s closet didn’t load
      </Text>
      <Text variant="body" className="mt-2.5 text-center text-muted">
        This is on us, not on them. Everything is still there.
      </Text>
      {/* Ink, per the atlas — the accent is not spent on recovering from our
          own failure. */}
      <Button title="Try again" variant="ink" onPress={onRetry} className="mt-5 self-center px-6" />
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back to Friends"
        style={{ minHeight: MIN_TAP_TARGET }}
        className="mt-1 items-center justify-center px-4 active:opacity-60">
        <Text variant="label" style={{ color: theme.accent }}>
          Back to Friends
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * FC-04, both halves, plus the lapsed cousin — three quiet blanks that each
 * say which one they are. No buttons anywhere: prompting a friend to fill a
 * closet for your benefit is the wrong direction of pressure, a hidden
 * closet reads as a setting rather than a rejection, and a lapsed one gets
 * neither accusation nor retry.
 */
function QuietBody({ status, name }: { status: 'hidden' | 'lapsed' | 'empty'; name: string }) {
  if (status === 'empty') {
    return (
      <View className="pt-5">
        <View
          className="h-[110px] rounded-md border border-dashed"
          // The atlas's dashed frame: .18 ink over a paper a step off canvas.
          // Neither value has a token; both ride inline, per the escape hatch.
          style={{ borderColor: 'rgba(28,26,22,0.18)', backgroundColor: '#F7F4EC' }}
        />
        <Text variant="plate" className="mt-4" accessibilityRole="header">
          Nothing in here yet
        </Text>
        <Text variant="body" className="mt-2 text-muted">
          {/* No "joined last week" — when they joined is not a fact this
              page holds, and inventing it is worse than omitting it. */}
          {name} hasn’t photographed anything yet. You’ll see pieces here as they add them.
        </Text>
      </View>
    );
  }

  if (status === 'hidden') {
    return (
      <View className="pt-6">
        <Text variant="plate" accessibilityRole="header">
          {name} keeps this closet private
        </Text>
        <Text variant="body" className="mt-2 text-muted">
          You’re still friends, and they can see yours if you show it. Nothing is wrong and there
          is nothing to do.
        </Text>
      </View>
    );
  }

  // Lapsed — the meta row answered null after the page opened: the
  // friendship ended mid-visit. The hidden state's neutral register, one
  // sentence, nothing to press.
  return (
    <View className="pt-6">
      <Text variant="plate" accessibilityRole="header">
        This closet isn’t open to you right now.
      </Text>
    </View>
  );
}

/**
 * The render tree, pure in its props — see the module docblock for why it is
 * exported. Identity always paints; below it, exactly one of the six frames.
 */
export function FriendClosetView({
  name,
  handleLine,
  avatarUri,
  bio,
  stats,
  status,
  items,
  resolveImage,
  onBack,
  onOverflow,
  onItemPress,
  onRetry,
  refreshing = false,
  onRefresh,
  listRef,
}: FriendClosetViewProps) {
  const theme = useTheme();

  const borrowableCount = items.filter((i) => i.borrowable).length;

  const header = (
    <ScreenHeader
      align="leading"
      title="Friends"
      onBack={onBack}
      backLabel="Back to Friends"
      trailing={
        // A plain vertical ellipsis — the atlas draws no disc around this
        // one, unlike the back chevron. 44pt of pressable around 18pt of
        // glyph; the rotation is because SF ships no vertical ellipsis.
        <Pressable
          onPress={onOverflow}
          accessibilityRole="button"
          accessibilityLabel={`More options for ${name}`}
          className="items-center justify-center active:opacity-60"
          style={{ width: MIN_TAP_TARGET, height: MIN_TAP_TARGET, marginRight: -13 }}>
          <View style={{ transform: [{ rotate: '90deg' }] }}>
            <SymbolView name="ellipsis" size={17} tintColor={theme.ink} resizeMode="scaleAspectFit" />
          </View>
        </Pressable>
      }
    />
  );

  if (status === 'loaded') {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
        {header}
        <FlashList
          ref={listRef}
          data={items}
          numColumns={2}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View className="pb-1">
              <IdentityHeader name={name} handleLine={handleLine} avatarUri={avatarUri} bio={bio} />
              {stats ? <StatBlock stats={stats} /> : null}
              <View className="mb-3.5 mt-4 flex-row items-center justify-between">
                <Text variant="eyebrow">{`Their closet · ${items.length}`}</Text>
                {/* The chip only when there is something to point at — a
                    "Borrowable 0" would be an invitation to nothing. The dot
                    is the accent because borrowable is her one oxblood mark. */}
                {borrowableCount > 0 ? (
                  <Chip label="Borrowable" count={borrowableCount} swatchHex={theme.accent} />
                ) : null}
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <FriendItemCard item={item} imageUri={resolveImage(item)} onPress={onItemPress} />
          )}
          // Plain style, not contentContainerClassName — FlashList is outside
          // NativeWind and silently drops classNames (see closet-grid.tsx).
          // GUTTER rather than a literal 20 for the same reason: the token is
          // the page measure, and a copy of its value drifts silently.
          contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: 96 }}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.muted} />
            ) : undefined
          }
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {header}
      <View className="flex-1 px-gutter">
        <IdentityHeader name={name} handleLine={handleLine} avatarUri={avatarUri} bio={bio} />
        {status === 'loading' ? (
          <FriendClosetSkeleton name={name} />
        ) : status === 'error' ? (
          <ErrorBody name={name} onRetry={onRetry} onBack={onBack} />
        ) : (
          <QuietBody status={status} name={name} />
        )}
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// The screen — state machine and mutations around the view
// ---------------------------------------------------------------------------

/** Which follow-on overlay the overflow handed off to. One at a time. */
type Confirm = 'remove' | 'block' | 'report' | null;

export default function FriendClosetScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();

  const friends = useFriends();
  const profile: (SocialProfile & { friendsSince?: string }) | null =
    (friends.data ?? []).find((p) => p.userId === userId) ?? null;
  const name = profile ? profileName(profile) : 'A friend';

  const meta = useFriendClosetMeta(userId ?? null);
  const closet = useFriendCloset(userId ?? null);
  const since = useFriendshipSince(userId ?? null);
  const items = closet.data ?? [];
  const { resolve } = useSignedUrls(items.flatMap((i) => [i.thumbPath, i.cutoutPath]));

  const requestBorrow = useRequestBorrow();
  const terms = useSocialTermsGate();
  const unfollow = useUnfollow();
  const block = useBlockUser();
  const report = useReportContent();
  const { isMuted, setMuted } = useMutedIds();

  const listRef = useRef<FlashListRef<FriendItem>>(null);

  // The FC-03 sheet: which garment is open. `null` is closed.
  const [openItem, setOpenItem] = useState<FriendItem | null>(null);
  // The borrow compose: which garment is being asked for, and the note going
  // with it. `null` is closed — one piece of state, not a boolean plus a copy.
  const [asking, setAsking] = useState<FriendItem | null>(null);
  const [message, setMessage] = useState('');

  const [overflowOpen, setOverflowOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [reportSent, setReportSent] = useState(false);
  const [reportBlocked, setReportBlocked] = useState(false);

  /** One sheet at a time: the outgoing overlay fades fully before the next opens. */
  const handOff = useCallback((open: () => void) => {
    setTimeout(open, SHEET_HANDOFF_MS);
  }, []);

  // Exactly one of the atlas's six frames. Privacy first: the meta row
  // answers before the grid is believed, so a hidden closet cannot flash and
  // a lapsed friendship is not mistaken for an empty wardrobe.
  const status: FriendClosetStatus =
    closet.isError || meta.isError
      ? 'error'
      : closet.isLoading || meta.isLoading
        ? 'loading'
        : meta.data == null
          ? 'lapsed'
          : meta.data.closetHidden
            ? 'hidden'
            : items.length === 0
              ? 'empty'
              : 'loaded';

  const handleLine =
    [
      profile?.username ? `@${profile.username}` : null,
      friendsSinceClause(since.data ?? profile?.friendsSince),
    ]
      .filter(Boolean)
      .join(' · ') || null;

  const stats: FriendClosetStats | null =
    meta.data && !meta.data.closetHidden
      ? {
          pieces: meta.data.pieces,
          wearsLogged: meta.data.wearsLogged,
          costPerWear: meta.data.costPerWear,
        }
      : null;

  const bio = meta.data?.bio ?? profile?.bio ?? null;

  // -------------------------------------------------------------------------
  // Borrowing
  // -------------------------------------------------------------------------

  const askFromSheet = (item: FriendItem) => {
    setOpenItem(null);
    setMessage('');
    handOff(() => setAsking(item));
  };

  const sendAsk = () => {
    if (!asking || !userId) return;
    requestBorrow.mutate(
      // GRAPH's own surfaces are never event-scoped; eventId is for the event
      // screens, which call the same hook with one.
      { itemId: asking.id, ownerId: userId, eventId: null, message },
      {
        onSuccess: () => {
          setAsking(null);
          Alert.alert('Asked', `${name} will see your request. No pressure either way.`);
        },
        onError: (err) => {
          // The compose sheet stays open with the note still in it, so
          // agreeing sends the request she already wrote.
          if (terms.intercept(err, () => sendAsk())) return;
          Alert.alert(
            'Could not ask',
            err instanceof Error ? err.message : 'Something went wrong. Try again.',
          );
        },
      },
    );
  };

  // -------------------------------------------------------------------------
  // The overflow and its follow-ons (FC-02; confirms per the Friends atlas)
  // -------------------------------------------------------------------------

  /**
   * "Ask to borrow something" points, it does not open: the sheet closes and
   * the grid scrolls to the first borrowable card. Chosen over opening that
   * card's sheet directly because the row's promise is *something*, plural —
   * landing her among the badged cards keeps the choice hers, where jumping
   * into one piece would make it ours.
   */
  const scrollToBorrowable = () => {
    setOverflowOpen(false);
    const index = items.findIndex((i) => i.borrowable);
    if (index < 0) return;
    handOff(() => listRef.current?.scrollToIndex({ index, animated: true }));
  };

  const overflowRows: FriendSheetRow[] = [
    { label: 'Ask to borrow something', chevron: true, onPress: scrollToBorrowable },
    {
      label: userId && isMuted(userId) ? 'Unmute in Lately' : 'Mute in Lately',
      chevron: true,
      onPress: () => {
        if (userId) setMuted(userId, !isMuted(userId));
        setOverflowOpen(false);
      },
    },
    {
      label: 'Unfriend',
      destructive: true,
      onPress: () => {
        setOverflowOpen(false);
        handOff(() => setConfirm('remove'));
      },
    },
    {
      label: 'Report',
      destructive: true,
      onPress: () => {
        setOverflowOpen(false);
        setReportSent(false);
        setReportBlocked(false);
        handOff(() => setConfirm('report'));
      },
    },
    {
      label: 'Block',
      destructive: true,
      onPress: () => {
        setOverflowOpen(false);
        handOff(() => setConfirm('block'));
      },
    },
  ];

  const doUnfriend = () => {
    if (!userId) return;
    unfollow.mutate(
      { userId },
      {
        // Unfriending from inside her closet returns you to Friends with the
        // row gone — there is nothing left here to stand in.
        onSuccess: () => {
          setConfirm(null);
          router.back();
        },
        onError: (err) =>
          Alert.alert(
            'Could not unfriend',
            err instanceof Error ? err.message : 'Something went wrong. Try again.',
          ),
      },
    );
  };

  const doBlock = () => {
    if (!userId) return;
    block.mutate(
      { userId },
      {
        onSuccess: () => {
          setConfirm(null);
          router.back();
        },
        onError: (err) =>
          Alert.alert(
            'Could not block',
            err instanceof Error ? err.message : 'Something went wrong. Try again.',
          ),
      },
    );
  };

  const submitReport = ({ reason, blockToo }: { reason: string; blockToo: boolean }) => {
    if (!profile) return;
    report.mutate(
      {
        subject: 'profile',
        subjectId: profile.userId,
        subjectUserId: profile.userId,
        reason,
      },
      {
        onSuccess: () => {
          if (!blockToo) {
            setReportBlocked(false);
            setReportSent(true);
            return;
          }
          block.mutate(
            { userId: profile.userId },
            {
              onSuccess: () => {
                setReportBlocked(true);
                setReportSent(true);
              },
              // The report landed; the receipt must not claim a block that
              // didn't. Show the receipt without the blocked line and say
              // what failed.
              onError: (err) => {
                setReportBlocked(false);
                setReportSent(true);
                Alert.alert(
                  'Could not block',
                  err instanceof Error ? err.message : 'Something went wrong. Try again.',
                );
              },
            },
          );
        },
        onError: (err) =>
          Alert.alert(
            'Could not send that report',
            err instanceof Error ? err.message : 'Something went wrong. Try again.',
          ),
      },
    );
  };

  const finishReport = () => {
    setConfirm(null);
    setReportSent(false);
    // If the block ran, this closet is no longer a place to stand.
    if (reportBlocked) router.back();
  };

  return (
    <>
      <FriendClosetView
        name={name}
        handleLine={handleLine}
        avatarUri={profile?.avatarUrl}
        bio={bio}
        stats={stats}
        status={status}
        items={items}
        resolveImage={(item) => resolve(item.thumbPath, item.cutoutPath)}
        onBack={() => router.back()}
        onOverflow={() => setOverflowOpen(true)}
        onItemPress={setOpenItem}
        onRetry={() => {
          void closet.refetch();
          void meta.refetch();
        }}
        refreshing={closet.isRefetching}
        onRefresh={() => {
          void closet.refetch();
          void meta.refetch();
        }}
        listRef={listRef}
      />

      {/* FC-03 — the piece, opened. */}
      <FriendItemSheet
        item={openItem}
        ownerName={name}
        imageUri={openItem ? resolve(openItem.thumbPath, openItem.cutoutPath) : undefined}
        onClose={() => setOpenItem(null)}
        onAsk={askFromSheet}
      />

      {/* FC-02 — the same sheet as the Friends row, minus View closet: you
          are already here. */}
      <FriendOverflowSheet
        profile={overflowOpen && profile ? { ...profile, friendsSince: since.data } : null}
        onClose={() => setOverflowOpen(false)}
        rows={overflowRows}
      />

      {/* The confirms — the Friends atlas's F-07/F-08, unchanged. */}
      <RemoveFriendDialog
        profile={confirm === 'remove' ? profile : null}
        onClose={() => setConfirm(null)}
        onRemove={doUnfriend}
        pending={unfollow.isPending}
      />
      <BlockConfirmSheet
        profile={confirm === 'block' ? profile : null}
        onClose={() => setConfirm(null)}
        onBlock={doBlock}
        pending={block.isPending}
      />
      <ReportProfileSheet
        profile={confirm === 'report' ? profile : null}
        onClose={() => setConfirm(null)}
        onSubmit={submitReport}
        pending={report.isPending || block.isPending}
        sent={reportSent}
        sentWithBlock={reportBlocked}
        onDone={finishReport}
      />

      {/* The ask. A small sheet, not a form: garment, an optional line, send.
          The decline on their side is one canned tap, and this side promises as
          much — the whole flow exists to absorb the awkwardness. */}
      <Modal
        visible={asking !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setAsking(null)}>
        <ComposeAsk
          item={asking}
          name={name}
          message={message}
          onChangeMessage={setMessage}
          pending={requestBorrow.isPending}
          onSend={sendAsk}
          onClose={() => setAsking(null)}
        />
      </Modal>

      {terms.sheet}
    </>
  );
}

/**
 * The borrow compose body — the existing one-message flow, kept verbatim:
 * optional line, Send request, Never mind. Split out only so the Modal above
 * stays readable.
 */
function ComposeAsk({
  item,
  name,
  message,
  onChangeMessage,
  pending,
  onSend,
  onClose,
}: {
  item: FriendItem | null;
  name: string;
  message: string;
  onChangeMessage: (text: string) => void;
  pending: boolean;
  onSend: () => void;
  onClose: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      className="flex-1 justify-end"
      style={{ backgroundColor: theme.scrim }}
      accessibilityLabel="Close"
      onPress={onClose}>
      <KeyboardAvoidingScreen>
        {/* Stop taps inside the card falling through to the scrim. */}
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View className="rounded-t-sheet bg-canvas px-gutter pb-10 pt-6">
            <Text variant="title" trim>
              Ask to borrow
            </Text>
            <Text variant="body" className="mt-3 text-muted">
              {item?.subcategory ?? item?.category ?? ''}
              {item?.brand ? ` · ${item.brand}` : ''} — {name} decides, and either answer is one
              tap for them.
            </Text>

            <View className="mt-4 rounded-md border border-rule px-3">
              <TextInput
                value={message}
                onChangeText={onChangeMessage}
                placeholder="Add a line if you like — “for Thursday?”"
                placeholderTextColor={theme.faint}
                maxLength={500}
                multiline
                accessibilityLabel="Message with your request"
                style={{
                  minHeight: 64,
                  paddingVertical: 10,
                  fontFamily: 'HelveticaNeue',
                  // 17, not 15: matches `body` on the type scale.
                  fontSize: 17,
                  color: theme.ink,
                }}
              />
            </View>

            <Button title="Send request" loading={pending} haptic onPress={onSend} className="mt-5" />
            <Button
              title="Never mind"
              variant="ghost"
              disabled={pending}
              onPress={onClose}
              className="mt-1"
            />
          </View>
        </Pressable>
      </KeyboardAvoidingScreen>
    </Pressable>
  );
}
