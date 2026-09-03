import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Spinner } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { firstNameOf } from '@/features/invite/arrivals';
import { useTheme } from '@/theme/tokens';

/**
 * After install — the pending friendship (atlas 39, IV-06).
 *
 * THIS SCREEN REPORTS, IT DOES NOT ASK. `apply_invite()` wrote both `follows`
 * rows before this rendered, so the friendship already exists; the tap on the
 * link was the consent, and a second "Accept?" here would be asking somebody to
 * agree twice to one thing. What it does instead is answer the first worry a
 * new arrival actually has — what can they see of me — with the true answer.
 *
 * Render-only. The RPC, the params and the routing live in
 * `src/app/invite-arrival.tsx`, and `dev-invite-link` mounts this over
 * fixtures.
 */

export type ArrivalPageState =
  /** The RPC is in flight. */
  | 'applying'
  /** Friendship made; `inviterName` is real. */
  | 'ready'
  /** The RPC returned no rows — unknown handle, your own, or a block. */
  | 'unavailable'
  /** The call itself failed. Distinct from `unavailable`: this one retries. */
  | 'error';

export type ArrivalPageProps = {
  state: ArrivalPageState;
  /** The inviter's display name. Ignored unless `state` is `ready`. */
  inviterName: string;
  /**
   * Whether this account already has pieces in its closet.
   *
   * AUDIT 100 #56. Read only by the `unavailable` branch, to decide which
   * recovery reads as true: "Add your first piece" is the right invitation
   * to a genuinely new account (this screen sits before capture in the
   * sign-up funnel — see `handoff.tsx`), and the wrong one to somebody who
   * tapped a stale or blocked invite mid-session with a closet already full
   * of pieces. `apply_invite` requires a session either way, so both are
   * "signed-in users" in the founder's sense — the closet is what tells them
   * apart.
   */
  hasClosetItems: boolean;
  onAddFirstPiece: () => void;
  onSeeCloset: () => void;
  onRetry: () => void;
  /** The way past this screen when there is nobody at the other end. */
  onContinue: () => void;
  /**
   * AUDIT 100 #56 — the `unavailable` branch's recovery for an established
   * closet: back to Friends, restoring normal tab navigation instead of the
   * dead end this screen was.
   */
  onGoToFriends: () => void;
};

export function ArrivalPage(props: ArrivalPageProps) {
  const theme = useTheme();

  if (props.state === 'applying') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        {/* No headline yet. Naming the inviter before the RPC has answered
            would be printing a friendship that might not exist. */}
        <Spinner />
      </SafeAreaView>
    );
  }

  if (props.state === 'error') {
    return (
      <SafeAreaView className="flex-1 bg-canvas">
        <ErrorState
          title="Couldn’t finish the invite"
          body="The link is fine and so is your account — this device just couldn’t reach Cinch. Trying again picks up exactly where it left off."
          onRetry={props.onRetry}
        />
        <View className="px-gutter pb-6">
          <Button title="Skip for now" variant="ghost" onPress={props.onContinue} />
        </View>
      </SafeAreaView>
    );
  }

  if (props.state === 'unavailable') {
    // AUDIT 100 #56. This branch used to offer one recovery regardless of who
    // landed on it: "Add your first piece", which reads as onboarding — the
    // right invitation for the genuinely new account this screen sits in
    // front of during sign-up, and a non sequitur for somebody with an
    // established closet who tapped a stale or blocked invite mid-session.
    // `hasClosetItems` tells the two apart; the recovery now matches the
    // account it is actually offered to, and either way it is a real
    // destination rather than the dead end this screen used to be.
    const established = props.hasClosetItems;

    return (
      <SafeAreaView className="flex-1 bg-canvas">
        <View className="flex-1 justify-center px-gutter">
          <Text variant="display" trim accessibilityRole="header">
            This invite has been closed
          </Text>
          {/* The same sentence IV-05 gives on the web, for the same event —
              the person is gone, changed their handle, or one of you has
              blocked the other. Which of the three it was is not this
              screen's to guess. */}
          <Text variant="body" style={{ color: theme.muted, marginTop: 20 }}>
            Whoever sent it has since deleted their account or changed their handle. You are in
            Cinch either way, and you can add friends by handle from the Friends tab.
          </Text>

          <View className="mt-7 gap-2.5">
            {established ? (
              <Button title="Go to Friends" variant="ink" onPress={props.onGoToFriends} />
            ) : (
              <Button title="Add your first piece" variant="ink" onPress={props.onAddFirstPiece} />
            )}
            <Button title="Skip for now" variant="secondary" onPress={props.onContinue} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // The atlas addresses the inviter by first name in all four places. The
  // avatar still gets the whole name, because a monogram wants both initials.
  const name = firstNameOf(props.inviterName);

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="flex-1 justify-center px-gutter">
        {/* The margin is on this wrapper, not on the headline: `mt-*` on a
            trim'd serif Text is eaten by the cap-trim. */}
        <View className="mb-6">
          <Avatar name={props.inviterName} size={76} tone="sand" />
        </View>

        <Text variant="display" trim accessibilityRole="header">
          {`${name} is waiting for you`}
        </Text>

        {/* No gendered pronoun. The app knows a display name and nothing else
            about who sent the invite, and guessing on the first screen a new
            person ever sees is the worst possible place to be wrong. */}
        <Text variant="body" style={{ color: theme.muted, marginTop: 20 }}>
          {`You came in from ${name}’s invite, so you are already added to each other. Their closet is on your Friends tab.`}
        </Text>

        <Card padding="lg" className="mt-6">
          {/* True by construction: a friend sees the pieces in your active
              closet, and there are none yet. Nothing is hidden here and
              nothing needs to be turned off. */}
          <Text variant="note">
            {`Nothing of yours is visible yet — a closet with no pieces in it shows as empty, to ${name} and to everyone else.`}
          </Text>
        </Card>

        <View className="mt-7 gap-2.5">
          <Button title="Add your first piece" variant="ink" onPress={props.onAddFirstPiece} />
          <Button title={`See ${name}’s closet`} variant="secondary" onPress={props.onSeeCloset} />
        </View>
      </View>
    </SafeAreaView>
  );
}
