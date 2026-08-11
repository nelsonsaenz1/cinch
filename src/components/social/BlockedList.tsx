import { useState } from 'react';
import { Alert, View } from 'react-native';

import { SheetOverlay } from '@/components/social/FriendOverflowSheet';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/empty-state';
import { Rule } from '@/components/ui/rule';
// Pre-declared seam (docs/design/field-guide-audit.md, Batch 1): `RowSkeleton`
// lands alongside `Skeleton`'s export. Code against the contract.
import { RowSkeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useUnblockUser } from '@/features/social-graph/moderation';
import { useBlockedUsers } from '@/features/social-graph/queries';
import { profileName, type BlockedUser } from '@/features/social-graph/types';
import { MIN_TAP_TARGET } from '@/theme/tokens';

/**
 * Blocked users, manageable — the half of App Store Guideline 1.2 that is
 * easy to forget: blocking must be undoable somewhere findable.
 *
 * Names show only for public accounts. `social_profiles` screens out blocked
 * pairs by design, so a private blocked account has no readable identity here
 * and renders as a neutral row — blocking someone must not keep a window open
 * onto their profile.
 *
 * This is a moderation surface, so its four states are never allowed to
 * collapse into each other: loading must not look settled, and a failed fetch
 * must never render as "Nobody is blocked." — on this screen specifically,
 * that message tells a woman her blocks vanished, which is frightening on its
 * own and unsafe if she acts on the belief.
 *
 * BL-01's headline claim only prints above rows that exist — BL-03 (nobody
 * blocked) says nothing about what blocking does, because there is nothing on
 * screen for the claim to be about. See `system-safety-contract.md` §2 for
 * why the claim can be printed as fact at all: `20260809160000` made it true.
 */
export function BlockedList() {
  const blocked = useBlockedUsers();
  const unblock = useUnblockUser();
  const [target, setTarget] = useState<{ userId: string; name: string } | null>(null);

  if (blocked.isLoading) {
    return (
      <View>
        <RowSkeleton />
        <RowSkeleton />
      </View>
    );
  }

  if (blocked.isError) {
    return (
      <ErrorState
        title="Couldn’t load your blocked list"
        body="This didn’t load — it does not mean no one is blocked. Try again before assuming anything changed."
        onRetry={() => void blocked.refetch()}
      />
    );
  }

  const rows = blocked.data ?? [];

  if (rows.length === 0) {
    return <BlockedEmptyState />;
  }

  const confirmUnblock = () => {
    if (!target) return;
    const { userId } = target;
    setTarget(null);
    unblock.mutate(
      { userId },
      {
        onError: (err) =>
          Alert.alert(
            'Could not unblock',
            err instanceof Error ? err.message : 'Something went wrong. Try again.',
          ),
      },
    );
  };

  return (
    <View>
      <BlockedRows rows={rows} onUnblock={setTarget} />

      <UnblockSheet
        target={target}
        pending={unblock.isPending}
        onKeep={() => setTarget(null)}
        onConfirm={confirmUnblock}
      />
    </View>
  );
}

/**
 * BL-03 — the common case. One serif line, one sentence, no illustration.
 * Presentational, exported so `dev-safety.tsx` can pose it without a query.
 */
export function BlockedEmptyState() {
  return (
    <View className="flex-1 items-center justify-center py-20">
      <Text variant="title" trim className="text-center">
        Nobody is blocked
      </Text>
      <Text variant="body" className="mt-2.5 text-center text-muted">
        If you block someone, they will appear here with the date, and you can undo it.
      </Text>
    </View>
  );
}

/**
 * BL-01 — the headline claim, the count, the rows, the footer note.
 * Presentational, exported so `dev-safety.tsx` can pose it against fixture
 * rows without a query.
 */
export function BlockedRows({
  rows,
  onUnblock,
}: {
  rows: BlockedUser[];
  onUnblock: (target: { userId: string; name: string }) => void;
}) {
  return (
    <View>
      {/* BL-01's headline — now a fact, not a hope. See the module doc. */}
      <Text variant="body" className="text-muted">
        Blocking removed their votes from your looks and took them off every event you host. They
        cannot see your closet, and you will not see theirs.
      </Text>

      <Text variant="eyebrow" className="mb-2 mt-6">
        {rows.length} {rows.length === 1 ? 'person' : 'people'}
      </Text>

      <Card padding="none">
        {rows.map((row, i) => (
          <View key={row.userId}>
            {i > 0 ? <Rule tone="hairline" /> : null}
            <BlockedRow row={row} onUnblock={onUnblock} />
          </View>
        ))}
      </Card>

      <Text variant="noteSmall" className="mt-4 text-muted">
        Unblocking does not restore the votes retracted when you blocked them. It only lets them
        find you again.
      </Text>
    </View>
  );
}

/** "12 June" / "12 June 2025" — the year only when it is not this one. */
function blockedOn(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const day = date.getDate();
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const year = date.getFullYear();
  return year === new Date().getFullYear() ? `${day} ${month}` : `${day} ${month} ${year}`;
}

function BlockedRow({
  row,
  onUnblock,
}: {
  row: BlockedUser;
  onUnblock: (target: { userId: string; name: string }) => void;
}) {
  const name = row.profile ? profileName(row.profile) : 'A private member';
  const handle = row.profile?.username ? `@${row.profile.username}` : null;
  const on = blockedOn(row.blockedAt);
  const subtitle = [handle, on ? `blocked ${on}` : null].filter(Boolean).join(' · ');

  return (
    <View className="flex-row items-center gap-3 px-4 py-3.5" style={{ minHeight: MIN_TAP_TARGET }}>
      {/* Initials only, always. "A blocked person should not get a face in
          your app." — `imageUri` is never passed here, even though the
          hydrated profile may carry an `avatarUrl`: `ProfileRow` (the list
          grammar every other people-list uses) forwards that url straight to
          `Avatar`, which is exactly the one thing this row must not do. */}
      <Avatar name={name} size={44} tone="sand" imageUri={null} />
      <View className="flex-1">
        <Text variant="body" numberOfLines={1}>
          {name}
        </Text>
        {subtitle ? (
          <Text variant="caption" numberOfLines={1} className="mt-0.5 text-muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {/* Ghost — ink, never oxblood. Unblocking is not destructive. */}
      <Button title="Unblock" variant="ghost" onPress={() => onUnblock({ userId: row.userId, name })} />
    </View>
  );
}

/**
 * BL-02 — the confirm. Hand-built rather than `events/ConfirmSheet`, which
 * hard-codes its destructive button to `critical`: that is precisely the one
 * thing this confirm must not be. "Keep blocked" is the calm default the
 * atlas names in so many words, so it sits second and quiet; "Unblock" sits
 * first, filled ink.
 */
export function UnblockSheet({
  target,
  pending,
  onConfirm,
  onKeep,
}: {
  target: { userId: string; name: string } | null;
  pending: boolean;
  onConfirm: () => void;
  onKeep: () => void;
}) {
  return (
    <SheetOverlay visible={target !== null} onClose={pending ? () => undefined : onKeep}>
      {target ? (
        <View className="overflow-hidden rounded-plate bg-canvas p-5">
          <Text variant="plate" accessibilityRole="header">
            Unblock {target.name}?
          </Text>
          <Text variant="body" className="mt-2.5 text-muted">
            They will be able to find your closet, vote on your looks and join events you host.
            The votes retracted when you blocked them do not come back.
          </Text>
          <View className="mt-4 gap-2.5">
            <Button title="Unblock" variant="ink" loading={pending} onPress={onConfirm} />
            <Button title="Keep blocked" variant="secondary" disabled={pending} onPress={onKeep} />
          </View>
        </View>
      ) : null}
    </SheetOverlay>
  );
}
