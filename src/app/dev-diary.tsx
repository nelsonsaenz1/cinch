import { Asset } from 'expo-asset';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { DiaryPage } from '@/features/diary/diary-page';
import { EntryPage } from '@/features/diary/entry-page';
import {
  ALL_YEARS,
  filterByYear,
  groupByMonth,
  isCorrectable,
  yearChips,
} from '@/features/diary/entry';
import { NoteSheet } from '@/features/diary/note-sheet';
import type { DiaryEntry, DiaryPiece } from '@/features/diary/types';

/**
 * Wear diary fixture — `cinch://dev-diary`.
 *
 * A picker over atlas 33 (WD-01…WD-04), so every frame can be verified on a
 * simulator where the real screen needs a session and a populated `outfits`
 * table with months of history behind it.
 *
 * Every frame is drawn by the SAME components the real screens use — `DiaryPage`
 * and `EntryPage` — and every line of type comes from the real selectors in
 * `features/diary/entry.ts` over fixture rows. There is no transcribed copy in
 * this file: if a frame needs to read differently, the selector changes, not
 * this fixture.
 *
 * The handlers ADVANCE the picker rather than no-op. A dev route posing a state
 * you cannot leave is a dead end you can only escape by relaunching, and the
 * two writes on WD-03 (the note, keeping the plate) mutate local state so their
 * results are visible here rather than only against a real database.
 */

// ---------------------------------------------------------------------------
// Fixture photographs
// ---------------------------------------------------------------------------

/**
 * Static requires, one per file — Metro resolves `require` by walking the
 * module graph at build time, so a template literal inside one throws "Invalid
 * call" the moment the route mounts, which neither tsc nor the tests can see.
 *
 * Read through `localUri` rather than `uri`, and only after `downloadAsync`:
 * Metro's dev asset server puts the identity in the QUERY STRING, and any
 * consumer that caches on the URL with its query stripped therefore draws the
 * first decoded photograph for all of them. `localUri` is a plain `file://`
 * path with no query, and it is null until the download resolves.
 */
const ASSETS = {
  coat: Asset.fromModule(require('@/assets/garments/cognac-shearling-coat.jpg')),
  trousers: Asset.fromModule(require('@/assets/garments/charcoal-tailored-trousers.jpg')),
  loafers: Asset.fromModule(require('@/assets/garments/brown-leather-loafers.jpg')),
  blouse: Asset.fromModule(require('@/assets/garments/white-linen-blouse.jpg')),
  skirt: Asset.fromModule(require('@/assets/garments/beige-corduroy-skirt.jpg')),
  sweater: Asset.fromModule(require('@/assets/garments/cream-mohair-sweater.jpg')),
  tote: Asset.fromModule(require('@/assets/garments/cognac-leather-tote.jpg')),
};

type PhotoId = keyof typeof ASSETS;

/** A synthetic storage path per fixture garment, resolved to a file at render. */
const path = (id: PhotoId) => `fixture/${id}`;

const BY_PATH = new Map(
  (Object.keys(ASSETS) as PhotoId[]).map((id) => [path(id), ASSETS[id]] as const),
);

const resolveFixtureImage = (piece: DiaryPiece): string | undefined => {
  for (const p of piece.imagePaths) {
    const asset = p ? BY_PATH.get(p) : undefined;
    if (asset) return asset.localUri ?? asset.uri;
  }
  return undefined;
};

// ---------------------------------------------------------------------------
// Fixture rows
// ---------------------------------------------------------------------------

function piece(
  id: PhotoId,
  kind: string,
  colorName: string | null,
  brand: string | null,
  wearCount: number,
  purchasePrice: number | null,
): DiaryPiece {
  return {
    id,
    kind,
    category: 'other',
    colorName,
    brand,
    wearCount,
    purchasePrice,
    imagePaths: [path(id)],
  };
}

// The three priced pieces are the atlas's own figures, arrived at by division
// rather than transcribed: 348/6 = $58, 418/22 = $19, 451/41 = $11.
const COAT = piece('coat', 'shearling coat', 'cognac', 'Toteme', 6, 348);
const TROUSERS = piece('trousers', 'tailored trousers', 'charcoal', 'The Row', 22, 418);
const LOAFERS = piece('loafers', 'penny loafers', 'chestnut', 'Church’s', 41, 451);
// The honest common case: `purchase_price` is nullable and usually null, so
// these two carry a wear count and no cost-per-wear line at all.
const BLOUSE = piece('blouse', 'linen blouse', 'white', null, 14, null);
const SKIRT = piece('skirt', 'corduroy skirt', 'beige', null, 9, null);
const SWEATER = piece('sweater', 'mohair sweater', 'cream', null, 18, null);
const TOTE = piece('tote', 'leather tote', 'cognac', null, 31, null);

/** `daysAgo` days back at the given local time. */
function at(daysAgo: number, hour = 8, minute = 12): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** The same, a whole year earlier — what makes the year chips appear. */
function lastYear(daysAgo: number): string {
  const d = new Date(at(daysAgo));
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString();
}

let seq = 0;
function entry(wornAt: string, pieces: DiaryPiece[], extras: Partial<DiaryEntry> = {}): DiaryEntry {
  return {
    id: `wd-${++seq}`,
    wornAt,
    name: null,
    occasion: null,
    note: null,
    savedAt: null,
    originOutfitId: null,
    source: 'ai',
    pieces,
    ...extras,
  };
}

const TODAY_ENTRY = entry(at(0), [COAT, TROUSERS, LOAFERS], {
  id: 'wd-today',
  occasion: 'Dinner at Nora’s',
  note: 'Coat too warm indoors. Worth taking the lighter one next time.',
});

/** Older than the correction window, and with nothing priced in it. */
const OLD_ENTRY = entry(at(9, 7, 45), [BLOUSE, SKIRT], {
  id: 'wd-old',
  occasion: 'Work',
});

const THIS_YEAR_ENTRIES: DiaryEntry[] = [
  TODAY_ENTRY,
  entry(at(2, 7, 50), [BLOUSE, SKIRT], { occasion: 'Work' }),
  entry(at(4, 9, 5), [SWEATER, TROUSERS], { occasion: 'Quiet day' }),
  OLD_ENTRY,
  entry(at(38, 12, 30), [SKIRT, BLOUSE, LOAFERS], { occasion: 'Sunday lunch' }),
  entry(at(45, 8, 20), [TROUSERS, SWEATER], {
    occasion: 'Work',
    note: 'Sleeves shed a little.',
  }),
  entry(at(52, 6, 55), [TOTE, BLOUSE, SKIRT], { occasion: 'Travel' }),
];

const SPANNING_ENTRIES: DiaryEntry[] = [
  ...THIS_YEAR_ENTRIES,
  entry(lastYear(20), [COAT, TROUSERS], { occasion: 'Dinner' }),
  entry(lastYear(60), [SWEATER, SKIRT], { occasion: 'Work' }),
];

// ---------------------------------------------------------------------------
// The picker
// ---------------------------------------------------------------------------

const STATES = [
  { id: 'WD-01', name: 'Populated — spans two years, chips shown' },
  { id: 'WD-01a', name: 'Populated — first year, no chips at all' },
  { id: 'WD-01e', name: 'Spine — the read failed' },
  { id: 'WD-02', name: 'Empty — nothing recorded yet' },
  { id: 'WD-03', name: 'Entry — today, noted, priced, correctable' },
  { id: 'WD-03a', name: 'Entry — nine days old, no note, no prices' },
  { id: 'WD-04', name: 'Loading — reading the record' },
] as const;

type StateId = (typeof STATES)[number]['id'];

export default function DevDiaryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<StateId>('WD-01');
  const [chip, setChip] = useState<string>(ALL_YEARS);

  // The two WD-03 writes, held locally so their results are visible here.
  const [notes, setNotes] = useState<Record<string, string | null>>({});
  const [kept, setKept] = useState<Record<string, boolean>>({});
  const [editingNote, setEditingNote] = useState(false);

  // One re-render once the fixture files exist on disk; the resolver reads them.
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

  const onEntry = state === 'WD-03' || state === 'WD-03a';
  const source = state === 'WD-01a' ? THIS_YEAR_ENTRIES : SPANNING_ENTRIES;

  const base = onEntry ? (state === 'WD-03' ? TODAY_ENTRY : OLD_ENTRY) : TODAY_ENTRY;
  const shown: DiaryEntry = {
    ...base,
    note: base.id in notes ? notes[base.id] : base.note,
    savedAt: kept[base.id] ? new Date().toISOString() : base.savedAt,
  };
  const month = groupByMonth(SPANNING_ENTRIES).find((m) =>
    m.entries.some((e) => e.id === base.id),
  ) ?? { key: '', label: '', count: 0, entries: [] };

  const selected = STATES.find((s) => s.id === state)!;

  return (
    <View className="flex-1 bg-canvas">
      {onEntry ? (
        <EntryPage
          entry={shown}
          monthLabel={month.label}
          monthCount={month.count}
          onBack={() => setState('WD-01')}
          resolveImage={resolveFixtureImage}
          onWearAgain={() => setState('WD-01')}
          wearingAgain={false}
          onKeep={() => setKept((k) => ({ ...k, [base.id]: true }))}
          keeping={false}
          onEditNote={() => setEditingNote(true)}
          correctable={isCorrectable(shown.wornAt)}
          onRemove={() => setState('WD-01')}
          removing={false}
          error={null}
        />
      ) : (
        <DiaryPage
          months={
            state === 'WD-02' || state === 'WD-04' || state === 'WD-01e'
              ? []
              : groupByMonth(filterByYear(source, chip))
          }
          chips={state === 'WD-01' || state === 'WD-01a' ? yearChips(source) : []}
          selectedChip={chip}
          onSelectChip={setChip}
          loading={state === 'WD-04'}
          error={state === 'WD-01e'}
          retrying={false}
          onRetry={() => setState('WD-01')}
          showEmpty={state === 'WD-02'}
          onPlanToday={() => setState('WD-01')}
          onOpenEntry={() => setState('WD-03')}
          onBack={() => (router.canGoBack() ? router.back() : undefined)}
          refreshing={false}
          onRefresh={() => undefined}
          resolveImage={resolveFixtureImage}
        />
      )}

      <NoteSheet
        visible={editingNote}
        initial={shown.note ?? ''}
        onCancel={() => setEditingNote(false)}
        onSave={(next) => {
          setNotes((n) => ({
            ...n,
            [base.id]: next.trim() === '' ? null : next.trim(),
          }));
          setEditingNote(false);
        }}
      />

      {/* Scaffolding, not a designed surface — floated over the foot of the
          frame so the page above keeps its real geometry. */}
      <View
        className="absolute inset-x-0 bottom-0 border-t border-rule bg-canvas"
        style={{ paddingBottom: Math.max(insets.bottom, 10) }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 px-gutter py-2">
          {STATES.map((s) => (
            <Chip
              key={s.id}
              label={s.id}
              selected={s.id === state}
              onPress={() => setState(s.id)}
            />
          ))}
        </ScrollView>
        <Text variant="caption" className="px-gutter pb-1">
          {selected.id} · {selected.name}
        </Text>
      </View>
    </View>
  );
}
