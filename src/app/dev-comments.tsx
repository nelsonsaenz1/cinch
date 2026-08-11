import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommentComposer } from '@/components/event-outfits/CommentComposer';
import { CommentRow, type ThreadComment } from '@/components/event-outfits/CommentRow';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

/**
 * The Event Comments fixture — `cinch://dev-comments`.
 *
 * Renders EC-01 through EC-04 (the atlas's own M-01…M-04, renumbered per
 * `docs/design/event-social-contract.md` §5 to avoid the Match & Confirm
 * collision) against the real `CommentRow` and `CommentComposer` — no
 * network, following dev-wall.tsx's pattern.
 */

const row = (over: Partial<ThreadComment> & { id: string; userId: string; body: string }): ThreadComment => ({
  eventId: 'ev1',
  postId: 'b',
  reported: false,
  hidden: false,
  createdAt: AGO(2 * 3_600_000),
  ...over,
});

const NAMES: Record<string, string> = { dana: 'Dana', mel: 'Mel', tom: 'Tom', rob: 'Rob', me: 'You' };
const nameOf = (userId: string) => (userId === 'me' ? 'You' : (NAMES[userId] ?? null));

const FRAMES = ['EC-01', 'EC-02', 'EC-03', 'EC-04'] as const;
type Frame = (typeof FRAMES)[number];

export default function DevComments() {
  const [frame, setFrame] = useState<Frame>('EC-01');

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-canvas">
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView contentContainerClassName="px-gutter pb-32 pt-3">
          <Text variant="colophon">{frame} · Event Comments</Text>
          {frame === 'EC-01' ? <EC01 /> : null}
          {frame === 'EC-02' ? <EC02 /> : null}
          {frame === 'EC-03' ? <EC03 /> : null}
          {frame === 'EC-04' ? <EC04 /> : null}
        </ScrollView>
      </SafeAreaView>

      <View className="absolute bottom-0 left-0 right-0 border-t border-rule bg-canvas px-3 pb-8 pt-2.5">
        <View className="flex-row flex-wrap gap-2">
          {FRAMES.map((f) => (
            <Chip key={f} label={f} selected={frame === f} selectedGround="ink" onPress={() => setFrame(f)} />
          ))}
        </View>
      </View>
    </View>
  );
}

const RowFrame = ({ comment }: { comment: ThreadComment }) => (
  <CommentRow
    comment={comment}
    authorName={comment.userId === 'dana' ? 'Dana' : nameOf(comment.userId)}
    isMine={comment.userId === 'me'}
    isHost={false}
    hiddenByName="Mel"
    onReply={() => {}}
    onReport={() => {}}
    onDelete={() => {}}
    onToggleHidden={() => {}}
    onRetry={() => {}}
    onDeletePending={() => {}}
    onUndoBlock={() => {}}
  />
);

/**
 * Fixture timestamps, frozen at module load.
 *
 * These were `Date.now()` calls inside a `useState` initialiser, which makes
 * the render impure — every re-render computed a fresh "two hours ago". For a
 * demo screen the visible cost is nil, but the rule is worth keeping because
 * the same shape in a real component produces a component that can never be
 * memoised and quietly re-renders forever.
 */
const DEMO_NOW = Date.now();
const AGO = (ms: number) => new Date(DEMO_NOW - ms);

/** EC-01 — the thread open on a look: one indent, one reply, one compliment. */
function EC01() {
  const [rows, setRows] = useState<ThreadComment[]>([
    row({ id: '1', userId: 'dana', body: 'The skirt is the whole thing. Wear the tote, not the clutch.', createdAt: AGO(2 * 3_600_000) }),
    row({ id: '2', userId: 'mel', body: '@Dana tote it is.', createdAt: AGO(2 * 3_600_000) }),
    row({ id: '3', userId: 'tom', body: 'Chic', createdAt: AGO(3_600_000) }),
    row({ id: '4', userId: 'me', body: 'Both, honestly. Bring the loafers.', createdAt: AGO(4 * 60_000) }),
  ]);
  const [replyTo, setReplyTo] = useState<string | null>(null);

  return (
    <View className="mt-4">
      <Text variant="caption" className="mb-1">
        Only the people at this event can read this.
      </Text>
      <View className="mt-2">
        {rows.map((c) => (
          <CommentRow
            key={c.id}
            comment={c}
            authorName={nameOf(c.userId)}
            isMine={c.userId === 'me'}
            isHost={false}
            hiddenByName="Mel"
            onReply={(comment) => setReplyTo(nameOf(comment.userId))}
            onReport={() => {}}
            onDelete={(comment) => setRows((r) => r.filter((x) => x.id !== comment.id))}
            onToggleHidden={() => {}}
          />
        ))}
      </View>
      <View className="-mx-gutter mt-2">
        <CommentComposer
          replyToName={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onSend={(body) => {
            setRows((r) => [...r, row({ id: `n${r.length}`, userId: 'me', body, createdAt: new Date() })]);
            setReplyTo(null);
          }}
        />
      </View>
    </View>
  );
}

/** EC-02 — composer rest / typing / sending / didn't send, plus the char rule. */
function EC02() {
  const theme = useTheme();
  return (
    <View className="mt-4 gap-6">
      <View>
        <Text variant="eyebrow" className="mb-2">
          Rest
        </Text>
        <View className="-mx-gutter">
          <CommentComposer replyToName={null} onCancelReply={() => {}} onSend={() => {}} />
        </View>
      </View>
      <View>
        <Text variant="eyebrow" className="mb-2">
          Replying, past the 240-character mark
        </Text>
        <View className="-mx-gutter">
          <CommentComposer replyToName="Dana" onCancelReply={() => {}} onSend={() => {}} />
        </View>
        <Text variant="caption" className="px-1">
          Type past 240 characters here to see the counter — silent below it.
        </Text>
      </View>
      <View>
        <Text variant="eyebrow" className="mb-2">
          Sending — the optimistic row, at 55%
        </Text>
        <RowFrame comment={row({ id: 's', userId: 'me', body: 'The tote is the right call.', pending: true })} />
      </View>
      <View>
        <Text variant="eyebrow" className="mb-2">
          Didn’t send — text stays put, retry on the row
        </Text>
        <RowFrame comment={row({ id: 'f', userId: 'me', body: 'The tote is the right call.', failed: true })} />
        <Text variant="caption" style={{ color: theme.muted }}>
          A failure keeps the text where it was written — never a toast that disappears with the sentence inside it.
        </Text>
      </View>
    </View>
  );
}

/** EC-03 — moderation: hidden, reported, blocked, and the on-row menus. */
function EC03() {
  return (
    <View className="mt-4 gap-6">
      <View>
        <Text variant="eyebrow" className="mb-2">
          Hidden by the host — seen by everyone
        </Text>
        <RowFrame comment={row({ id: 'h1', userId: 'rob', body: 'Not sure about the skirt with those.', hidden: true })} />
      </View>
      <View>
        <Text variant="eyebrow" className="mb-2">
          Hidden by the host — seen by its author
        </Text>
        <RowFrame comment={row({ id: 'h2', userId: 'me', body: 'Not sure about the skirt with those.', hidden: true })} />
      </View>
      <View>
        <Text variant="eyebrow" className="mb-2">
          Under review after a report — collapsed, still openable
        </Text>
        <RowFrame comment={row({ id: 'r1', userId: 'rob', body: 'That’s a strange choice honestly.', reported: true })} />
      </View>
      <View>
        <Text variant="eyebrow" className="mb-2">
          From someone you blocked
        </Text>
        <CommentRow
          comment={row({ id: 'b1', userId: 'rob', body: '', blockedAuthorName: 'Rob' })}
          authorName="Rob"
          isMine={false}
          isHost={false}
          hiddenByName={null}
          onReply={() => {}}
          onReport={() => {}}
          onDelete={() => {}}
          onToggleHidden={() => {}}
          onUndoBlock={() => {}}
        />
        <Text variant="caption" className="mt-1">
          Not reachable from the live thread — a blocked author’s rows are filtered server-side
          (20260807120000). Built here so the state is still on record.
        </Text>
      </View>
      <View>
        <Text variant="eyebrow" className="mb-2">
          On a row — someone else’s / your own
        </Text>
        <View className="flex-row gap-3">
          <RowFrame comment={row({ id: 'o1', userId: 'tom', body: 'Loafers over the boots.' })} />
        </View>
        <RowFrame comment={row({ id: 'o2', userId: 'me', body: 'Loafers over the boots.' })} />
      </View>
      <View className="rounded-plate border border-hairline bg-surface p-4">
        <Text variant="plate" trim>
          Report this comment?
        </Text>
        <Text variant="callout" className="mt-2 text-muted">
          We’ll read it. Tom isn’t told, and the host isn’t either.
        </Text>
      </View>
    </View>
  );
}

/** EC-04 — empty, loading, failed, and after the occasion. */
function EC04() {
  return (
    <View className="mt-4 gap-8">
      <View>
        <Text variant="eyebrow" className="mb-2">
          No comments yet
        </Text>
        <Text variant="plate" trim>
          Nobody’s said anything yet
        </Text>
        <Text variant="callout" className="mt-2 text-muted">
          Say what works. Mel picked these four out for Saturday.
        </Text>
      </View>
      <View>
        <Text variant="eyebrow" className="mb-3">
          Loading
        </Text>
        <View className="gap-4">
          {[0, 1].map((i) => (
            <View key={i} className="flex-row gap-3">
              <Skeleton className="h-7 w-7 rounded-full" />
              <View className="flex-1 gap-2">
                <Skeleton className="h-3.5 rounded-sm" style={{ width: `${86 - i * 22}%` }} />
              </View>
            </View>
          ))}
        </View>
      </View>
      <View>
        <Text variant="plate" trim>
          The thread didn’t load
        </Text>
        <Text variant="callout" className="mt-2 text-muted">
          Nothing was lost — the connection dropped on the way.
        </Text>
        <Button title="Try again" variant="secondary" haptic onPress={() => {}} className="mt-3 self-start px-6" />
      </View>
      <View>
        <Text variant="eyebrow" className="mb-2">
          After the occasion
        </Text>
        <View className="rounded-md bg-tray px-3.5 py-3">
          <Text variant="callout" className="text-muted">
            The dinner’s been and gone. The thread stays readable.
          </Text>
        </View>
        <Text variant="caption" className="mt-2">
          The composer is removed, not disabled — the rows keep their overflow menus.
        </Text>
      </View>
    </View>
  );
}
