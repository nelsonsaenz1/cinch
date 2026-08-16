/**
 * CPV2-V01 — the bulk walkthrough's review card, with the quiet ask on it.
 *
 * The thing to look at here is what is NOT loud. "Looks right — next" (drawn as
 * Keep it) is what this screen is for; the catalogue lookup is a ghost control
 * with its own explanation line, because §7 allows one request per garment the
 * user asks about and an action that competes with Keep would get asked about
 * seven times.
 *
 * Inert: the pose's dispatch does nothing, so the card cannot advance the
 * procession or commit a draft.
 */

import { useReducer } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GarmentCard } from '@/components/intake/GarmentCard';
import { Text } from '@/components/ui/text';
import { DEV_DRAFTS } from '@/features/intake/dev-fixtures';
import { initProcession, processionReducer } from '@/features/intake/procession';

export default function DevCpv2V01Screen() {
  const [state, dispatch] = useReducer(processionReducer, initProcession(DEV_DRAFTS, 0));

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-canvas">
      <View className="px-gutter pb-1 pt-2">
        <Text variant="eyebrow">CPV2-V01 · Review card, quiet ask</Text>
      </View>
      <View className="flex-1">
        <GarmentCard
          procession={state}
          dispatch={dispatch}
          showUndo={false}
          onCorrect={() => {}}
          onFindPhoto={() => {}}
        />
      </View>
    </SafeAreaView>
  );
}
