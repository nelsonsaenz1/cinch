import { Image } from 'expo-image';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SlotCard } from '@/components/onboarding/slot-card';
import { TenCameraChrome } from '@/components/onboarding/ten-camera-chrome';
import { TenRepair } from '@/components/onboarding/ten-repair';
import { TenGrid } from '@/components/onboarding/ten-grid';
import { TenStopSheetBody } from '@/components/onboarding/ten-stop-sheet';
import { Text } from '@/components/ui/text';
import {
  fixtureT01,
  fixtureT02,
  fixtureT07Repair,
  fixtureT05,
  fixtureT06,
  SAMPLE_ASSET,
} from '@/components/dev/ten-fixtures';
import { nextSlot } from '@/features/onboarding/ten-slots';
import { starterSuggestion } from '@/features/onboarding/starter-readiness';
import { useTheme } from '@/theme/tokens';

/**
 * DEV ONLY — every state of The Ten (T-01…T-06) at `cinch://dev-ten`, stacked
 * for one-screen review. Fixtures live in `src/components/dev/ten-fixtures.ts`;
 * this file only arranges the same production components the real onboarding
 * screen uses (`src/app/the-ten.tsx`) against them.
 */
export default function DevTenScreen() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* A plain ScrollView would fight the T-03/T-06/T-07 sub-screens'
          own SafeAreaViews; each state below manages its own scroll. */}
      <View style={{ flex: 1 }}>
        <StateNav />
      </View>
    </SafeAreaView>
  );
}

/** Every state gets its own full-height page; a simple index avoids one
 * 6000pt ScrollView (T-03/T-06/T-07 are meant to fill the screen anyway). */
function StateNav() {
  const [index, setIndex] = useState(0);
  const pages = [
    { id: 'T-01', label: 'Empty — the ten waiting', render: () => <PageT01 /> },
    { id: 'T-02', label: 'Partial — next slot foregrounded', render: () => <PageT02 /> },
    { id: 'T-03', label: 'A slot being filled', render: () => <PageT03 /> },
    { id: 'T-05', label: 'Nine filled — the tenth is the finish line', render: () => <PageT05 /> },
    { id: 'T-06', label: 'An eleventh, from inside the flow', render: () => <PageT06 /> },
    { id: 'T-07', label: 'Ten filed — still not styleable', render: () => <PageT07 /> },
  ];

  return (
    <View style={{ flex: 1 }}>
      <View className="flex-row flex-wrap gap-2 px-gutter pb-2 pt-1">
        {pages.map((p, i) => (
          <Text
            key={p.id}
            onPress={() => setIndex(i)}
            variant="colophon"
            style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
            className={
              i === index
                ? 'border border-accent bg-accent-light text-accent'
                : 'border border-rule'
            }>
            {p.id}
          </Text>
        ))}
      </View>
      <Text variant="label" className="px-gutter pb-2">
        {pages[index]!.label}
      </Text>
      <View style={{ flex: 1 }}>{pages[index]!.render()}</View>
    </View>
  );
}

function PageT01() {
  const { slots, readiness } = fixtureT01();
  const slot = nextSlot(slots)!;
  const suggestion = starterSuggestion(readiness);
  return (
    <ScrollView contentContainerClassName="px-gutter pt-2 pb-10">
      <View className="flex-row items-baseline justify-between">
        <Text variant="display" trim>
          The Ten
        </Text>
        <Text variant="label" style={{ fontVariant: ['tabular-nums'] }}>
          0 of 10
        </Text>
      </View>
      <Text variant="body" className="mt-2 text-muted">
        Add ten pieces from your closet. Photograph them or choose them from your camera roll
        &mdash; in any order.
      </Text>
      <View className="mt-3">
        <TenGrid slots={slots} foregroundedId={slot.id} />
      </View>
      <View className="mt-4">
        <SlotCard readiness={readiness} suggestion={suggestion} slotId={slot.id} onPhotograph={() => {}} onLibrary={() => {}} />
      </View>
    </ScrollView>
  );
}

function PageT02() {
  const { slots, names, images, readiness } = fixtureT02();
  const slot = nextSlot(slots)!;
  const suggestion = starterSuggestion(readiness);
  return (
    <ScrollView contentContainerClassName="px-gutter pt-2 pb-10">
      <View className="flex-row items-baseline justify-between">
        <Text variant="display" trim>
          The Ten
        </Text>
        <Text variant="label" style={{ fontVariant: ['tabular-nums'] }}>
          {`${slots.filter((s) => s.status === 'filled').length} of 10`}
        </Text>
      </View>
      <Text variant="body" className="mt-2 text-muted">
        Six to go. Nothing here is final — you can swap any piece later.
      </Text>
      <View className="mt-3">
        <TenGrid slots={slots} foregroundedId={slot.id} garmentNames={names} imageUris={images} />
      </View>
      <View className="mt-4">
        <SlotCard readiness={readiness} suggestion={suggestion} slotId={slot.id} onPhotograph={() => {}} onLibrary={() => {}} />
      </View>
    </ScrollView>
  );
}

function PageT03() {
  const { slots } = fixtureT02();
  // The row being shot is written the instant its upload starts — see
  // ten-camera.tsx — so the fixture marks slot 3 filled already, matching the
  // atlas's "5 of 10 filled" beneath a preview that is still processing.
  const shooting = { ...slots[2]!, status: 'filled' as const, garmentId: 'sample-sweater' };
  const withShot = slots.map((s) => (s.id === 3 ? shooting : s));

  return (
    <TenCameraChrome
      slot={slots[2]!}
      slots={withShot}
      phase="Cleaning up…"
      onCancel={() => {}}
      stage={
        <Image
          source={{ uri: SAMPLE_ASSET.sweater }}
          contentFit="cover"
          style={{ width: '100%', height: '100%' }}
        />
      }
    />
  );
}

function PageT07() {
  const { slots, names, images, readiness } = fixtureT07Repair();
  return (
    <ScrollView contentContainerClassName="px-gutter pt-2 pb-10">
      <View className="flex-row items-baseline justify-between">
        <Text variant="display" trim>
          The Ten
        </Text>
        <Text variant="label" style={{ fontVariant: ['tabular-nums'] }}>
          10 of 10
        </Text>
      </View>
      <View className="mt-3">
        <TenGrid slots={slots} foregroundedId={null} garmentNames={names} imageUris={images} />
      </View>
      <TenRepair readiness={readiness} onCheckPiece={() => {}} />
    </ScrollView>
  );
}

function PageT05() {
  const { slots, names, images, readiness } = fixtureT05();
  const slot = nextSlot(slots)!;
  const suggestion = starterSuggestion(readiness);
  return (
    <ScrollView contentContainerClassName="px-gutter pt-2 pb-10">
      <View className="flex-row items-baseline justify-between">
        <Text variant="display" trim>
          The Ten
        </Text>
        <Text variant="label">9 of 10</Text>
      </View>
      <Text variant="body" className="mt-2 text-muted">
        One to go. Nothing here is final — you can swap any piece later.
      </Text>
      <View className="mt-3">
        <TenGrid slots={slots} foregroundedId={slot.id} garmentNames={names} imageUris={images} />
      </View>
      <View className="mt-4">
        <SlotCard readiness={readiness} suggestion={suggestion} slotId={slot.id} onPhotograph={() => {}} onLibrary={() => {}} />
      </View>
    </ScrollView>
  );
}

function PageT06() {
  const { slots, names, images, readiness } = fixtureT06();
  const count = readiness.outfits;
  const theme = useTheme();
  return (
    <View className="flex-1">
      <View className="flex-1 px-gutter pt-2" style={{ opacity: 0.4 }} pointerEvents="none">
        <View className="flex-row items-baseline justify-between">
          <Text variant="display" trim>
            The Ten
          </Text>
          <Text variant="label" style={{ color: theme.ink }}>
            10 of 10
          </Text>
        </View>
        <View className="mt-3">
          <TenGrid slots={slots} foregroundedId={null} garmentNames={names} imageUris={images} />
        </View>
      </View>
      <View style={{ marginTop: 'auto' }}>
        <TenStopSheetBody count={count} onSeeOutfits={() => {}} onBackToGrid={() => {}} />
      </View>
    </View>
  );
}
