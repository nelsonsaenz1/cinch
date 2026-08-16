import { useAssets } from 'expo-asset';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FriendItemSheet } from '@/components/social/FriendItemSheet';
import { FriendOverflowSheet, type FriendSheetRow } from '@/components/social/FriendOverflowSheet';
import { ReportProfileSheet } from '@/components/social/ReportProfileSheet';
import { Chip } from '@/components/ui/chip';
import {
  FriendClosetView,
  type FriendClosetStats,
  type FriendClosetStatus,
} from '@/app/friends/[userId]';
import type { FriendItem, SocialProfile } from '@/features/social-graph/types';

/**
 * Friend's Closet fixture — `cinch://dev-friend-closet`.
 *
 * The Friend Closet State Atlas (FC-01…FC-06) posed on-device, signed out,
 * with no network and no mutations in flight. Every pose mounts the SAME
 * components the live page renders — `FriendClosetView` is the exported
 * render tree of friends/[userId].tsx, and the sheets are the shipped sheets
 * fed fixture props — so the fixture cannot drift from the screen it
 * documents. Plate SVGs stand in for garment photographs, as in dev-closet.
 *
 * Dev-only, like dev-closet and dev-describe: no registration needed —
 * Expo Router registers every file under src/app/, and the auth gate bounces
 * every `dev-` route in release builds (_layout.tsx L134).
 */

// Downloaded (useAssets) rather than read as Metro URLs, for dev-describe's
// reason: every bundler asset shares one `/assets` path with the file in the
// query string, and `stableImageSource` keys its cache on the path alone —
// so raw Metro URLs collapse into one cache entry and every tile shows the
// first picture to load. A downloaded asset's `file://` localUri is distinct.
const ART = [
  require('@/assets/plates/plate-01-coat.svg'),
  require('@/assets/plates/plate-01-knit.svg'),
  require('@/assets/plates/plate-01-trousers.svg'),
  require('@/assets/plates/plate-01-shoes.svg'),
  require('@/assets/plates/plate-01-scarf.svg'),
];

/** Days ago → ISO, so "last worn Tuesday" stays relative and never staled. */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function fixtureItem(
  id: string,
  subcategory: string,
  wearCount: number,
  opts: { borrowable?: boolean; lastWornDaysAgo?: number | null } = {},
): FriendItem {
  return {
    id,
    userId: 'fixture-ada',
    category: 'other',
    subcategory,
    colors: [],
    pattern: null,
    material: null,
    brand: null,
    seasons: [],
    occasions: [],
    description: null,
    thumbPath: null,
    cutoutPath: null,
    platePath: null,
    borrowable: opts.borrowable ?? false,
    createdAt: daysAgo(200),
    wearCount,
    lastWornAt: opts.lastWornDaysAgo == null ? null : daysAgo(opts.lastWornDaysAgo),
    // commerce-directive.md C-04/C-05 — no fixture pose exercises "Find it"
    // yet; false matches the column's own default (20260811150000).
    shoppable: false,
  };
}

// The atlas's cast: FC-01's six pieces, names and wear counts verbatim.
const ITEMS: FriendItem[] = [
  fixtureItem('fx-coat', 'shearling coat', 112, { borrowable: true, lastWornDaysAgo: 3 }),
  fixtureItem('fx-blouse', 'linen blouse', 44, { lastWornDaysAgo: 9 }),
  fixtureItem('fx-tote', 'leather tote', 27, { borrowable: true, lastWornDaysAgo: 1 }),
  fixtureItem('fx-sweater', 'mohair sweater', 63, { lastWornDaysAgo: null }),
  fixtureItem('fx-loafers', 'leather loafers', 81, { lastWornDaysAgo: 0 }),
  fixtureItem('fx-skirt', 'corduroy skirt', 9, { borrowable: true, lastWornDaysAgo: 40 }),
];

/** Which plate stands in for which garment. */
const ART_FOR: Record<string, number> = {
  'fx-coat': 0,
  'fx-blouse': 1,
  'fx-tote': 4,
  'fx-sweater': 1,
  'fx-loafers': 3,
  'fx-skirt': 2,
};

const ADA: SocialProfile & { friendsSince: string } = {
  userId: 'fixture-ada',
  username: 'adam',
  displayName: 'Ada Márquez',
  avatarUrl: null,
  bio: 'Mostly wool and secondhand. Ask me about the coat — I’ve worn it 112 times.',
  // March of the current year — "friends since March", per FC-01.
  friendsSince: new Date(new Date().getFullYear(), 2, 14).toISOString(),
};

const ADA_STATS: FriendClosetStats = { pieces: 96, wearsLogged: 1340, costPerWear: 3.1 };

/** The poses, in atlas order. Sheet poses ride on top of the loaded page. */
const POSES = [
  { key: 'loaded', label: 'FC-01 · Loaded' },
  { key: 'item-borrowable', label: 'FC-03 · Borrowable' },
  { key: 'item-quiet', label: 'FC-03 · Not lending' },
  { key: 'overflow', label: 'FC-02 · Overflow' },
  { key: 'report', label: 'F-08 · Report' },
  { key: 'empty', label: 'FC-04 · Empty' },
  { key: 'hidden', label: 'FC-04 · Hidden' },
  { key: 'lapsed', label: 'Lapsed' },
  { key: 'error', label: 'FC-05 · Error' },
  { key: 'loading', label: 'FC-06 · Loading' },
] as const;

type PoseKey = (typeof POSES)[number]['key'];

export default function DevFriendClosetScreen() {
  const insets = useSafeAreaInsets();
  const [pose, setPose] = useState<PoseKey>('loaded');

  // Report-sheet theatre: the send "lands" locally so the receipt can be seen.
  const [reportSent, setReportSent] = useState(false);
  const [reportWithBlock, setReportWithBlock] = useState(true);

  const [assets] = useAssets(ART);
  const resolveImage = (item: FriendItem) => {
    if (!assets) return undefined;
    const art = assets[ART_FOR[item.id] ?? 0];
    return art?.localUri ?? art?.uri ?? undefined;
  };

  const backToLoaded = () => {
    setPose('loaded');
    setReportSent(false);
  };

  // FC-04's own cast for the two quiet frames; Ada carries everything else.
  const persona =
    pose === 'empty'
      ? { name: 'Theo Ansah', handleLine: '@theoansah', bio: null }
      : pose === 'hidden'
        ? { name: 'Iris Kaneko', handleLine: '@iriskaneko', bio: null }
        : {
            name: 'Ada Márquez',
            handleLine: '@adam · friends since March',
            bio: ADA.bio,
          };

  const pageStatus: FriendClosetStatus =
    pose === 'empty' || pose === 'hidden' || pose === 'lapsed' || pose === 'error' || pose === 'loading'
      ? pose
      : 'loaded';

  const showStats = pageStatus === 'loaded';

  const overflowRows: FriendSheetRow[] = [
    { label: 'Ask to borrow something', chevron: true, onPress: backToLoaded },
    { label: 'Mute in Lately', chevron: true, onPress: backToLoaded },
    { label: 'Unfriend', destructive: true, onPress: backToLoaded },
    { label: 'Report', destructive: true, onPress: () => setPose('report') },
    { label: 'Block', destructive: true, onPress: backToLoaded },
  ];

  return (
    <View className="flex-1 bg-canvas">
      <FriendClosetView
        name={persona.name}
        handleLine={persona.handleLine}
        avatarUri={null}
        bio={pageStatus === 'loaded' || pageStatus === 'empty' ? persona.bio : null}
        stats={showStats ? ADA_STATS : null}
        status={pageStatus}
        items={pageStatus === 'loaded' ? ITEMS : []}
        resolveImage={resolveImage}
        onBack={backToLoaded}
        onOverflow={() => setPose('overflow')}
        onItemPress={(item) =>
          setPose(item.borrowable ? 'item-borrowable' : 'item-quiet')
        }
        onRetry={backToLoaded}
      />

      {/* The sheets, posed over the loaded page — the exact shipped components. */}
      <FriendItemSheet
        item={
          pose === 'item-borrowable'
            ? (ITEMS.find((i) => i.id === 'fx-coat') ?? null)
            : pose === 'item-quiet'
              ? (ITEMS.find((i) => i.id === 'fx-sweater') ?? null)
              : null
        }
        ownerName="Ada Márquez"
        imageUri={
          pose === 'item-borrowable' || pose === 'item-quiet'
            ? resolveImage(
                ITEMS.find((i) => i.id === (pose === 'item-borrowable' ? 'fx-coat' : 'fx-sweater'))!,
              )
            : undefined
        }
        onClose={backToLoaded}
        onAsk={backToLoaded}
        onFindIt={backToLoaded}
      />
      <FriendOverflowSheet
        profile={pose === 'overflow' ? ADA : null}
        onClose={backToLoaded}
        rows={overflowRows}
      />
      <ReportProfileSheet
        profile={pose === 'report' ? ADA : null}
        onClose={backToLoaded}
        onSubmit={({ blockToo }) => {
          setReportWithBlock(blockToo);
          setReportSent(true);
        }}
        pending={false}
        sent={reportSent}
        sentWithBlock={reportWithBlock}
        onDone={backToLoaded}
      />

      {/* The pose switcher — floated at the foot so the atlas framing above
          stays untouched. Fixture chrome, not app UI. */}
      <View
        className="absolute inset-x-0 bottom-0 border-t border-hairline bg-canvas"
        style={{ paddingBottom: Math.max(insets.bottom, 10) }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 7, paddingHorizontal: 20, paddingVertical: 10 }}>
          {POSES.map((p) => (
            <Chip
              key={p.key}
              label={p.label}
              selected={pose === p.key}
              selectedGround="ink"
              onPress={() => {
                setReportSent(false);
                setPose(p.key);
              }}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}
