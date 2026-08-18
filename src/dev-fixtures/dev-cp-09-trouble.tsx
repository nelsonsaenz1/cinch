/**
 * CP-09 fixture — redesign 22, frames 17, 18 and 19: the three ways a batch
 * stops, drawn on one page so none of them can be mistaken for another.
 *
 * The artifact's failure-separation card is the rule this fixture exists to
 * check: "four outcomes stay distinct and none masquerades as another — still
 * processing, a settled cut-out failure with its own retry, offline with
 * photographs held on device, and a retryable request error."
 *
 * Offline counts PHOTOGRAPHS and says they are held; the error counts nothing
 * and says nothing was filed twice; the resume says what survived a kill and
 * makes discarding the quiet third option rather than a peer.
 *
 * Inert: every callback is a no-op.
 */

import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import {
  AmberPlate,
  FilingRowView,
  PageActions,
  PageMasthead,
  SettledGrid,
} from '@/components/ingest/capture-parts';
import { CP_OFFLINE, CP_RESUMABLE } from '@/features/ingest/capture-fixtures';
import {
  ERROR_BACK,
  ERROR_EYEBROW,
  OFFLINE_BODY,
  OFFLINE_EYEBROW,
  PAGE,
  RESUME_CTA,
  RESUME_NEW,
  RESUME_TITLE,
  filingRows,
  resumeBody,
  resumeDiscard,
  waitingTitle,
} from '@/features/ingest/capture-spec';

export default function DevCp09TroubleScreen() {
  const offline = filingRows(CP_OFFLINE, { held: true });

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} className="flex-1 bg-canvas">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-gutter pt-4">
          <Text variant="eyebrow">Frame 17 · offline</Text>
        </View>
        <View className="pt-2">
          <PageMasthead title={waitingTitle(offline.length)} />
          <View className="pb-3.5">
            <AmberPlate
              eyebrow={OFFLINE_EYEBROW}
              body={OFFLINE_BODY}
              primary="Try again"
              onPrimary={() => {}}
            />
          </View>
          <View className="px-gutter" style={{ gap: PAGE.rowGap }}>
            {offline.map((row) => (
              <FilingRowView key={row.id} row={row} imageUri={null} />
            ))}
          </View>
        </View>

        <View className="px-gutter pt-8">
          <Text variant="eyebrow">Frame 19 · retryable error</Text>
        </View>
        <View className="pt-2">
          <AmberPlate
            eyebrow={ERROR_EYEBROW}
            body="That upload didn’t finish."
            primary="Try again"
            onPrimary={() => {}}
            secondary={ERROR_BACK}
            onSecondary={() => {}}
          />
        </View>

        <View className="px-gutter pt-8">
          <Text variant="eyebrow">Frame 18 · resumable</Text>
        </View>
        <View className="pt-2">
          <PageMasthead title={RESUME_TITLE} />
          <View className="px-gutter pb-4">
            <Text variant="note" style={{ fontSize: 15 }}>
              {resumeBody(CP_RESUMABLE.length)}
            </Text>
          </View>
          <SettledGrid uris={CP_RESUMABLE.map((j) => j.localUri)} />
          <View className="pt-4">
            <PageActions
              primary={RESUME_CTA}
              onPrimary={() => {}}
              secondary={RESUME_NEW}
              onSecondary={() => {}}
              quiet={resumeDiscard(CP_RESUMABLE.length)}
              onQuiet={() => {}}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
