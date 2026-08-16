import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommentComposer } from '@/components/event-outfits/CommentComposer';
import { CommentRow } from '@/components/event-outfits/CommentRow';
import { Text } from '@/components/ui/text';
import { audienceScopeLine, commentCountLine } from '@/features/event-outfits/comment-thread';
import { G5_THREAD, g5NameOf } from '@/features/event-outfits/w3-g5-fixtures';

/**
 * CM-01 — thread, replying, composer above the keyboard.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · audit 93 — the reading column is EXACTLY 261 pt on every row, and the
 *   avatar and the overflow control are `flex:none` OUTSIDE it. The frame puts
 *   the long case in situ: "Marguerite Okonkwo-Bell" is 24 characters and wraps
 *   to three lines, and its rectangle is identical to "Sarah"'s above it. The
 *   third row is a reply: indented 26, narrowed to 235, still stable.
 *   `tests/comments-column.test.ts` holds the arithmetic; this holds the sight.
 * · Name and timestamp share ONE line where only the name is Medium; the body
 *   is 16 pt regular. (13 pt, not the atlas's 14 — the type scale in
 *   tailwind.config.js has no 14 and adding one is the integrator's file.
 *   Reported, not taken.)
 * · audit 94 — the privacy scope is in the MASTHEAD, not a footnote under the
 *   composer. It used to sit beneath the field, which is where it vanished from
 *   entirely on a closed thread.
 * · audit 94 — Send is a filled 64 pt action PRESENT BEFORE IT IS NEEDED, and
 *   the reply context sits above the field with a real 44 pt cancel.
 *
 * The keyboard itself is not drawn: this is a real `CommentComposer` in a real
 * layout, and the thing the frame is evidence for is that the composer sits
 * ABOVE it — reply context, draft and Send all in the flow, never behind the keys.
 *
 * DETERMINISM: frozen fixture rows with literal dates. No clock, no network,
 * no spinner, no shimmer.
 */
export default function DevW3G5CM01() {
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
      <View className="px-gutter pt-4">
        <Text variant="title" trim>
          The birthday dinner
        </Text>
        <Text variant="note" className="mt-2">
          {[commentCountLine(7), audienceScopeLine].join(' · ')}
        </Text>
      </View>

      <ScrollView contentContainerClassName="px-gutter pb-4 pt-2">
        {G5_THREAD.map((c) => (
          <CommentRow
            key={c.id}
            comment={c}
            authorName={g5NameOf(c.userId)}
            isMine={false}
            isHost={false}
            hiddenByName="Sarah"
            onReply={noop}
            onReport={noop}
            onDelete={noop}
            onToggleHidden={noop}
          />
        ))}
      </ScrollView>

      <CommentComposer replyToName="Sarah" onCancelReply={noop} onSend={noop} />
    </SafeAreaView>
  );
}
