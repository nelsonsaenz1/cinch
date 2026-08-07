import { Linking, Pressable } from 'react-native';

import { Card } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import { reservationLabel } from '@/features/events/venue-search';
import { MIN_TAP_TARGET } from '@/theme/tokens';

/**
 * Where the table is — venue name, address, and the outbound reservation
 * link. Members-only by the caller's discipline: the detail screen renders
 * this card only for joined members (§7.1: venue and logistics never show
 * pre-join, even though RLS hands an invitee the row).
 *
 * The reservation button is plain text in Cinch's own type — "Open in
 * OpenTable" when the pasted hostname matches a known platform, the generic
 * "View reservation" otherwise, never a logo. The URL is opened exactly as
 * stored; the platform's universal link does the rest on the user's device.
 */
export function VenueCard({
  venueName,
  venueAddress,
  reservationUrl,
}: {
  venueName: string | null;
  venueAddress: string | null;
  reservationUrl: string | null;
}) {
  if (!venueName && !venueAddress && !reservationUrl) return null;

  return (
    <Card padding="lg" fill="none">
      <SectionHeader title="The table" />

      {venueName ? (
        <Text variant="heading" className="mt-2">
          {venueName}
        </Text>
      ) : null}

      {venueAddress ? (
        <Text variant="label" className="mt-1 text-muted dark:text-muted-dark">
          {venueAddress}
        </Text>
      ) : null}

      {reservationUrl ? (
        <Pressable
          onPress={() => {
            void Linking.openURL(reservationUrl).catch(() => {
              // A dead or malformed link is the platform's business, not a
              // crash — the button simply does nothing, like Safari would.
            });
          }}
          accessibilityRole="link"
          accessibilityLabel={reservationLabel(reservationUrl)}
          hitSlop={8}
          style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
          className="mt-1 self-start active:opacity-60">
          <Text variant="label" className="text-accent dark:text-accent-dark">
            {reservationLabel(reservationUrl)}
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}
