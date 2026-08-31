import { View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { numberWord } from '@/features/onboarding/reveal-copy';

/**
 * T-10b — pieces exist, tagging was never allowed to run.
 *
 * Until 2026-08-31 this state fell through to the activation floor, which
 * told the reader to "start with ten pieces" — a misdiagnosis aimed at
 * someone who has already photographed ten and more. Production showed two
 * such closets (11 and 18 pieces, every one at `pending_tag`, consent never
 * granted) floored for ten days straight. The Reveal's zero-path has always
 * known this fact and offered the consent door; this floor is that same
 * honesty for the tab people actually open.
 *
 * One action, and it is the real fix: the consent sheet, followed by the
 * sweep that tags the stuck pieces immediately. The caller owns both — this
 * component only states the fact and offers the door.
 */
export function PendingConsentFloor({
  pendingCount,
  onOpenConsent,
}: {
  pendingCount: number;
  onOpenConsent: () => void;
}) {
  const pieces = `${numberWord(pendingCount)} ${pendingCount === 1 ? 'piece' : 'pieces'}`;
  return (
    <View className="flex-1 justify-center px-gutter">
      <Text variant="eyebrow">Almost there</Text>
      <Text variant="title" trim className="mt-3">
        Your clothes are in — they’re waiting on one permission.
      </Text>
      <Text variant="body" className="mt-3 text-muted">
        {`Cinch has ${pieces} photographed and ready, but reading a photo means sending it for AI identification, and you haven’t said yes to that yet. Say yes and your closet finishes itself in about a minute.`}
      </Text>
      <View className="mt-6">
        <Button title="Turn on AI processing" onPress={onOpenConsent} />
      </View>
      <Text variant="note" className="mt-3 text-muted">
        Your photos, one at a time, only for naming each piece. You can turn it off any time in
        Privacy &amp; data.
      </Text>
    </View>
  );
}
