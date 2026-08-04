import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { ConsentSheet } from '@/components/ingest/consent-sheet';
import { UploadQueueList } from '@/components/ingest/upload-queue-list';
import { useAiConsent, useGrantAiConsent } from '@/features/auth/use-consent';
import { useCapture } from '@/features/ingest/use-capture';
import { useQueueStore, selectActiveCount } from '@/features/ingest/queue-store';
import { drainQueue } from '@/features/ingest/upload-queue';

export default function CaptureScreen() {
  const router = useRouter();
  const { pickFromLibrary, takePhoto, selectionLimit } = useCapture();

  const jobs = useQueueStore((s) => s.jobs);
  const hydrate = useQueueStore((s) => s.hydrate);
  const active = selectActiveCount(jobs);

  const consent = useAiConsent();
  const grantConsent = useGrantAiConsent();
  const [consentVisible, setConsentVisible] = useState(false);
  // What to run once consent lands, so the user isn't made to tap twice.
  const [pendingAction, setPendingAction] = useState<null | 'library' | 'camera'>(null);

  // Rehydrate a batch interrupted by a kill or a crash, and resume it.
  useEffect(() => {
    hydrate();
    void drainQueue();
  }, [hydrate]);

  /**
   * Gate every capture entry point on consent. The Edge Function enforces this
   * server-side too — this is purely so the user is asked *before* photos are
   * uploaded, rather than seeing an opaque failure after.
   */
  const guarded = useCallback(
    (action: 'library' | 'camera') => {
      if (consent.data?.granted) {
        void (action === 'library' ? pickFromLibrary() : takePhoto());
        return;
      }
      setPendingAction(action);
      setConsentVisible(true);
    },
    [consent.data?.granted, pickFromLibrary, takePhoto],
  );

  const onAcceptConsent = async () => {
    await grantConsent.mutateAsync();
    setConsentVisible(false);
    const next = pendingAction;
    setPendingAction(null);
    if (next) void (next === 'library' ? pickFromLibrary() : takePhoto());
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark">
      <View className="flex-row items-center justify-between px-gutter pt-2">
        <Text variant="heading">Add clothes</Text>
        <Button title="Close" variant="ghost" onPress={() => router.back()} />
      </View>

      {jobs.length === 0 ? (
        <EmptyState
          symbol="camera"
          title="Photograph your closet"
          body={`Pick up to ${selectionLimit} photos at a time, or shoot pieces one by one. Cinch cuts out the background and tags everything for you.`}
        />
      ) : (
        <ScrollView contentContainerClassName="px-gutter pb-4 pt-4">
          <Text variant="caption" className="mb-3">
            {active > 0 ? `${active} in progress` : 'All done'}
          </Text>
          <UploadQueueList jobs={jobs} />
        </ScrollView>
      )}

      <View className="gap-3 px-gutter pb-4">
        <Button title="Choose from library" onPress={() => guarded('library')} haptic />
        <Button
          title="Take a photo"
          variant="secondary"
          onPress={() => guarded('camera')}
          haptic
        />
        {jobs.some((j) => j.stage === 'done') ? (
          <Button
            title="Review tags"
            variant="ghost"
            onPress={() => router.replace('/review')}
          />
        ) : null}
      </View>

      <ConsentSheet
        visible={consentVisible}
        busy={grantConsent.isPending}
        onAccept={() => void onAcceptConsent()}
        onDecline={() => {
          setConsentVisible(false);
          setPendingAction(null);
        }}
      />
    </SafeAreaView>
  );
}
