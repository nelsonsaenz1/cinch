import { useEffect, useRef, useState } from 'react';
import { ScrollView, Share, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ArrivalPage, type ArrivalPageState } from '@/components/invite/arrival-page';
import { InvitePage } from '@/components/invite/invite-page';
import { Chip, Text } from '@/components/ui';
import { Toast } from '@/components/ui/toast';
import { arrivalName, arrivalSubtitle, type InviteArrival } from '@/features/invite/arrivals';
import { inviteUrl, shareTitle } from '@/features/invite/link';

/**
 * The personal invite link, over fixtures — `cinch://dev-invite-link`.
 *
 * A picker over atlas 39 (IV-01, IV-03, IV-06), so every state can be verified
 * on a simulator, where the real screens need a session, a claimed handle, and
 * — for the arrivals list — somebody who has actually come in through the link.
 *
 * NOT `dev-invite`. That route is the EVENT invite (IF-01…IF-06), a different
 * feature entirely; the two are neighbours in the router and nowhere else.
 *
 * EVERY FRAME IS DRAWN BY THE SHIPPING COMPONENT. `InvitePage` and
 * `ArrivalPage` are the same objects `invite.tsx` and `invite-arrival.tsx`
 * render; there is no re-drawn layout in this file. A fixture that
 * approximates a screen verifies the approximation.
 *
 * IV-02 IS THE OS SHEET. Picking it raises the real `Share` sheet with the
 * real title and the real URL — the atlas draws what iOS renders, so the only
 * honest way to check it is to raise it.
 *
 * IV-04 and IV-05 are web pages and are not in this app.
 *
 * Dev-only twice over: the gate in `app/_layout.tsx` bounces the whole `dev-`
 * prefix outside `__DEV__`, and this file refuses again below.
 */

const HANDLE = 'sophie';
const DISPLAY_NAME = 'Sophie Meyer';
const LINK = inviteUrl(HANDLE);

/** Minutes/hours/days back from now, so the elapsed labels are never stale. */
function ago(days: number, hours = 0): string {
  return new Date(Date.now() - days * 86_400_000 - hours * 3_600_000).toISOString();
}

const ARRIVALS: InviteArrival[] = [
  { userId: 'a-maya', displayName: 'Maya Rahman', username: 'maya', joinedAt: ago(0, 3) },
  { userId: 'a-jonah', displayName: 'Jonah Tate', username: 'jonah', joinedAt: ago(1) },
  // No display name and no timestamp — both are nullable in `profiles`, and
  // the row still has to be a row rather than a blank line.
  { userId: 'a-new', displayName: null, username: null, joinedAt: null },
];

const STATES = [
  { id: 'IV-01', name: 'Default — your link' },
  { id: 'IV-01b', name: 'No handle claimed yet' },
  { id: 'IV-01c', name: 'Nobody has arrived' },
  { id: 'IV-01d', name: 'Arrivals loading' },
  { id: 'IV-01e', name: 'Arrivals failed' },
  { id: 'IV-01f', name: 'Link unreadable' },
  { id: 'IV-02', name: 'Share sheet — the OS' },
  { id: 'IV-03', name: 'Link copied' },
  { id: 'IV-06', name: 'After install — pending friendship' },
  { id: 'IV-06b', name: 'Applying the invite' },
  { id: 'IV-06c', name: 'Invite closed' },
  { id: 'IV-06d', name: 'Apply failed' },
] as const;

type StateId = (typeof STATES)[number]['id'];

const ARRIVAL_STATE: Partial<Record<StateId, ArrivalPageState>> = {
  'IV-06': 'ready',
  'IV-06b': 'applying',
  'IV-06c': 'unavailable',
  'IV-06d': 'error',
};

export default function DevInviteLinkScreen() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<StateId>('IV-01');
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // IV-02 raises the real sheet the moment it is picked, so the frame IS the
  // sheet rather than a drawing of one.
  useEffect(() => {
    if (state !== 'IV-02') return;
    void Share.share({ url: LINK, title: shareTitle(DISPLAY_NAME) }).catch(() => {});
  }, [state]);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const selected = STATES.find((s) => s.id === state)!;
  const arrivalState = ARRIVAL_STATE[state];

  const now = new Date();
  const rows = (state === 'IV-01c' ? [] : ARRIVALS).map((arrival) => ({
    userId: arrival.userId,
    name: arrivalName(arrival),
    subtitle: arrivalSubtitle(arrival, now),
  }));

  /** The copy hold, performed rather than described — four seconds, then off. */
  const copy = () => {
    setState('IV-03');
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setState('IV-01'), 4000);
  };

  return (
    <View className="flex-1 bg-canvas">
      {arrivalState ? (
        <ArrivalPage
          state={arrivalState}
          inviterName={DISPLAY_NAME}
          onAddFirstPiece={() => setState('IV-01')}
          onSeeCloset={() => setState('IV-01')}
          onRetry={() => setState('IV-06')}
          onContinue={() => setState('IV-01')}
        />
      ) : (
        <InvitePage
          link={state === 'IV-01b' ? null : LINK}
          linkLoading={false}
          linkError={state === 'IV-01f'}
          onRetryLink={() => setState('IV-01')}
          onChooseHandle={() => setState('IV-01')}
          onShare={() => setState('IV-02')}
          onCopy={copy}
          copied={state === 'IV-03'}
          arrivals={rows}
          arrivalsLoading={state === 'IV-01d'}
          arrivalsError={state === 'IV-01e'}
          onRetryArrivals={() => setState('IV-01')}
          onOpenArrival={() => setState('IV-01')}
          onBack={() => setState('IV-01')}
        />
      )}

      <Toast
        message="Link copied to your clipboard"
        actionLabel="Done"
        onAction={() => setState('IV-01')}
        visible={state === 'IV-03'}
      />

      {/* The picker. Scaffolding, not a designed surface. */}
      <View
        className="absolute inset-x-0 bottom-0 border-t border-rule bg-canvas"
        style={{ paddingBottom: Math.max(insets.bottom, 10) }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 px-gutter py-2">
          {STATES.map((s) => (
            <Chip key={s.id} label={s.id} selected={s.id === state} onPress={() => setState(s.id)} />
          ))}
        </ScrollView>
        <Text variant="caption" className="px-gutter pb-1">
          {selected.id} · {selected.name}
        </Text>
      </View>
    </View>
  );
}
