import { useState } from 'react';
import { View } from 'react-native';

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
import {
  BLOCK_ELSEWHERE_LINE,
  BLOCKED_EMPTY_BODY,
  BLOCKED_EMPTY_TITLE,
  BLOCKED_MASTHEAD,
  blockedCountLine,
  blockedWhen,
  KEEP_BLOCKED_ACTION,
  STILL_BLOCKED_LABEL,
  UNBLOCK_ACTION,
  UNBLOCK_FAILED_LINE,
  UNBLOCKING_LABEL,
  unblockConsequences,
  unblockQuestion,
} from '@/features/social-graph/blocked-lines';
import { useUnblockUser } from '@/features/social-graph/moderation';
import { useBlockedUsers } from '@/features/social-graph/queries';
import { profileName, type BlockedUser } from '@/features/social-graph/types';
import { MIN_TAP_TARGET } from '@/theme/tokens';

/**
 * Blocked people — SF-01/02/03, which are aliases of BL-01/BL-02 plus a state
 * sheet, not new screens (correction 28).
 *
 * Manageable blocking is the half of App Store Guideline 1.2 that is easy to
 * forget: blocking must be undoable somewhere findable. This is that place.
 *
 * ── WHAT AUDIT 99 CHANGED, AND WHAT IT DID NOT ────────────────────────────
 *
 * Its headline finding — "Unblock acted on one tap, with no confirmation" —
 * was already false in this repository: `UnblockSheet` has stood between the
 * row and the delete since wave 3 phase 1. What the audit genuinely adds is
 * the SHAPE of that sheet: three regular paragraphs rather than one bolded
 * block, both named consequences present, and a second action named for its
 * outcome instead of "Cancel". All three are now true, in `blocked-lines.ts`.
 *
 * ── FOUR STATES THAT MAY NEVER COLLAPSE INTO EACH OTHER ───────────────────
 *
 * Loading must not look settled, and a failed fetch must never render as
 * "Nobody is blocked" — on this screen specifically, that message tells
 * someone their blocks vanished, which is frightening on its own and unsafe if
 * they act on it. A failed UNBLOCK is the same class of problem in the other
 * direction and now gets its own row state rather than an `Alert`: a modal
 * that dismisses leaves no evidence of which person did not change, and a
 * user who cannot tell whether a block lapsed has a real problem.
 *
 * `now` is passed in rather than read from the clock, so every fixture route
 * renders byte-identical dates on every run.
 */
export function BlockedList({ now = new Date() }: { now?: Date } = {}) {
  const blocked = useBlockedUsers();
  const unblock = useUnblockUser();
  const [target, setTarget] = useState<{ userId: string; name: string } | null>(null);
  /** The one row currently being deleted, and the one that just failed. */
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);

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

  const runUnblock = (userId: string) => {
    setPendingId(userId);
    setFailedId(null);
    unblock.mutate(
      { userId },
      {
        onSuccess: () => setPendingId(null),
        // Stays on the row. See the module docblock for why this is not an
        // Alert: the failure is a fact about one person's block, and it has to
        // survive on screen next to that person.
        onError: () => {
          setPendingId(null);
          setFailedId(userId);
        },
      },
    );
  };

  return (
    <View>
      <BlockedRows
        rows={rows}
        now={now}
        pendingId={pendingId}
        failedId={failedId}
        onUnblock={setTarget}
        onRetry={runUnblock}
      />

      <UnblockSheet
        target={target}
        onKeep={() => setTarget(null)}
        onConfirm={() => {
          if (!target) return;
          const { userId } = target;
          setTarget(null);
          runUnblock(userId);
        }}
      />
    </View>
  );
}

/**
 * SF-03's empty room. No illustration, and no headline claim about what
 * blocking does to somebody — there is nobody on screen for the claim to be
 * about. It teaches the mechanism instead, and repeats the two facts that
 * matter: nobody is told, and it is reversible from here.
 */
export function BlockedEmptyState() {
  return (
    <View className="flex-1 items-center justify-center py-20">
      <Text variant="title" trim className="text-center">
        {BLOCKED_EMPTY_TITLE}
      </Text>
      <Text variant="body" className="mt-2.5 text-center text-muted">
        {BLOCKED_EMPTY_BODY}
      </Text>
    </View>
  );
}

/**
 * SF-01 — the whole consequence once at the top, the count, the rows, and the
 * note saying where blocking someone new lives.
 *
 * Presentational, so the fixture routes can pose every state against literal
 * rows without a query anywhere near them.
 */
export function BlockedRows({
  rows,
  now,
  pendingId = null,
  failedId = null,
  onUnblock,
  onRetry,
}: {
  rows: BlockedUser[];
  now: Date;
  pendingId?: string | null;
  failedId?: string | null;
  onUnblock: (target: { userId: string; name: string }) => void;
  onRetry: (userId: string) => void;
}) {
  return (
    <View>
      <Text variant="body" className="text-muted">
        {blockedCountLine(rows.length)} {BLOCKED_MASTHEAD}
      </Text>

      {failedId ? (
        <Text variant="note" className="mt-3.5">
          {UNBLOCK_FAILED_LINE}
        </Text>
      ) : null}

      <Card padding="none" className="mt-5">
        {rows.map((row, i) => (
          <View key={row.userId}>
            {i > 0 ? <Rule tone="hairline" /> : null}
            <BlockedRow
              row={row}
              now={now}
              pending={row.userId === pendingId}
              failed={row.userId === failedId}
              onUnblock={onUnblock}
              onRetry={onRetry}
            />
          </View>
        ))}
      </Card>

      <Text variant="note" className="mt-4">
        {BLOCK_ELSEWHERE_LINE}
      </Text>
    </View>
  );
}

function BlockedRow({
  row,
  now,
  pending,
  failed,
  onUnblock,
  onRetry,
}: {
  row: BlockedUser;
  now: Date;
  pending: boolean;
  failed: boolean;
  onUnblock: (target: { userId: string; name: string }) => void;
  onRetry: (userId: string) => void;
}) {
  // A row with no display name falls back to the HANDLE, which is the second
  // row the atlas draws — and it draws it with its `@`, because "lmartel" bare
  // reads as a name somebody chose and "@lmartel" reads as the handle it is.
  // `profileName` drops the sigil (it is the app-wide "what do we call this
  // person" helper), so the sigil is added back here rather than changed there.
  // "A private member" is what is left when `public_profiles` returns nothing
  // readable at all.
  const name = row.profile
    ? row.profile.displayName || (row.profile.username ? `@${row.profile.username}` : profileName(row.profile))
    : 'A private member';
  const when = blockedWhen(row.blockedAt, now);
  const sub = pending ? UNBLOCKING_LABEL : failed ? STILL_BLOCKED_LABEL : when;

  return (
    <View
      className="flex-row items-center gap-3 px-4 py-3"
      style={{ minHeight: 68 }}>
      {/* Initials on a tray ground, always. A blocked person's photograph does
          not belong on this screen — `imageUri` is never passed here even
          though the hydrated profile may carry an `avatarUrl`, which is exactly
          the one thing `ProfileRow` (the grammar every other people-list uses)
          would do with it. */}
      <Avatar name={name} size={44} tone="sand" imageUri={null} />
      <View className="flex-1">
        <Text variant="body" numberOfLines={1}>
          {name}
        </Text>
        {sub ? (
          <Text variant="caption" numberOfLines={1} className="mt-0.5 text-muted">
            {sub}
          </Text>
        ) : null}
      </View>
      {pending ? (
        // A tray-filled word rather than a spinner, and rather than nothing:
        // the affordance keeps its place so the row does not reflow, and a
        // spinner can never reproduce its own pixels in a capture.
        <View
          className="flex-none rounded-md bg-tray px-3"
          style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}>
          <Text variant="label" className="text-muted">
            Working
          </Text>
        </View>
      ) : failed ? (
        <Button title="Retry" variant="ghost" onPress={() => onRetry(row.userId)} />
      ) : (
        // Ghost — ink, never oxblood. Unblocking is a restoration.
        <Button
          title="Unblock"
          variant="ghost"
          onPress={() => onUnblock({ userId: row.userId, name })}
        />
      )}
    </View>
  );
}

/**
 * SF-02 — the confirmation, and SF-02 / AX by construction.
 *
 * Hand-built rather than `events/ConfirmSheet`, which hard-codes its
 * destructive button to `critical`: that is precisely the one thing this
 * confirm must not be.
 *
 * The consequence SCROLLS and the two actions PIN. Not only at the largest
 * Dynamic Type size — always, because the alternative is a layout that is
 * correct at the size somebody tested and wrong at the one a reader uses. On a
 * consequential sheet the options must never be off screen, and the reading
 * order puts them last as well, so nobody confirms before hearing why.
 */
export function UnblockSheet({
  target,
  onConfirm,
  onKeep,
}: {
  target: { userId: string; name: string } | null;
  onConfirm: () => void;
  onKeep: () => void;
}) {
  return (
    <SheetOverlay visible={target !== null} onClose={onKeep}>
      {target ? (
        <View className="overflow-hidden rounded-plate bg-canvas">
          <View className="max-h-[420px] p-5">
            <Text variant="plate" accessibilityRole="header">
              {unblockQuestion(target.name)}
            </Text>
            {/* Three REGULAR paragraphs. Nothing here is Medium and nothing is
                oxblood: audit 99's finding was that a bolded consequence reads
                as a warning, and unblocking is not one. */}
            {unblockConsequences(target.name).map((line) => (
              <Text key={line} variant="body" className="mt-2.5 text-muted">
                {line}
              </Text>
            ))}
          </View>
          <Rule tone="hairline" />
          <View className="gap-2.5 p-5">
            <Button title={UNBLOCK_ACTION} variant="ink" onPress={onConfirm} />
            <Button title={KEEP_BLOCKED_ACTION} variant="secondary" onPress={onKeep} />
          </View>
        </View>
      ) : null}
    </SheetOverlay>
  );
}
