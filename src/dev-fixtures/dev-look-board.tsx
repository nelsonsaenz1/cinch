import { Asset } from 'expo-asset';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommentComposer } from '@/components/event-outfits/CommentComposer';
import { CommentRow, type ThreadComment } from '@/components/event-outfits/CommentRow';
import { OutfitPostCard, lookName } from '@/components/event-outfits/OutfitPostCard';
import { AddYoursPill, VotePill } from '@/components/event-outfits/VotePill';
import { Button } from '@/components/ui/button';
import { LookPlate } from '@/components/look/look-plate';
import { Chip } from '@/components/ui/chip';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { leadingId, pickLine } from '@/features/event-outfits/board-logic';
import type { PostedLook } from '@/features/event-outfits/types';
import { resolveColorName } from '@/lib/color';
import type { Garment } from '@/lib/styling';
import { useTheme } from '@/theme/tokens';

/**
 * The Look Board fixture — `cinch://dev-look-board`.
 *
 * Renders L-01 through L-06, the Vote pill's six states, and a fixture L-03
 * comments panel against the real `OutfitPostCard`, `VotePill` and
 * `CommentRow`/`CommentComposer` — no network. See dev-wall.tsx for the
 * pattern this follows.
 *
 * L-03's panel deliberately does NOT mount the real `CommentsSheet`:
 * `CommentsSheet` drives `useCommentThread` → live Supabase queries, and a
 * dev fixture route has no session to query with. It re-lays the same header
 * + `CommentRow` + `CommentComposer` structure with local fixture state
 * instead, so the components under test are still the shipped ones.
 */

/**
 * Static requires, one per file. Metro resolves `require` at build time by
 * walking the module graph, so a template literal inside one resolves to
 * nothing and the route throws "Invalid call" the moment it mounts — which
 * neither the type checker nor the test suite can see, because both stop short
 * of the bundler. Found on the simulator; `dev-share-look.tsx` already had it
 * right.
 */
/**
 * Fixture photographs, resolved through `downloadAsync` before they are shown.
 *
 * `GarmentCell` caches by the URL with its query string stripped, which is
 * right for the signed storage URLs production hands it — the signature rotates
 * while the photograph does not. Metro's dev asset server puts the identity IN
 * the query (`/assets/?unstable_path=…`), so every fixture garment strips to
 * the same key and the first to decode is drawn for all of them: eight
 * garments, one blouse, eight times. `localUri` is a plain `file://` path with
 * no query — but it is null until the asset is downloaded, which is why this
 * waits rather than reading it at module scope. `dev-share-look.tsx` does the
 * same, and `components/item/item-hero.tsx` is where the trap was first paid
 * for.
 */
const ASSETS = {
  coat: Asset.fromModule(require('@/assets/garments/cognac-shearling-coat.jpg')),
  blouse: Asset.fromModule(require('@/assets/garments/white-linen-blouse.jpg')),
  trousers: Asset.fromModule(require('@/assets/garments/charcoal-tailored-trousers.jpg')),
  loafers: Asset.fromModule(require('@/assets/garments/brown-leather-loafers.jpg')),
  sweater: Asset.fromModule(require('@/assets/garments/cream-mohair-sweater.jpg')),
  skirt: Asset.fromModule(require('@/assets/garments/beige-corduroy-skirt.jpg')),
  tote: Asset.fromModule(require('@/assets/garments/cognac-leather-tote.jpg')),
  boots: Asset.fromModule(require('@/assets/garments/brown-leather-boots.jpg')),
};

type PhotoId = keyof typeof ASSETS;

/** A stable synthetic path per fixture garment — resolved to a file at render. */
const IMG: Record<PhotoId, string> = {
  coat: 'fixture/coat',
  blouse: 'fixture/blouse',
  trousers: 'fixture/trousers',
  loafers: 'fixture/loafers',
  sweater: 'fixture/sweater',
  skirt: 'fixture/skirt',
  tote: 'fixture/tote',
  boots: 'fixture/boots',
};

let seq = 0;
const g = (
  slot: Garment['slot'],
  colorName: string,
  subcategory: string,
  cutoutPath: string,
  visualWeight = 1,
): Garment =>
  ({
    id: `f${++seq}`,
    slot,
    category: subcategory,
    subcategory,
    colors: [{ name: colorName, family: colorName, oklch: resolveColorName(colorName)! }],
    visualWeight,
    fit: 'regular',
    pattern: null,
    patternScale: 'none',
    material: null,
    brand: null,
    formality: 3,
    warmth: 3,
    waterResistant: false,
    seasons: [],
    occasions: [],
    wearCount: 0,
    lastWornAt: null,
    purchasePrice: null,
    thumbPath: cutoutPath,
    cutoutPath,
    platePath: cutoutPath,
  }) as unknown as Garment;

const DANAS_LOOK = [
  g('outerwear', 'cognac', 'coat', IMG.coat, 1.3),
  g('base_top', 'white', 'blouse', IMG.blouse, 0.9),
  g('bottom', 'charcoal', 'trousers', IMG.trousers, 1.0),
  g('footwear', 'brown', 'loafers', IMG.loafers, 0.6),
];
const MELS_LOOK = [
  g('mid_layer', 'cream', 'sweater', IMG.sweater, 1.0),
  g('bottom', 'beige', 'skirt', IMG.skirt, 0.95),
  g('footwear', 'brown', 'loafers', IMG.loafers, 0.6),
  g('bag', 'cognac', 'tote', IMG.tote, 0.5),
];
const PRIYAS_LOOK = [
  g('base_top', 'white', 'blouse', IMG.blouse, 0.9),
  g('footwear', 'black', 'boots', IMG.boots, 0.7),
];

const look = (
  id: string,
  userId: string,
  garments: Garment[],
  votes: number,
  voterIds: string[],
  caption: string | null,
  createdAtOffsetMin: number,
): PostedLook => ({
  id,
  eventId: 'ev1',
  userId,
  outfitId: `o-${id}`,
  caption,
  createdAt: new Date(FIXTURE_NOW - createdAtOffsetMin * 60_000),
  garments,
  votes,
  voterIds,
});

const NAMES: Record<string, string> = {
  dana: 'Dana',
  mel: 'Mel',
  priya: 'Priya',
  me: 'You',
};
const nameOf = (userId: string) => (userId === 'me' ? 'You' : (NAMES[userId] ?? null));
/**
 * One timestamp for the whole fixture set, read once at module scope.
 *
 * `FIXTURE_NOW` inside render is an impure call: React may re-render at any
 * moment and the "2h ago" marks would drift a little each time. Fixture data
 * should be identical on every render, which is also what makes a screenshot
 * of this route comparable with the last one.
 */
const FIXTURE_NOW = Date.now();

const FRAMES = ['L-01', 'L-02', 'L-03', 'L-04', 'L-05', 'L-06', 'Pill'] as const;
type Frame = (typeof FRAMES)[number];

/**
 * One line of the overflow menu (L-04).
 *
 * Module scope, not inside the frame that uses it: a component declared during
 * render is a new type on every pass, so React unmounts and remounts the whole
 * subtree instead of updating it. It also shadowed the unrelated `Row` further
 * down this file, which is why it carries a longer name now.
 */
function OverflowRow({ label, destructive }: { label: string; destructive?: boolean }) {
  const theme = useTheme();
  return (
    <View className="min-h-11 justify-center border-b border-hairline px-4 last:border-b-0">
      <Text variant="callout" style={destructive ? { color: theme.critical } : undefined}>
        {label}
      </Text>
    </View>
  );
}

const BY_PATH = new Map(
  (Object.keys(ASSETS) as PhotoId[]).map((id) => [IMG[id], ASSETS[id]] as const),
);

/** Reads `localUri` at call time — it is null until `downloadAsync` resolves. */
const resolveFixtureImage = (...paths: (string | null | undefined)[]): string | undefined => {
  for (const path of paths) {
    const asset = path ? BY_PATH.get(path) : undefined;
    if (asset) return asset.localUri ?? asset.uri;
  }
  return undefined;
};

export default function DevLookBoard() {
  const [frame, setFrame] = useState<Frame>('L-01');

  // One re-render once the files exist on disk; the resolver below reads them.
  const [, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void Promise.all(Object.values(ASSETS).map((a) => a.downloadAsync())).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-canvas">
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView contentContainerClassName="px-gutter pb-32 pt-3">
          <Text variant="colophon">{frame} · Look Board</Text>
          {frame === 'L-01' ? <L01 /> : null}
          {frame === 'L-02' ? <L02 /> : null}
          {frame === 'L-03' ? <L03 /> : null}
          {frame === 'L-04' ? <L04 /> : null}
          {frame === 'L-05' ? <L05 /> : null}
          {frame === 'L-06' ? <L06 /> : null}
          {frame === 'Pill' ? <PillStates /> : null}
        </ScrollView>
      </SafeAreaView>

      <View className="absolute bottom-0 left-0 right-0 border-t border-rule bg-canvas px-3 pb-8 pt-2.5">
        <View className="flex-row flex-wrap gap-2">
          {FRAMES.map((f) => (
            <Chip key={f} label={f} selected={frame === f} selectedGround="ink" onPress={() => setFrame(f)} />
          ))}
        </View>
      </View>
    </View>
  );
}

/** L-01 — not yet voted. Dana is ahead on posting-order alone (first look). */
function L01() {
  const looks = [
    look('a', 'dana', DANAS_LOOK, 3, ['mel', 'priya', 'me'], 'Shearling over the linen blouse. Warm enough for the walk.', 90),
    look('b', 'mel', MELS_LOOK, 2, ['dana', 'priya'], 'The mohair with the corduroy skirt, loafers under.', 60),
    look('c', 'priya', PRIYAS_LOOK, 0, [], null, 30),
  ];
  const aheadId = leadingId(looks);
  return (
    <View className="mt-4 gap-3">
      <Text variant="callout" className="text-muted">
        Three looks on the table. You have one pick — you can move it until Saturday.
      </Text>
      {looks.map((l) => (
        <OutfitPostCard
          key={l.id}
          look={l}
          posterName={nameOf(l.userId)}
          pickLine={pickLine(l.votes, false, l.voterIds.map((v) => nameOf(v)!).filter(Boolean))}
          isMine={false}
          badge={aheadId === l.id ? 'ahead' : null}
          locked={false}
          picked={false}
          votePending={false}
          resolveImage={resolveFixtureImage}
          width={353}
          onToggleVote={() => {}}
          onOpenComments={() => {}}
          commentCount={l.id === 'a' ? 4 : 0}
        />
      ))}
    </View>
  );
}

/** L-02 — your pick just landed, optimistic. Blush hairline, no crown here. */
function L02() {
  const l = look('b', 'mel', MELS_LOOK, 3, ['me', 'dana', 'ben'], 'The mohair with the corduroy skirt, loafers under.', 60);
  return (
    <View className="mt-4">
      <Text variant="callout" className="mb-3 text-muted">
        Your pick is on Mel’s Cream &amp; Cognac. Tap another Vote to move it.
      </Text>
      <View style={{ width: 353 }}>
        <OutfitPostCard
          look={l}
          posterName="Mel"
          pickLine={pickLine(3, true, ['Dana', 'Ben'])}
          isMine={false}
          badge={null}
          locked={false}
          picked
          votePending={false}
          resolveImage={resolveFixtureImage}
          width={353}
          onToggleVote={() => {}}
          onOpenComments={() => {}}
          commentCount={2}
        />
      </View>
    </View>
  );
}

/** L-03 — comments on one look, as a fixture panel (see file header). */
function L03() {
  const theme = useTheme();
  const [rows, setRows] = useState<ThreadComment[]>([
    {
      id: '1', eventId: 'ev1', postId: 'b', userId: 'dana', reported: false, hidden: false,
      body: 'The skirt is the whole thing. Wear the tote, not the clutch.',
      createdAt: new Date(FIXTURE_NOW - 2 * 3_600_000),
    },
    {
      id: '2', eventId: 'ev1', postId: 'b', userId: 'me', reported: false, hidden: false,
      body: 'Both, honestly. Bring the loafers.', createdAt: new Date(FIXTURE_NOW - 4 * 60_000),
    },
  ]);
  const l = look('b', 'mel', MELS_LOOK, 3, ['dana', 'me', 'ben'], null, 60);

  return (
    <View className="mt-4 overflow-hidden rounded-plate border border-hairline bg-surface">
      <View className="flex-row items-center gap-3 border-b border-hairline px-4 py-3.5">
        <LookPlate pieces={l.garments} width={44} resolveImage={resolveFixtureImage} padding={3} gap={2} />
        <View className="flex-1">
          <Text variant="plate" trim numberOfLines={1}>
            {lookName(l.garments, l.caption)}
          </Text>
          <Text variant="caption">Mel · 3 picks</Text>
        </View>
      </View>
      <View className="px-4">
        {rows.map((c) => (
          <CommentRow
            key={c.id}
            comment={c}
            authorName={nameOf(c.userId)}
            isMine={c.userId === 'me'}
            isHost={false}
            hiddenByName={null}
            onReply={() => {}}
            onReport={() => {}}
            onDelete={(row) => setRows((r) => r.filter((x) => x.id !== row.id))}
            onToggleHidden={() => {}}
          />
        ))}
      </View>
      <View style={{ backgroundColor: theme.canvas }}>
        <CommentComposer
          replyToName={null}
          onCancelReply={() => {}}
          onSend={(body) =>
            setRows((r) => [
              ...r,
              { id: `n${r.length}`, eventId: 'ev1', postId: 'b', userId: 'me', reported: false, hidden: false, body, createdAt: new Date() },
            ])
          }
        />
      </View>
    </View>
  );
}

/** L-04 — overflow, someone else's look vs your own. Static, since ActionSheetIOS can't be screenshotted. */
function L04() {
  const theme = useTheme();
  return (
    <View className="mt-4 gap-6">
      <View>
        <Text variant="eyebrow" className="mb-3">
          Someone else’s look
        </Text>
        <View className="overflow-hidden rounded-plate border border-hairline bg-surface">
          <OverflowRow label="Share this look" />
          <OverflowRow label="Report this look" destructive />
          <OverflowRow label="Block Mel" destructive />
        </View>
      </View>
      <View>
        <Text variant="eyebrow" className="mb-3">
          Your own look
        </Text>
        <View className="overflow-hidden rounded-plate border border-hairline bg-surface">
          <OverflowRow label="Share another option" />
          <OverflowRow label="Take it off the board" destructive />
        </View>
      </View>
      <View className="rounded-plate border border-hairline bg-surface p-4">
        <Text variant="plate" trim>
          Block Mel?
        </Text>
        <Text variant="callout" className="mt-2 text-muted">
          You stop seeing each other’s looks and comments here. Mel isn’t told, and the host isn’t either.
        </Text>
      </View>
    </View>
  );
}

/**
 * L-05 — voting closed.
 *
 * NOT "the crown reveal" any more. D-2b removed the crown, so a locked board
 * carries its counts and nothing else: no badge, no pill, nothing declared the
 * favourite. The leading look is still the one drawn here, because it is the
 * one with the most picks and the frame is about the tallies being final —
 * but nothing on the card says so, which is the point.
 */
function L05() {
  const looks = [
    look('a', 'dana', DANAS_LOOK, 6, ['mel', 'priya', 'me', 'ben', 'tom', 'x'], 'Shearling over the linen blouse. Warm enough for the walk.', 300),
    look('b', 'mel', MELS_LOOK, 5, ['me', 'dana', 'ben', 'tom', 'priya'], 'The mohair with the corduroy skirt, loafers under.', 200),
  ];
  const leader = looks.find((l) => l.id === leadingId(looks))!;
  return (
    <View className="mt-4">
      <Text variant="callout" className="mb-3 text-muted">
        Voting closed. Two looks, eleven picks between them.
      </Text>
      <View style={{ width: 353 }}>
        <OutfitPostCard
          look={leader}
          posterName="Mel"
          pickLine={pickLine(5, true, ['Dana', 'Ben', 'Tom', 'Priya'])}
          isMine={false}
          badge={null}
          locked
          picked
          votePending={false}
          resolveImage={resolveFixtureImage}
          width={353}
          onToggleVote={() => {}}
          onOpenComments={() => {}}
          commentCount={6}
        />
      </View>
      <View className="mt-4 rounded-plate bg-tray px-4 py-3.5">
        <Text variant="callout" className="text-muted">
          Everyone’s picks are in. Mel’s look took the room.
        </Text>
      </View>
      <View className="mt-3 flex-row gap-2">
        <Button title="Share the board" variant="secondary" haptic onPress={() => {}} className="flex-1" />
        <Button title="Save mine to Lately" variant="ink" haptic onPress={() => {}} className="flex-1" />
      </View>
    </View>
  );
}

/** L-06 — empty, one-look, loading, failed. */
function L06() {
  const single = look('a', 'dana', DANAS_LOOK, 0, [], null, 5);
  return (
    <View className="mt-4 gap-8">
      <View>
        <Text variant="eyebrow" className="mb-2">
          Nobody has posted yet
        </Text>
        <Text variant="title" trim>
          Be the first on the board
        </Text>
        <Text variant="callout" className="mt-2 text-muted">
          Boards fill up fast once one look is on them. Post yours and the others follow.
        </Text>
        <Button title="Share your look" haptic onPress={() => {}} className="mt-3 self-start px-6" />
      </View>

      <View>
        <Text variant="eyebrow" className="mb-3">
          One look only
        </Text>
        <View style={{ width: 300 }}>
          <OutfitPostCard
            look={single}
            posterName="Dana"
            pickLine={null}
            isMine={false}
            badge={null}
            locked={false}
            picked={false}
            votePending={false}
            resolveImage={resolveFixtureImage}
            width={300}
            onToggleVote={() => {}}
            onAddYours={() => {}}
            onOpenComments={() => {}}
            commentCount={0}
          />
        </View>
      </View>

      <View>
        <Text variant="eyebrow" className="mb-3">
          Loading
        </Text>
        <View className="flex-row gap-3">
          <Skeleton className="h-44 rounded-plate" style={{ width: 220 }} />
          <Skeleton className="h-72 rounded-plate" style={{ width: 70 }} />
        </View>
      </View>

      <View>
        <Text variant="plate" trim>
          The board didn’t load
        </Text>
        <Text variant="callout" className="mt-2 text-muted">
          Nobody’s look is lost — the connection dropped on the way. Your pick is still where you left it.
        </Text>
        <Button title="Try again" variant="secondary" haptic onPress={() => {}} className="mt-3 self-start px-6" />
      </View>
    </View>
  );
}

/** The Vote pill's six states, plus Add yours. */
function PillStates() {
  const [demoPicked, setDemoPicked] = useState(false);
  return (
    <View className="mt-4 gap-4">
      <Row label="Rest">
        <VotePill votes={4} picked={false} mine={false} locked={false} pending={false} onToggle={() => {}} />
      </Row>
      <Row label="Picked — optimistic">
        <VotePill votes={5} picked mine={false} locked={false} pending={false} onToggle={() => {}} />
      </Row>
      <Row label="Still in flight (dims past 2s)">
        <VotePill votes={5} picked mine={false} locked={false} pending onToggle={() => {}} />
      </Row>
      <Row label="Refused">
        <VotePill votes={4} picked={false} mine={false} locked={false} pending={false} failed onToggle={() => {}} onRetry={() => {}} />
      </Row>
      <Row label="Voting closed">
        <VotePill votes={6} picked={false} mine={false} locked pending={false} onToggle={() => {}} />
      </Row>
      <Row label="Add yours (one-look board)">
        <AddYoursPill onPress={() => {}} />
      </Row>
      <Row label="Live — tap to toggle">
        <VotePill votes={demoPicked ? 4 : 3} picked={demoPicked} mine={false} locked={false} pending={false} onToggle={() => setDemoPicked((p) => !p)} />
      </Row>
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text variant="callout" className="flex-1 text-muted">
        {label}
      </Text>
      {children}
    </View>
  );
}
