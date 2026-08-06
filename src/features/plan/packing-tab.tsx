import { View } from 'react-native';

import { Button, ListSkeleton, Rule, Text } from '@/components/ui';

import { PackingTrip } from './packing-trip';
import type { Trip } from './trip';
import { TripQuestionnaire } from './trip-questionnaire';
import { usePackingAccess } from './use-packing-access';

/**
 * Packing, end to end: the gate, the questions, the trip.
 *
 * WHAT THIS REPLACED. Packing used to open on a text field, and — for anyone
 * whose closet was below the styling threshold — on a full-screen empty state
 * whose only action pushed `/capture`. So the first thing a new user saw on the
 * Packing tab was the camera, which is the founder's complaint in one sentence:
 * the screen asked for work before it offered any thinking. The camera entry
 * point is gone from packing entirely (the Week mode keeps it, where "add
 * clothes" is genuinely the next step), and what opens instead is five
 * questions.
 */

/**
 * The locked state.
 *
 * Composed the way the guide's other "you can't have this yet" moments are —
 * caps kicker, one serif line, one honest paragraph, one action — and set in a
 * plate rather than centred, because a centred badge-and-illustration empty is
 * the AI-slop pattern `empty-state.tsx` exists to avoid.
 *
 * It says what packing IS before it asks for money. A lock with no description
 * of what is behind it converts nothing and reads as a toll gate; the founder's
 * whole objection to nagging is that it costs trust the app cannot re-earn.
 */
function PackingLocked({ onUnlock }: { onUnlock: () => void }) {
  return (
    <View className="px-gutter pt-2">
      <View className="rounded-plate border border-rule bg-surface p-5 dark:border-rule-dark dark:bg-surface-dark">
        <Text variant="eyebrow">Membership</Text>
        <View className="mt-3">
          <Text variant="title" trim>
            Packing is part of Cinch membership.
          </Text>
        </View>
        <Text variant="body" className="mt-4 text-muted dark:text-muted-dark">
          Tell Cinch where you are going, who with and what kind of trip it is,
          and it reads the place — how warm, how dressed-up, what people
          actually wear there — then packs it from the clothes already in your
          closet. That part comes with Standard and Pro.
        </Text>

        <View className="my-4">
          <Rule />
        </View>

        <Text variant="body" className="text-muted dark:text-muted-dark">
          Your closet, your week and your occasions stay free, exactly as they
          are.
        </Text>

        {/* The screen's one oxblood action. */}
        <Button title="See membership" onPress={onUnlock} haptic className="mt-6 self-stretch" />
      </View>
    </View>
  );
}

/**
 * @param trip The answered questionnaire, held by the Plan screen rather than
 *   here. This component unmounts the moment someone taps Week, and an answered
 *   trip that evaporates because the user glanced at their calendar is five
 *   taps thrown away for nothing.
 */
export function PackingTab({
  active,
  trip,
  onTrip,
}: {
  active: boolean;
  trip: Trip | null;
  onTrip: (trip: Trip | null) => void;
}) {
  const access = usePackingAccess(active);

  // The entitlement is unknown for one round trip on a cold start. Drawing the
  // lock during it would flash "you have not paid" at a paying subscriber —
  // the one wrong answer that costs a support ticket rather than a second.
  if (access.loading) return <ListSkeleton count={3} avatar={false} />;

  if (!access.allowed) return <PackingLocked onUnlock={access.unlock} />;

  if (!trip) return <TripQuestionnaire onComplete={onTrip} />;

  return <PackingTrip trip={trip} onStartAgain={() => onTrip(null)} />;
}
