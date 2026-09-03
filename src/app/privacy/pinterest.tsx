import { useRouter } from 'expo-router';
import { Alert, View } from 'react-native';

import { Button, Disclosure, Text } from '@/components/ui';
import { PrivacyPage } from '@/components/privacy/privacy-page';
import { useToast } from '@/components/ui/toast-host';
import { fullDate } from '@/features/privacy/format';
import {
  useConnectPinterest,
  useDisconnectPinterest,
  usePinterestConnection,
} from '@/features/recreate/pinterest';
import { useTheme } from '@/theme/tokens';

/**
 * One scannable fact, dot-led — the same aria-hidden-dot shape
 * `closet-visibility-page.tsx`'s scope list uses, so a screen reader hears one
 * sentence rather than a bullet character followed by one.
 */
function BulletLine({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <View className="flex-row gap-2.5" accessible>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="mt-2 h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: theme.ghost }}
      />
      <Text variant="body" className="min-w-0 flex-1 text-muted">
        {children}
      </Text>
    </View>
  );
}

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
      {/* `PrivacyPage` gutters its own title and intro and hands the rest of
          the page raw — every other page built on it (the index, Delete)
          carries `px-gutter`/`mx-gutter` on each block it passes in. This one
          did not, so the status card and both buttons ran edge to edge while
          the sentences above and below them sat on the gutter: the hierarchy
          loss directive #37 files this screen under, visible at every type
          size and worst at the largest, where the card is tallest. */}
      <View className="mx-gutter rounded-md border border-rule px-4 py-3">
        <Text variant="eyebrow">Status</Text>
        <Text variant="body" className="mt-1">
          {statusLine}
        </Text>
      </View>

      <View className="mt-6 px-gutter">
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

      {/* P2 #53 — three scannable bullets rather than three paragraphs of
          OAuth, storage and AI-handling prose. Nothing here is new: each
          bullet is one sentence off the paragraph it replaces, and the full
          wording is one tap away, unchanged. Gutter-inset like every other
          PrivacyPage child (#37). */}
      <View className="mt-8 gap-3 px-gutter">
        <Text variant="eyebrow">What this does — and doesn’t</Text>
        <BulletLine>Read-only access to your boards and Pins — approved on Pinterest’s own page, never your password.</BulletLine>
        <BulletLine>Fetched live each time you ask, credited, and let go — never copied, stored or sent to an AI model.</BulletLine>
        <BulletLine>The connection is held encrypted. Disconnecting, or deleting your account, deletes it.</BulletLine>
      </View>

      <Disclosure label="Learn more" variant="link" className="mt-4 px-gutter">
        <View className="gap-4">
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
      </Disclosure>
    </PrivacyPage>
  );
}
