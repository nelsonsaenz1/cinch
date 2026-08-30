import { useRouter } from 'expo-router';
import { Alert, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { PrivacyPage } from '@/components/privacy/privacy-page';
import { useToast } from '@/components/ui/toast-host';
import { fullDate } from '@/features/privacy/format';
import {
  useConnectPinterest,
  useDisconnectPinterest,
  usePinterestConnection,
} from '@/features/recreate/pinterest';

/**
 * PD-05 — Pinterest inspiration: connect, status, disconnect, and the
 * data-use explanation, on one screen.
 *
 * The page IS the disclosure. Every sentence below states a checkable fact
 * about the implementation — read-only scopes, live fetching, no storage of
 * board or Pin content, tokens encrypted server-side, deletion on disconnect
 * — and if the implementation ever drifts from a sentence here, the sentence
 * is the bug or the drift is.
 *
 * Disconnect tells the truth about its reach: it deletes everything Cinch
 * holds, and it says where to revoke the grant on Pinterest's side, because
 * Pinterest's API offers no revocation call Cinch could make in the user's
 * name.
 */

const INTRO =
  'Connect Pinterest to draw inspiration from your own boards when you ask the Stylist for a look.';

export default function PinterestConnectionScreen() {
  const router = useRouter();
  const toast = useToast();
  const connection = usePinterestConnection();
  const connect = useConnectPinterest();
  const disconnect = useDisconnectPinterest();

  const status = connection.data?.status ?? null;
  const connectedAt = connection.data?.connectedAt ?? null;

  const statusLine =
    connection.data === undefined
      ? 'Checking…'
      : status === 'connected'
        ? connectedAt
          ? `Connected ${fullDate(connectedAt)}`
          : 'Connected'
        : status === 'expired' || status === 'revoked'
          ? 'Connection lapsed — reconnect to keep using your boards'
          : 'Not connected';

  const onConnect = () => {
    connect.mutate(undefined, {
      onSuccess: (outcome) => {
        if (outcome === 'connected') toast.show('Pinterest connected');
        else if (outcome === 'denied') toast.show('Pinterest said no — nothing was connected');
        else if (outcome === 'not_configured')
          toast.show('Pinterest isn’t available just yet — try again soon');
        else if (outcome === 'failed') toast.show('Couldn’t connect — try again');
        // 'canceled' is the person closing the sheet; it needs no toast.
      },
    });
  };

  const onDisconnect = () => {
    Alert.alert(
      'Disconnect Pinterest?',
      'Cinch deletes everything it holds about this connection. To also withdraw the grant on Pinterest’s side, visit pinterest.com → Settings → Security → Apps.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () =>
            disconnect.mutate(undefined, {
              onSuccess: () => toast.show('Pinterest disconnected'),
              onError: () => toast.show('Couldn’t disconnect — try again'),
            }),
        },
      ],
    );
  };

  return (
    <PrivacyPage parent="Privacy and data" title="Pinterest inspiration" intro={INTRO} onBack={() => router.back()}>
      <View className="rounded-md border border-rule px-4 py-3">
        <Text variant="eyebrow">Status</Text>
        <Text variant="body" className="mt-1">
          {statusLine}
        </Text>
      </View>

      <View className="mt-6">
        {status === 'connected' ? (
          <Button
            title="Disconnect Pinterest"
            variant="ghost"
            loading={disconnect.isPending}
            onPress={onDisconnect}
          />
        ) : (
          <Button
            title={status ? 'Reconnect Pinterest' : 'Connect Pinterest'}
            loading={connect.isPending}
            onPress={onConnect}
          />
        )}
      </View>

      <View className="mt-8 gap-4">
        <Text variant="eyebrow">What this does — and doesn’t</Text>
        <Text variant="body" className="text-muted">
          Cinch asks Pinterest for read-only access to your boards and Pins, nothing more. You
          approve it on Pinterest’s own sign-in page; Cinch never sees your Pinterest password.
        </Text>
        <Text variant="body" className="text-muted">
          Boards and Pins are fetched live each time you ask, shown with credit and a link back to
          Pinterest, and let go. Cinch doesn’t copy them, store them, or send them to an AI model —
          your closet version is built on your phone, from your own clothes.
        </Text>
        <Text variant="body" className="text-muted">
          The connection itself is held server-side, encrypted. Disconnecting deletes it; deleting
          your account deletes it too.
        </Text>
      </View>
    </PrivacyPage>
  );
}
