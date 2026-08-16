import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyCloset } from '@/components/closet/empty-closet';
import { ExampleCloset } from '@/components/closet/example-closet';
import { ZeroIdentityHeader } from '@/components/closet/zero-identity-header';
import { Text } from '@/components/ui/text';
import { PLANS } from '@/features/billing/plans';

/**
 * CI-01 — the Closet at exactly zero pieces, as the signed-in person's profile.
 *
 * The real screen only reaches this branch on an account that owns nothing,
 * behind auth and five queries, which is how a primary action once shipped
 * rendering nothing at all: typecheck, lint and the whole suite passed, because
 * none of them run a layout pass.
 *
 * This frame renders the REAL components — `ZeroIdentityHeader`, the same
 * `ExampleCloset` and the same `EmptyCloset` — with fixed props, so a
 * screenshot here is evidence about the shipped tree rather than about whoever
 * happened to be signed in. Only the eyebrow, the count line and the two 26pt
 * gaps are reproduced by hand, exactly as `(tabs)/closet.tsx` draws them.
 *
 * DETERMINISM: no clock, no network, no closet read, no auth. Four bundled
 * photographs and one monogram.
 *
 * `/dev-ci-02-closet-zero-bare` is the same frame with every optional profile
 * field missing — the fallback chain CI-02 specifies.
 */

/** CI-01's populated account: a real name, a claimed handle, a written bio. */
const FIXTURE = {
  name: 'Nadia Okonkwo',
  handleLine: '@nadia · Denver',
  bio: 'Tailoring, wool, and one very old denim jacket.',
} as const;

export function ZeroClosetFrame({
  name,
  handleLine,
  bio,
  avatarUrl = null,
}: {
  name: string | null;
  handleLine: string;
  bio: string | null;
  avatarUrl?: string | null;
}) {
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
        <View className="px-gutter pt-2" style={{ minHeight: 34, justifyContent: 'center' }}>
          <Text variant="eyebrow" accessibilityRole="header">
            Your closet
          </Text>
        </View>
        <View className="mt-1 px-gutter">
          <Text variant="note">{`0 of ${PLANS.free.items} pieces`}</Text>
        </View>

        <View className="mt-5">
          <ZeroIdentityHeader
            name={name}
            handleLine={handleLine}
            bio={bio}
            avatarUrl={avatarUrl}
            // Four genuine zeroes: this fixture owns nothing and follows nobody.
            stats={{ pieces: 0, outfits: 0, unworn: 0, followers: 0 }}
            onEditProfile={() => {}}
          />
        </View>

        <View style={{ marginTop: 26 }}>
          <ExampleCloset variant="full" />
        </View>

        <View style={{ marginTop: 26 }}>
          <EmptyCloset flow="stacked" onAddClothes={() => {}} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function DevCi01ClosetZero() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <ZeroClosetFrame name={FIXTURE.name} handleLine={FIXTURE.handleLine} bio={FIXTURE.bio} />
  );
}
