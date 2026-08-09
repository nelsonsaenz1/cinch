import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReportFlowSheets } from '@/components/report/ReportFlowSheets';
import { SheetOverlay } from '@/components/social/FriendOverflowSheet';
import {
  BlockedEmptyState,
  BlockedRows,
  UnblockSheet,
} from '@/components/social/BlockedList';
import { Chip } from '@/components/ui/chip';
import { Rule } from '@/components/ui/rule';
import { Text } from '@/components/ui/text';
import { REPORT_REASONS } from '@/features/social-graph/moderation';
import type { ReportFlowState, ReportFlowSubject } from '@/features/social-graph/use-report-flow';
import type { BlockedUser } from '@/features/social-graph/types';
import { NotFoundShell } from '@/app/+not-found';
import { useTheme } from '@/theme/tokens';

/**
 * The switcher over every state this unit owns — BL-01…BL-03, RP-01…RP-04,
 * NF-01, NF-02. `cinch://dev-safety`.
 *
 * "Any state without a dev route is a state nobody has looked at." Follows
 * `dev-comments.tsx`'s pattern: real presentational components, fixture data,
 * a `Chip` row at the foot, no network. RP-02/03/04 pose against the real
 * `ReportFlowSheets` — the same component the app mounts — driven by a local
 * fixture object shaped like `ReportFlowState` rather than the real
 * `useReportFlow` hook, because that hook's `submit`/`confirmBlock` are real
 * Supabase writes and a dev fixture must never perform one.
 */

const FRAMES = ['BL-01', 'BL-02', 'BL-03', 'RP-01', 'RP-02', 'RP-03', 'RP-04', 'NF-01', 'NF-02'] as const;
type Frame = (typeof FRAMES)[number];

const BLOCKED_FIXTURE: BlockedUser[] = [
  {
    userId: 'u-rina',
    blockedAt: '2026-06-12T10:00:00Z',
    profile: {
      userId: 'u-rina',
      username: 'rinalo',
      displayName: 'Rina Lo',
      avatarUrl: 'https://example.com/never-used.jpg',
      bio: null,
    },
  },
  {
    userId: 'u-dana',
    blockedAt: '2026-03-03T10:00:00Z',
    profile: {
      userId: 'u-dana',
      username: 'dkerr',
      displayName: 'Dana Kerr',
      avatarUrl: null,
      bio: null,
    },
  },
];

const REPORT_SUBJECT: ReportFlowSubject = {
  subject: 'comment',
  subjectId: 'c-1',
  subjectUserId: 'u-jtroy',
  label: 'Comment by @jtroy_',
  handle: '@jtroy_',
};

export default function DevSafety() {
  const [frame, setFrame] = useState<Frame>('BL-01');

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
          <Text variant="colophon">{frame} · Blocked, Report & Not Found</Text>
          {frame === 'BL-01' ? <BL01 /> : null}
          {frame === 'BL-02' ? <BL02 /> : null}
          {frame === 'BL-03' ? <BL03 /> : null}
          {frame === 'RP-01' ? <RP01 /> : null}
          {frame === 'RP-02' ? <ReportFramePose step="reason" /> : null}
          {frame === 'RP-03' ? <ReportFramePose step="confirmation" /> : null}
          {frame === 'RP-04' ? <ReportFramePose step="blockOffer" /> : null}
          {frame === 'NF-01' || frame === 'NF-02' ? (
            <Text variant="body" className="mt-4 text-muted">
              Full-screen shell shown below the switcher.
            </Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      {frame === 'NF-01' ? (
        <View className="absolute inset-0 top-12">
          <NotFoundShell
            sentence="This one is not here."
            detail="The link may be old, or whoever sent it has taken it down."
            onAction={() => {}}
          />
        </View>
      ) : null}
      {frame === 'NF-02' ? (
        <View className="absolute inset-0 top-12">
          <NotFoundShell
            sentence="This closet is private."
            detail="Ask them for a new link, or follow them and try again."
            onAction={() => {}}
          />
        </View>
      ) : null}

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

/** BL-01 — the list, the date, the one word per row. */
function BL01() {
  return (
    <View className="mt-4">
      <BlockedRows rows={BLOCKED_FIXTURE} onUnblock={() => {}} />
    </View>
  );
}

/** BL-02 — Unblock, confirmed. The sheet opens over BL-01's list. */
function BL02() {
  return (
    <View className="mt-4">
      <BlockedRows rows={BLOCKED_FIXTURE} onUnblock={() => {}} />
      <UnblockSheet
        target={{ userId: 'u-rina', name: 'Rina Lo' }}
        pending={false}
        onConfirm={() => {}}
        onKeep={() => {}}
      />
    </View>
  );
}

/** BL-03 — nobody blocked. */
function BL03() {
  return (
    <View className="mt-4" style={{ minHeight: 420 }}>
      <BlockedEmptyState />
    </View>
  );
}

/**
 * RP-01 — the overflow, illustrated. This is NOT the real menu (that is a
 * native `ActionSheetIOS` on the comment thread, and a hand-built row list on
 * the look board — see `CommentRow.tsx` and `outfits.tsx`); it is a pose of
 * the shape the atlas draws: the subject named in the header, "Report" last
 * and the only coloured row.
 */
function RP01() {
  const theme = useTheme();
  return (
    <View className="mt-4">
      <SheetOverlay visible onClose={() => {}}>
        <View className="overflow-hidden rounded-lg bg-canvas">
          <View className="px-4 pb-3 pt-3.5">
            <Text variant="callout" className="font-medium">
              Comment by @jtroy_
            </Text>
          </View>
          {['Copy text', 'Mute @jtroy_'].map((label) => (
            <View key={label}>
              <Rule tone="hairline" />
              <Pressable style={{ minHeight: 50 }} className="flex-row items-center px-4">
                <Text variant="callout">{label}</Text>
              </Pressable>
            </View>
          ))}
          <Rule tone="hairline" />
          <Pressable style={{ minHeight: 50 }} className="flex-row items-center px-4">
            <Text variant="callout" style={{ color: theme.accent }}>
              Report
            </Text>
          </Pressable>
        </View>
        <View className="mt-2.5 items-center justify-center rounded-lg bg-canvas py-3.5">
          <Text variant="callout" className="font-semibold">
            Cancel
          </Text>
        </View>
      </SheetOverlay>
    </View>
  );
}

/**
 * RP-02, RP-03, RP-04 — the real `ReportFlowSheets`, driven by a fixture
 * object shaped like `ReportFlowState`. Local state only: `submit` and
 * `confirmBlock` just advance the local step, never `useReportContent` /
 * `useBlockUser`.
 */
function ReportFramePose({ step }: { step: 'reason' | 'confirmation' | 'blockOffer' }) {
  const [reason, setReason] = useState<string | null>(step === 'reason' ? null : 'Spam');
  const [note, setNote] = useState('');

  const flow: ReportFlowState = {
    target: REPORT_SUBJECT,
    step,
    reason,
    setReason,
    note,
    setNote,
    canSubmit: reason !== null && (reason !== 'Other' || note.trim().length > 0),
    submitting: false,
    submit: () => {},
    submitError: null,
    acknowledge: () => {},
    confirmBlock: () => {},
    blocking: false,
    close: () => {},
    open: () => {},
    reasons: REPORT_REASONS,
  };

  return (
    <View className="mt-4" style={{ minHeight: 420 }}>
      <ReportFlowSheets flow={flow} />
    </View>
  );
}
