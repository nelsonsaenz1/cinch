import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommentRow } from '@/components/event-outfits/CommentRow';
import { NoticeBand } from '@/components/ui/notice-band';
import { Text } from '@/components/ui/text';
import {
  CLOSED_THREAD_TITLE,
  audienceScopeLine,
  closedThreadLine,
} from '@/features/event-outfits/comment-thread';
import {
  G5_FAILED,
  G5_HIDDEN,
  G5_REPORTED,
  G5_SENDING,
  g5NameOf,
} from '@/features/event-outfits/w3-g5-fixtures';

/**
 * CM-02 — sending, failed, hidden, reported, closed. Five states, drawn together.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · A SENDING comment is already in the thread, in secondary ink, with its
 *   state on the name line. Not a spinner replacing the row, and not a tray:
 *   a tray would say a system spoke, and this is the user's own sentence
 *   waiting.
 * · audit 94 — a FAILED comment keeps its FULL TEXT in a tray at the same
 *   261 pt column with Retry and Edit. The words are never lost and never
 *   moved back into the composer where they could be overwritten, so Edit
 *   opens an input IN THE TRAY. Verified against the shipping mutation:
 *   `useCommentThread` holds failed rows in local state with their body intact
 *   (`{...c, pending:false, failed:true}`), and the new `editAndRetry` sends
 *   the edited row rather than minting a fresh one.
 * · TRAY FILL IS RESERVED for system and moderation messages, which is why the
 *   hidden, reported and closed notices look alike and unlike a person's
 *   comment. All three are the SAME `NoticeBand` — the shared primitive the
 *   Group 5 inventory lists as "Inherited — now also the moderation and system
 *   voice in comments".
 * · A removal names WHO DID IT and WHAT IT DID NOT AFFECT. A report names WHAT
 *   THE OTHER PERSON WAS NOT TOLD.
 * · The composer is GONE from the closed frame entirely, not disabled — "a
 *   disabled field would invite a draft the server will refuse."
 *
 * DEPENDENCY A LANDED (D-1). The atlas ends the closed notice "nothing new can
 * be added", and this frame was drawn without that clause for a whole packet
 * because it was false: there was no `comments_closed` column, no `closes_at`,
 * and no time predicate on `event_comments`' insert policy anywhere in
 * `supabase/migrations`. `20260812120000_close_comments_and_lock_board.sql`
 * added a `before insert` trigger raising `CL001` once the occasion has
 * started, so the clause is now a statement about the database and this frame
 * carries it. The composer is still GONE rather than disabled, which was right
 * either way.
 *
 * AN UNDATED OCCASION NEVER REACHES THIS FRAME: the predicate is
 * `now() < coalesce(starts_at, 'infinity')`, so a thread with no date stays
 * open until an organizer sets one.
 *
 * DETERMINISM: frozen fixture rows with literal dates. No clock, no network.
 */
export default function DevW3G5CM02() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const noop = () => undefined;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="px-gutter pb-10 pt-4">
        <Text variant="title" trim>
          The birthday dinner
        </Text>
        <Text variant="note" className="mt-2">
          {`Row states, drawn together · ${audienceScopeLine}`}
        </Text>

        {[G5_SENDING, G5_FAILED, G5_HIDDEN, G5_REPORTED].map((c) => (
          <CommentRow
            key={c.id}
            comment={c}
            authorName={g5NameOf(c.userId)}
            isMine={c.userId === 'u-me'}
            isHost={false}
            hiddenByName="Sarah"
            onReply={noop}
            onReport={noop}
            onDelete={noop}
            onToggleHidden={noop}
            onRetry={noop}
            onEditFailed={noop}
            onDeletePending={noop}
          />
        ))}

        <NoticeBand
          className="mt-3"
          cause="CLOSED"
          title={CLOSED_THREAD_TITLE}
          body={closedThreadLine('8:00pm')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
