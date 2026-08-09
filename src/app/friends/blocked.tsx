import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BlockedList } from '@/components/social/BlockedList';
import { ScreenHeader } from '@/components/ui/screen-header';

/**
 * BL-01…BL-03 — Blocked people, its own room off Profile.
 *
 * The screen is a frame; `BlockedList` owns every state (loading, failed,
 * nobody blocked, rows) because which sentence belongs on screen changes with
 * which state that is — BL-01's claim about what blocking did has no business
 * on BL-03's empty room, and a static header printing it unconditionally is
 * how that happened before. `contentContainerClassName="flex-grow"` is what
 * lets the empty state centre itself in the space a populated list would
 * otherwise fill top-down.
 *
 * `ScreenHeader`'s back chevron stands in for the atlas's "Done": this route
 * is reached by `router.push` from Profile, not a modal presentation, and
 * "headers are the screens' own" is the house rule for every pushed route.
 */
export default function BlockedScreen() {
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader title="Blocked people" />

      <ScrollView className="flex-1" contentContainerClassName="flex-grow px-gutter pb-10 pt-4">
        <BlockedList />
      </ScrollView>
    </SafeAreaView>
  );
}
