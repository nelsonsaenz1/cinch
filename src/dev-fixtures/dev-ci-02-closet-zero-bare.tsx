import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { ZeroClosetFrame } from '@/dev-fixtures/dev-ci-01-closet-zero';

/**
 * CI-02 — the same zero state on an account that has set nothing.
 *
 * The state a brand-new sign-in actually lands in, and the one worth shooting
 * at 375×667: no display name, no photograph, no claimed handle, no bio. Every
 * fallback in the chain fires at once —
 *
 *   · the name becomes `Your closet`;
 *   · the avatar draws the existing monogram fallback rather than a stock face;
 *   · the handle line is absent entirely, not an empty row holding space;
 *   · the bio becomes the cue that names what is missing and why.
 *
 * Shot beside `/dev-ci-01-closet-zero`, this is what proves the block does not
 * depend on the profile being filled in — which is the only version of it a
 * first-run reader will ever see.
 */
export default function DevCi02ClosetZeroBare() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return <ZeroClosetFrame name={null} handleLine="" bio={null} avatarUrl={null} />;
}
