import { Asset } from 'expo-asset';
import { useState } from 'react';
import { Image } from 'expo-image';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BoardEditSheet } from '@/components/boards/board-edit-sheet';
import { BoardPage } from '@/components/boards/board-page';
import { KeepSheet } from '@/components/boards/keep-sheet';
import { SavedPage } from '@/components/boards/saved-page';
import { Chip, Text } from '@/components/ui';
import { isDatedBoard } from '@/features/boards/board-lines';
import type { Board, KeptPlate } from '@/features/boards/types';

/**
 * Saved & boards fixture — `cinch://dev-saved`.
 *
 * A picker over atlas 35 (KP-01…KP-05), so every state can be verified on a
 * simulator, where the real screens need a session, a populated `outfits`
 * table with `saved_at` set, and — for the wear counts — a lineage nothing in
 * the app writes yet.
 *
 * EVERY FRAME IS DRAWN BY THE SHIPPING COMPONENT. `SavedPage`, `BoardPage`,
 * `KeepSheet` and `BoardEditSheet` are the same objects `saved.tsx` and
 * `board/[id].tsx` render; there is no copy and no re-drawn layout in this
 * file. A fixture that approximates a screen verifies the approximation.
 *
 * AND EVERY HANDLER MOVES. Keeping, moving, creating a board and removing a
 * plate all mutate the fixture state or advance the picker — a sheet whose
 * buttons are no-ops is a state nobody can get out of, which is how a dev
 * route becomes a dead end.
 *
 * Dev-only twice over: the gate in `app/_layout.tsx` bounces the whole `dev-`
 * prefix outside `__DEV__`, and this file refuses again below.
 */

// ---------------------------------------------------------------------------
// The wardrobe the atlas itself is drawn from
// ---------------------------------------------------------------------------

const uri = (mod: number) => Asset.fromModule(mod).uri;

const TROUSERS = uri(require('@/assets/garments/charcoal-tailored-trousers.jpg'));
const BLOUSE = uri(require('@/assets/garments/white-linen-blouse.jpg'));
const LOAFERS = uri(require('@/assets/garments/brown-leather-loafers.jpg'));
const TOTE = uri(require('@/assets/garments/cognac-leather-tote.jpg'));
const COAT = uri(require('@/assets/garments/cognac-shearling-coat.jpg'));
const SKIRT = uri(require('@/assets/garments/beige-corduroy-skirt.jpg'));
const SWEATER = uri(require('@/assets/garments/cream-mohair-sweater.jpg'));

/**
 * A fixture plate. `imagePaths` carries the display URIs directly — the real
 * screen signs storage paths first, and the component below only ever sees the
 * signed result, so a fixture that skips the signing is drawing the same thing.
 */
function plate(
  id: string,
  name: string,
  boardId: string | null,
  wornCount: number,
  images: string[],
): KeptPlate {
  return {
    id,
    name,
    occasion: null,
    savedAt: new Date().toISOString(),
    boardId,
    wornCount,
    itemIds: images.map((_, i) => `${id}-item-${i}`),
    imagePaths: [images[0] ?? null, images[1] ?? null, images[2] ?? null, images[3] ?? null],
    // Every fixture piece HAS a photograph, so UX #62's pictureless treatment
    // never fires here. Empty cells rather than invented names: a fixture that
    // posed a swatch nobody's data would produce is a fixture of nothing.
    cells: [0, 1, 2, 3].map(() => ({ label: null, color: null })),
  };
}

/** September of whichever year is still ahead, so the range never reads as past. */
function septemberRange() {
  const now = new Date();
  const year = now.getMonth() > 8 ? now.getFullYear() + 1 : now.getFullYear();
  return { startsOn: `${year}-09-14`, endsOn: `${year}-09-19` };
}

const MARCH = '2026-03-04T10:00:00Z';

const LISBON: Board = { id: 'lisbon', name: 'Lisbon', ...septemberRange(), createdAt: MARCH };
const WORK: Board = { id: 'work', name: 'Work', startsOn: null, endsOn: null, createdAt: MARCH };
const WEEKENDS: Board = {
  id: 'weekends',
  name: 'Weekends',
  startsOn: null,
  endsOn: null,
  createdAt: MARCH,
};
const EVENING: Board = {
  id: 'evening',
  name: 'Evening',
  startsOn: null,
  endsOn: null,
  createdAt: MARCH,
};

const SAVED_SET: KeptPlate[] = [
  plate('p-monday', 'Monday standard', 'work', 6, [TROUSERS, BLOUSE, LOAFERS, TOTE]),
  plate('p-cold', 'Cold dinner', 'evening', 2, [COAT, TROUSERS, LOAFERS]),
  plate('p-sunday', 'Sunday lunch', 'weekends', 0, [SKIRT, SWEATER, LOAFERS]),
  plate('p-lisbon', 'Lisbon, day one', 'lisbon', 0, [BLOUSE, SKIRT, TOTE]),
];

const LISBON_SET: KeptPlate[] = [
  plate('b-day-one', 'Day one', 'lisbon', 0, [BLOUSE, SKIRT, TOTE]),
  plate('b-alfama', 'Dinner, Alfama', 'lisbon', 0, [SWEATER, TROUSERS]),
  plate('b-meeting', 'The meeting', 'lisbon', 0, [BLOUSE, TROUSERS, LOAFERS]),
  plate('b-last', 'Last morning', 'lisbon', 0, [SKIRT, BLOUSE]),
];

const STATES = [
  { id: 'KP-01', name: 'Populated — the saved set' },
  { id: 'KP-02', name: 'Empty — nothing kept' },
  { id: 'KP-03', name: 'Board — dated, sends to Packing' },
  { id: 'KP-03b', name: 'Board — undated, no Packing' },
  { id: 'KP-04', name: 'Keeping a look — the sheet' },
  { id: 'KP-04b', name: 'Moving a kept plate' },
  { id: 'KP-05', name: 'Loading — reading saved' },
  { id: 'KP-06', name: 'Edit board — name and dates' },
] as const;

type StateId = (typeof STATES)[number]['id'];

export default function DevSavedScreen() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<StateId>('KP-01');

  // Live fixture state, so the sheets are not a diorama: a board created in
  // the Keep sheet appears in the list, a selection sticks, and keeping or
  // removing returns to the collection.
  const [boards, setBoards] = useState<Board[]>([LISBON, WORK, WEEKENDS, EVENING]);
  const [plates, setPlates] = useState<KeptPlate[]>(SAVED_SET);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const selected = STATES.find((s) => s.id === state)!;
  const imageUrisFor = (p: KeptPlate) => p.imagePaths.map((path) => path ?? undefined);

  const sheetBoards = boards.map((board) => ({
    id: board.id,
    name: board.name,
    plateCount: plates.filter((p) => p.boardId === board.id).length,
  }));

  const createFixtureBoard = (name: string) => {
    const id = `fx-${name.toLowerCase().replace(/\s+/g, '-')}-${boards.length}`;
    setBoards((prev) => [...prev, { id, name, startsOn: null, endsOn: null, createdAt: MARCH }]);
    setSelectedBoardId(id);
  };

  /** Both sheets land back on the collection, so no frame is a cul-de-sac. */
  const backToCollection = () => {
    setSelectedBoardId(null);
    setState('KP-01');
  };

  const boardFrame = (board: Board, set: KeptPlate[]) => (
    <BoardPage
      board={board}
      plates={set}
      loading={false}
      error={false}
      imageUrisFor={imageUrisFor}
      onBack={() => setState('KP-01')}
      onEdit={() => setState('KP-06')}
      onOpenPlate={() => setState('KP-04b')}
      onSendToPacking={isDatedBoard(board) ? () => setState('KP-01') : null}
      onAddPlate={() => setState('KP-01')}
    />
  );

  return (
    <View className="flex-1 bg-canvas">
      {state === 'KP-03' ? (
        boardFrame(LISBON, LISBON_SET)
      ) : state === 'KP-03b' ? (
        boardFrame(WEEKENDS, plates.filter((p) => p.boardId === 'weekends'))
      ) : state === 'KP-04' || state === 'KP-04b' ? (
        <PlateGround />
      ) : (
        <SavedPage
          loading={state === 'KP-05'}
          error={false}
          plates={state === 'KP-02' ? [] : plates}
          boards={state === 'KP-02' ? [] : boards}
          imageUrisFor={imageUrisFor}
          onOpenBoard={() => setState('KP-03')}
          onOpenPlate={() => setState('KP-04b')}
          onPlanALook={() => setState('KP-01')}
          onBack={() => setState('KP-01')}
        />
      )}

      {/* KP-04 · keeping, and KP-04b · moving — the same sheet, raised over the
          plate the atlas draws it over. */}
      <KeepSheet
        visible={state === 'KP-04' || state === 'KP-04b'}
        mode={state === 'KP-04b' ? 'move' : 'keep'}
        boards={sheetBoards}
        selectedBoardId={selectedBoardId}
        onSelectBoard={setSelectedBoardId}
        onCreateBoard={createFixtureBoard}
        onCommit={backToCollection}
        onDismiss={backToCollection}
        onRemove={state === 'KP-04b' ? backToCollection : undefined}
      />

      {/* KP-06 · the board's own Edit, which is what KP-03's control opens. */}
      <BoardEditSheet
        visible={state === 'KP-06'}
        board={LISBON}
        onSave={({ name, startsOn, endsOn }) => {
          setBoards((prev) =>
            prev.map((b) => (b.id === LISBON.id ? { ...b, name, startsOn, endsOn } : b)),
          );
          setState('KP-03');
        }}
        onDelete={() => {
          // Deleting a board keeps the plates — they return to All. The fixture
          // performs the rule rather than describing it.
          setBoards((prev) => prev.filter((b) => b.id !== LISBON.id));
          setPlates((prev) =>
            prev.map((p) => (p.boardId === LISBON.id ? { ...p, boardId: null } : p)),
          );
          setState('KP-01');
        }}
        onDismiss={() => setState('KP-03')}
      />

      {/* The picker. Scaffolding, not a designed surface. */}
      <View
        className="absolute inset-x-0 bottom-0 border-t border-rule bg-canvas"
        style={{ paddingBottom: Math.max(insets.bottom, 10) }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 px-gutter py-2">
          {STATES.map((s) => (
            <Chip key={s.id} label={s.id} selected={s.id === state} onPress={() => setState(s.id)} />
          ))}
        </ScrollView>
        <Text variant="caption" className="px-gutter pb-1">
          {selected.id} · {selected.name}
        </Text>
      </View>
    </View>
  );
}

/**
 * The ground KP-04 is raised over — Today's plate, dimmed behind the sheet.
 *
 * Hand-drawn here and nowhere else: it is the *other* unit's screen, and the
 * fixture only needs enough of it to judge the sheet's height, its scrim and
 * where the grabber sits against the page behind it.
 */
function PlateGround() {
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="px-gutter pt-2">
        <Text variant="eyebrow" className="mb-1.5">
          Wednesday
        </Text>
        <Text variant="display" trim>
          The plate
        </Text>
      </View>
      <View className="mx-gutter mt-5 flex-row justify-center gap-2.5 rounded-lg border border-rule bg-surface p-4">
        {[BLOUSE, SKIRT, LOAFERS].map((source) => (
          <View key={source} className="h-[92px] w-[92px] overflow-hidden rounded bg-tray">
            <Image source={{ uri: source }} contentFit="contain" style={{ flex: 1 }} />
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}
