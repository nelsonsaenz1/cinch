import { ScrollView, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ArrivalRow, type ArrivalRowModel } from '@/components/invite/arrival-row';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionHeader } from '@/components/ui/section-header';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { canvasAlpha, useTheme } from '@/theme/tokens';

/**
 * Invite a friend, rendered (atlas 39, IV-01 and IV-03).
 *
 * Render-only, on the `FriendsPage` precedent: every query, every timer and
 * the two native calls live in the route (`src/app/invite.tsx`), and
 * `dev-invite-link` mounts this same component over fixtures — so what a
 * reviewer signs off there is what ships, by construction.
 *
 * THE LINK IS THE HERO. It is set in serif on the dark card because it is a
 * thing you own, not a field to fill: there is no code to generate, nothing to
 * revoke and no expiry, so the card states a fact rather than offering a
 * control. Everything else on the page is smaller than it.
 *
 * IV-02 is not here. The share sheet is the OS's, raised by `Share` from the
 * route; the atlas draws what iOS renders. What this file owns is the button
 * that raises it.
 */

export type InvitePageProps = {
  /** `https://cinchstyle.com/i/@handle`, or null when no handle is claimed. */
  link: string | null;
  linkLoading: boolean;
  linkError: boolean;
  onRetryLink: () => void;
  /** IV-01's no-handle branch — sends to the profile sheet to claim one. */
  onChooseHandle: () => void;

  onShare: () => void;
  onCopy?: () => void;
  /** IV-03 — the Copy button holds its confirmation for four seconds. */
  copied: boolean;

  arrivals: ArrivalRowModel[];
  arrivalsLoading: boolean;
  arrivalsError: boolean;
  onRetryArrivals: () => void;
  onOpenArrival: (userId: string) => void;

  onBack?: () => void;
};

export function InvitePage(props: InvitePageProps) {
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader
        title="Your circle"
        align="leading"
        onBack={props.onBack}
        backLabel="Back to friends"
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}>
        <View className="px-gutter pt-3">
          {/* The display line and the serif link on ink are the whole
              argument. The motivational subhead that used to sit here said
              nothing the page does not show — and it pushed the hero roughly
              60pt down a 393pt screen to say it. */}
          <Text variant="display" trim accessibilityRole="header">
            Invite a friend
          </Text>
        </View>

        {props.linkError ? (
          <ErrorState
            compact
            title="Couldn't read your link"
            body="Your link is your handle, and this device couldn't reach the profile it lives on. Nothing has changed — the link itself never expires."
            onRetry={props.onRetryLink}
          />
        ) : (
          <LinkCard
            link={props.link}
            loading={props.linkLoading}
            onChooseHandle={props.onChooseHandle}
            onShare={props.onShare}
            onCopy={props.onCopy}
            copied={props.copied}
          />
        )}

        {/* IV-01's second section. The atlas drew "Waiting on" here — named
            recipients with send times — which the rules panel on the same page
            rules out: no per-invite codes and no contact upload means the app
            cannot know a link was sent to anybody. This is what it can know.
            Contract §3.5. */}
        <SectionHeader title="Came in from your link" className="mb-2.5 mt-7 px-gutter" />

        {props.arrivalsLoading ? (
          <ListSkeleton count={2} avatar />
        ) : props.arrivalsError ? (
          <ErrorState
            compact
            title="Couldn't read the list"
            body="This is the only thing on the page that needs the network. Your link works regardless."
            onRetry={props.onRetryArrivals}
          />
        ) : props.arrivals.length === 0 ? (
          <Card padding="lg" className="mx-gutter">
            {/* The honest empty, cut to its two facts: nothing has happened
                yet, and nothing could be listed even if it had — there is no
                record of who the link went to, by design. The middle clause
                described the section heading directly above it. */}
            <Text variant="note">
              Nobody yet. Cinch keeps no record of who you sent it to.
            </Text>
          </Card>
        ) : (
          <Card padding="none" className="mx-gutter">
            {/* Arrivals land rather than appear — the same reanimated pattern
                the requests card uses on friends-page.tsx, and for the same
                reason: a row that fades in and a list that closes its own gaps
                reads as something that happened, not as a re-render. */}
            {props.arrivals.map((arrival, i) => (
              <Animated.View
                key={arrival.userId}
                entering={FadeIn.duration(260)}
                layout={LinearTransition.duration(220)}>
                <ArrivalRow
                  arrival={arrival}
                  onPress={props.onOpenArrival}
                  isLast={i === props.arrivals.length - 1}
                />
              </Animated.View>
            ))}
          </Card>
        )}
      </ScrollView>

      {/* The toast is mounted by the route, over this whole page. */}
    </SafeAreaView>
  );
}

/**
 * The dark card and its two actions.
 *
 * One component because the two are one statement: the link — with what is
 * true of it forever set as a colophon on the card itself — and the two ways
 * to send it. The no-handle branch keeps the same shape and replaces both,
 * rather than dimming a link that does not exist.
 */
function LinkCard({
  link,
  loading,
  onChooseHandle,
  onShare,
  onCopy,
  copied,
}: {
  link: string | null;
  loading: boolean;
  onChooseHandle: () => void;
  onShare: () => void;
  onCopy?: () => void;
  copied: boolean;
}) {
  const theme = useTheme();

  return (
    <View>
      <View
        className="mx-gutter mt-6 rounded-plate"
        style={{
          backgroundColor: theme.ink,
          paddingHorizontal: 22,
          paddingVertical: 26,
        }}>
        {/* On an ink ground the colour is inline, never a second `text-*`
            class: the variant already carries `text-muted` and NativeWind
            gives no precedence between two colour utilities on one element. */}
        <Text variant="eyebrow" style={{ color: canvasAlpha(0.55) }}>
          Your invite link
        </Text>

        {/* `plate` (24px) rather than the atlas's 26: it is the app's compact
            serif step, and at 24 the whole address still sets on one line
            inside the card's 309pt measure. At `title` (28) it wraps. */}
        <Text
          variant="plate"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ color: theme.canvas, marginTop: 10 }}>
          {/* Printed without the scheme, as the atlas sets it: `https://` on
              this card turns an address a person owns into a URL a machine
              parses. Everything that SENDS the link uses the full `link`. */}
          {loading ? 'cinchstyle.com' : link ? link.replace(/^https?:\/\//, '') : 'No link yet'}
        </Text>

        {/* The two permanent facts, set as a tracked rule under the address
            rather than as a standing footnote under the buttons: they are
            properties of the thing on this card, and they belong on it. At the
            eyebrow's own alpha, so the card reads as one object with a line of
            small print top and bottom. */}
        {link ? (
          <Text variant="colophon" style={{ color: canvasAlpha(0.55), marginTop: 14 }}>
            NEVER EXPIRES · NO CODE · ANY NUMBER OF PEOPLE
          </Text>
        ) : null}

        {/* Cut to the half the sender can act on. The App Store hop is the
            recipient's business and not a decision anybody makes here. */}
        <Text variant="note" style={{ color: canvasAlpha(0.7), marginTop: 14 }}>
          {link
            ? 'They land on a page with your name on it. You are friends as soon as they sign in.'
            : 'Your link is your handle, and you have not chosen one yet. Pick one and this card fills in.'}
        </Text>
      </View>

      {link ? (
        <>
          <View className="mt-5 gap-2.5 px-gutter">
            <Button title="Share link" variant="ink" onPress={onShare} />
            {/* Copy is absent, never disabled, on a binary whose clipboard
                module is missing — the rule Profile already follows for the
                Notifications row: a control that cannot work is a dead end
                wearing a label. Share alone is a complete way to send a link.
                Not disabled while it reads "Copied" either: a 40% pill looks
                broken, and pressing again copies again and re-arms the hold. */}
            {onCopy ? (
              <Button
                title={copied ? 'Copied' : 'Copy link'}
                variant="secondary"
                onPress={onCopy}
                accessibilityLabel={copied ? 'Copied. Copy link again' : 'Copy link'}
              />
            ) : null}
          </View>
          {/* At rest this line is not there. What it used to say permanently —
              no expiry, any number of people — is now the colophon on the card
              itself, so the page is one line shorter until there is something
              to say, and it says it only in the four seconds after a copy. */}
          {/* Always mounted so the buttons above it never move: the line
              appears by opacity, not by insertion, and the four-second
              disappearance cannot shift the layout back. */}
          <Text
            variant="noteSmall"
            className="mt-4 px-gutter"
            style={{ opacity: copied ? 1 : 0 }}
            accessibilityElementsHidden={!copied}
            importantForAccessibility={copied ? 'auto' : 'no-hide-descendants'}>
            Paste it wherever you like — it behaves the same everywhere.
          </Text>
        </>
      ) : (
        <View className="mt-5 px-gutter">
          <Button
            title="Choose a handle"
            variant="ink"
            onPress={onChooseHandle}
            disabled={loading}
          />
        </View>
      )}
    </View>
  );
}
