import { Asset } from 'expo-asset';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LookPlate } from '@/components/look/look-plate';
import { CaptionStep } from '@/components/share-look/caption-step';
import {
  EmptyClosetPrompt,
  FailedDraftBanner,
  PostingCardSkeleton,
  TakeOffBoardConfirm,
} from '@/components/share-look/edge-states';
import { PickerFooterTray, PiecePicker } from '@/components/share-look/piece-picker';
import { StackComposer } from '@/components/share-look/stack-composer';
import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { captionFromPieces, titleFromPieces } from '@/features/share-look/compose';
import { resolveColorName } from '@/lib/color';
import type { Garment } from '@/lib/styling';
import { useTheme } from '@/theme/tokens';

/**
 * The Share a Look fixture — `cinch://dev-share-look`.
 *
 * Every S-01…S-05 state from the atlas, against the real components this
 * unit built (`PiecePicker`, `StackComposer`, `CaptionStep`, the S-05 edge
 * pieces) and the real bundled garment photographs the atlas itself uses —
 * `assets/garments/*.jpg` — so what renders here is the same picture the
 * atlas prints, not a placeholder standing in for it.
 *
 * S-01 and S-02 are genuinely interactive (tap to pick, drag to reorder) so
 * the numbering and the drag gesture can be verified on-device; S-03 accepts
 * typing into both fields. S-04 and the destructive S-05 states are
 * illustrated rather than wired, because they render on (or mutate) the
 * board and the retire flow — `event/[id]/outfits.tsx` and
 * `OutfitPostCard.tsx` — which belong to a different unit's files.
 */

/**
 * One `Asset` per fixture, undownloaded until the screen mounts.
 *
 * `Asset.fromModule(mod).uri` alone is enough in a store build (a bundled
 * asset is already a local file) but not in this dev-client-over-Metro
 * session: Metro serves every asset from the SAME path
 * (`/assets/`) and carries the distinguishing filename+hash only in the
 * query string. `GarmentCell` always renders through `stableImageSource`,
 * which builds its cache key from `uri.split('?')[0]` — exactly right for a
 * signed Supabase URL (whose path already carries `{item}/{file}`), but it
 * collapses all six fixture photos onto one cache key and expo-image then
 * serves whichever loaded first for every cell. `downloadAsync()` resolves a
 * real `file://…` `localUri` with no query string at all, which is what
 * `resolveFixtureImage` waits for below.
 */
const PHOTOS = {
  sweater: Asset.fromModule(require('@/assets/garments/cream-mohair-sweater.jpg')),
  skirt: Asset.fromModule(require('@/assets/garments/beige-corduroy-skirt.jpg')),
  blouse: Asset.fromModule(require('@/assets/garments/white-linen-blouse.jpg')),
  loafers: Asset.fromModule(require('@/assets/garments/brown-leather-loafers.jpg')),
  trousers: Asset.fromModule(require('@/assets/garments/charcoal-tailored-trousers.jpg')),
  tote: Asset.fromModule(require('@/assets/garments/cognac-leather-tote.jpg')),
  coat: Asset.fromModule(require('@/assets/garments/cognac-shearling-coat.jpg')),
} as const;

type PhotoId = keyof typeof PHOTOS;

function fixtureGarment(
  id: PhotoId,
  slot: Garment['slot'],
  category: Garment['category'],
  subcategory: string,
  colorName: string,
  brand: string,
  visualWeight: number,
): Garment {
  return {
    id,
    slot,
    category,
    subcategory,
    colors: [{ name: colorName, oklch: resolveColorName(colorName)!, family: colorName, neutrality: 0, metallic: false, weight: 1 }],
    visualWeight,
    fit: 'regular',
    pattern: null,
    patternScale: 'none',
    material: null,
    brand,
    formality: 3,
    warmth: 3,
    waterResistant: false,
    seasons: [],
    occasions: [],
    wearCount: 3,
    lastWornAt: null,
    purchasePrice: null,
    thumbPath: `fixture/${id}`,
    cutoutPath: `fixture/${id}`,
    platePath: `fixture/${id}`,
  } as unknown as Garment;
}

const SWEATER = fixtureGarment('sweater', 'base_top', 'top', 'mohair sweater', 'cream', 'Everlane', 1.0);
const SKIRT = fixtureGarment('skirt', 'bottom', 'bottom', 'corduroy skirt', 'oat', 'Sézane', 1.1);
const BLOUSE = fixtureGarment('blouse', 'base_top', 'top', 'linen blouse', 'white', 'COS', 0.95);
const LOAFERS = fixtureGarment('loafers', 'footwear', 'footwear', 'leather loafers', 'brown', 'Loeffler Randall', 0.85);
const TROUSERS = fixtureGarment('trousers', 'bottom', 'bottom', 'tailored trousers', 'charcoal', 'Theory', 1.1);
const TOTE = fixtureGarment('tote', 'bag', 'bag', 'leather tote', 'cognac', 'Madewell', 0.4);
const COAT = fixtureGarment('coat', 'outerwear', 'outerwear', 'shearling coat', 'cognac', 'Nour Hammour', 1.3);

const SHELF: Garment[] = [SWEATER, SKIRT, BLOUSE, LOAFERS, TROUSERS, TOTE];

const FRAMES = ['S-01', 'S-02', 'S-03', 'S-04', 'S-05'] as const;
type Frame = (typeof FRAMES)[number];

export default function DevShareLook() {
  const { frame: requested } = useLocalSearchParams<{ frame?: string }>();
  const initial = (FRAMES as readonly string[]).includes(requested ?? '') ? (requested as Frame) : 'S-01';
  const [frame, setFrame] = useState<Frame>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(Object.values(PHOTOS).map((a) => a.downloadAsync())).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const resolveFixtureImage = useMemo(() => {
    const byPath = new Map(SHELF.concat(COAT).map((g) => [g.platePath, g.id as PhotoId]));
    return (...paths: (string | null | undefined)[]): string | undefined => {
      for (const p of paths) {
        if (!p) continue;
        const id = byPath.get(p);
        if (!id) continue;
        const asset = PHOTOS[id];
        const local = asset.localUri ?? asset.uri;
        return local ?? undefined;
      }
      return undefined;
    };
  }, []);

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  if (!ready) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Loading fixtures…</Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-canvas">
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView contentContainerStyle={{ paddingBottom: 160 }}>
          <View className="px-gutter pt-2">
            <Text variant="eyebrow">Share a look · build reference</Text>
          </View>
          {frame === 'S-01' ? <FrameS01 resolveFixtureImage={resolveFixtureImage} /> : null}
          {frame === 'S-02' ? <FrameS02 resolveFixtureImage={resolveFixtureImage} /> : null}
          {frame === 'S-03' ? <FrameS03 resolveFixtureImage={resolveFixtureImage} /> : null}
          {frame === 'S-04' ? <FrameS04 resolveFixtureImage={resolveFixtureImage} /> : null}
          {frame === 'S-05' ? <FrameS05 /> : null}
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

type ResolveFixtureImage = (...paths: (string | null | undefined)[]) => string | undefined;

function FrameS01({ resolveFixtureImage }: { resolveFixtureImage: ResolveFixtureImage }) {
  const [stack, setStack] = useState<Garment[]>([SWEATER, SKIRT, LOAFERS]);
  return (
    <View className="px-gutter pt-5">
      <Text variant="title" trim>
        What are you wearing?
      </Text>
      <Text variant="body" className="mt-2.5 text-muted">
        Pick from your closet. Three to six pieces reads best on the board.
      </Text>
      <View className="mt-4">
        <PiecePicker candidates={SHELF} stack={stack} resolveImage={resolveFixtureImage} onChangeStack={setStack} />
      </View>
      <View className="mt-4">
        <PickerFooterTray
          stack={stack}
          resolveImage={resolveFixtureImage}
          canCompose={stack.length >= 2}
          onCompose={() => {}}
        />
      </View>
    </View>
  );
}

function FrameS02({ resolveFixtureImage }: { resolveFixtureImage: ResolveFixtureImage }) {
  const [stack, setStack] = useState<Garment[]>([SWEATER, SKIRT, LOAFERS, TOTE]);
  const [plateWidth, setPlateWidth] = useState(0);
  return (
    <View className="px-gutter pt-5">
      <Text variant="title" trim>
        The stack
      </Text>
      <Text variant="body" className="mt-2.5 text-muted">
        Drag to reorder. Top piece first — that’s what shows on the board.
      </Text>
      <View className="mt-4" onLayout={(e) => setPlateWidth(e.nativeEvent.layout.width)}>
        {plateWidth > 0 ? (
          <StackComposer
            stack={stack}
            resolveImage={resolveFixtureImage}
            plateWidth={plateWidth}
            onReorder={setStack}
            onAddAnother={() => {}}
          />
        ) : null}
      </View>
    </View>
  );
}

function FrameS03({ resolveFixtureImage }: { resolveFixtureImage: ResolveFixtureImage }) {
  const stack = [SWEATER, SKIRT, LOAFERS, TOTE];
  const [title, setTitle] = useState(() => titleFromPieces(stack));
  const [caption, setCaption] = useState(() => captionFromPieces(stack));
  const [saveToLately, setSaveToLately] = useState(true);
  return (
    <View className="px-gutter pt-5">
      <Text variant="title" trim>
        Say what it is
      </Text>
      <Text variant="body" className="mt-2.5 text-muted">
        A name and a line. Both optional — the pieces already say most of it.
      </Text>
      <View className="mt-4">
        <CaptionStep
          stack={stack}
          resolveImage={resolveFixtureImage}
          title={title}
          onChangeTitle={setTitle}
          caption={caption}
          onChangeCaption={setCaption}
          eventTitle="Dana’s birthday dinner"
          eventDateLine="Sat, Aug 8"
          peopleCount={5}
          saveToLately={saveToLately}
          onChangeSaveToLately={setSaveToLately}
        />
      </View>
    </View>
  );
}

/**
 * S-04, illustrated rather than wired: the reward is landing on the real
 * board with the rail scrolled to the new card, which is `outfits.tsx`'s
 * screen (a different unit's file) to render. This is the card shape it
 * lands with — blush hairline, "Just posted", no Vote pill, a quiet zero.
 */
function FrameS04({ resolveFixtureImage }: { resolveFixtureImage: ResolveFixtureImage }) {
  const theme = useTheme();
  const stack = [SWEATER, SKIRT, LOAFERS, TOTE];
  const width = 300;

  return (
    <View className="px-gutter pt-5">
      <Text variant="title" trim>
        Every option
      </Text>
      <Text variant="body" className="mt-2.5 text-muted">
        Yours is on the board. Four others to look at — illustrated (the live board is `outfits.tsx`).
      </Text>
      <View className="mt-5 flex-row gap-3">
        <View
          className="overflow-hidden rounded-plate bg-surface"
          style={{ width, borderWidth: 1, borderColor: theme.blushRule }}>
          <LookPlate pieces={stack} width={width} resolveImage={resolveFixtureImage} />
          <View className="p-4">
            <View className="flex-row items-center gap-2">
              <View
                className="items-center justify-center rounded-full"
                style={{ width: 24, height: 24, backgroundColor: '#EAE5DB' }}>
                <Text variant="label" style={{ fontSize: 11, color: theme.accent }}>
                  ME
                </Text>
              </View>
              <Text variant="label" className="text-ink">
                You
              </Text>
              <Text variant="colophon" style={{ color: theme.accent }}>
                Just posted
              </Text>
            </View>
            <Text variant="plate" className="mt-2.5">
              {titleFromPieces(stack)}
            </Text>
            <Text variant="caption" className="mt-1">
              {captionFromPieces(stack)}
            </Text>
            <View className="mt-3.5 flex-row items-center gap-2.5 border-t border-rule pt-3.5">
              <View
                className="flex-1 items-center justify-center rounded-md border border-rule"
                style={{ minHeight: 44 }}>
                <Text variant="label" className="text-muted">
                  Your look
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
      <Text variant="caption" className="mt-3">
        Your own card carries no Vote pill. You cannot pick your own look. The count starts at
        zero and prints nothing — the board’s zero-is-quiet rule.
      </Text>
    </View>
  );
}

function FrameS05() {
  const [removing, setRemoving] = useState(false);
  return (
    <View className="px-gutter pt-5" style={{ gap: 28 }}>
      <View>
        <EmptyClosetPrompt onAddPiece={() => {}} />
      </View>

      <Rule />

      <View>
        <Text variant="colophon">Posting</Text>
        <View className="mt-3">
          <PostingCardSkeleton />
        </View>
        <Text variant="caption" className="mt-3">
          The card is drawn on the board immediately, greyed at 60%, and settles when the write
          returns. The rail can be scrolled while it settles.
        </Text>
      </View>

      <Rule />

      <View>
        <FailedDraftBanner onRetry={() => {}} onKeepDraft={() => {}} />
      </View>

      <Rule />

      <View>
        <Text variant="colophon">Already posted — posting a second option</Text>
        <Text variant="body" className="mt-3 text-muted">
          The same three steps, entered from “Share another.” Both looks sit on the board under
          your name; picks land on the look, not on you. Swapping a piece edits in place and
          keeps the picks, because the look is the same look. Replacing every piece is a new
          post, and says so.
        </Text>
      </View>

      <Rule />

      <View>
        <TakeOffBoardConfirm
          removing={removing}
          onLeaveUp={() => {}}
          onTakeOff={() => setRemoving((r) => !r)}
        />
      </View>
    </View>
  );
}

function Rule() {
  const theme = useTheme();
  return <View style={{ height: 1, backgroundColor: theme.rule }} />;
}
