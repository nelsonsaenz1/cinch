import { useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BorrowLendSheet } from '@/components/social/borrow-lend-sheet';
import { BorrowRequestRow } from '@/components/social/BorrowRequestRow';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/empty-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { Toast } from '@/components/ui/toast';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import {
  firstName,
  garmentNoun,
  useBorrowActions,
  useBorrowScreenModel,
  useOwnItemWears,
  type BorrowLocalStatus,
  type BorrowRowModel,
  type BorrowToast,
} from '@/features/social-graph/borrowing';
import { type BorrowThread } from '@/features/social-graph/types';
import { useTheme } from '@/theme/tokens';

/**
 * Borrowing — both directions of every request, newest first.
 *
 * "Asked of you" sits above "You asked" because the top of this screen is for
 * the things that want a decision from *you*. There are no due dates and no
 * reminders anywhere below: the lifecycle is request → lend/decline →
 * returned, and the physical handover stays in real life where it belongs.
 *
 * All sentence and time derivation lives in `useBorrowScreenModel`; this file
 * only lays rows out and wires verbs. Lending is the one action with a sheet
 * (it moves an object in the world); decline, withdraw and mark-returned
 * commit on tap with a five-second undo, so their failures surface through
 * the actions' toast, never an Alert.
 */

/**
 * A row whose deferred action is still inside its undo window renders as the
 * settled sentence it is about to become. The model only re-derives on cache
 * change, so the sentence for the overridden state is composed here from the
 * same exported words — and the day is honestly "Today", because the override
 * exists only for an action taken moments ago.
 */
function overriddenCopy(
  row: BorrowRowModel,
  status: BorrowLocalStatus,
): { headline: string; meta: string } {
  const name = firstName(row.thread.counterpart);
  const piece = garmentNoun(row.thread.item);
  switch (status) {
    case 'declined':
      return { headline: `You declined ${name}’s ${piece}`, meta: 'Today' };
    case 'canceled':
      return { headline: 'You withdrew your ask', meta: 'Today' };
    case 'returned':
      return { headline: `Your ${piece} is back`, meta: 'Today' };
  }
}

// Vary the headline bars so the wait reads as sentences arriving, not stripes.
const SKELETON_WIDTHS = ['80%', '65%', '72%'] as const;

/**
 * Card-shaped loading rows. Not `ListSkeleton`: its avatar-disc-and-hairline
 * anatomy is the roster's, and this page's rows are square-thumbed cards. No
 * bar here is button-shaped on purpose — a tappable-looking Lend not yet
 * bound to a request is the one mistake this page cannot afford.
 */
function BorrowSkeleton() {
  return (
    <View accessibilityLabel="Loading your requests" className="gap-3 px-gutter pt-6">
      <Skeleton className="h-2.5 w-24 rounded-chip" />
      {SKELETON_WIDTHS.map((width, i) => (
        <Card key={i} padding="md">
          <View className="flex-row items-center gap-3">
            <Skeleton delay={i * 120} style={{ width: 56, height: 56, borderRadius: 10 }} />
            <View className="flex-1 gap-2">
              <Skeleton delay={i * 120} className="h-3.5 rounded-chip" style={{ width }} />
              <Skeleton delay={i * 120} className="h-2.5 w-1/3 rounded-chip" />
            </View>
          </View>
        </Card>
      ))}
    </View>
  );
}

export default function BorrowScreen() {
  const router = useRouter();
  const theme = useTheme();

  const model = useBorrowScreenModel();
  const {
    lend,
    decline,
    withdraw,
    markReturned,
    pendingLocal,
    toast,
    dismissToast,
  } = useBorrowActions();

  // The lend sheet's subject. `open` is separate from the thread so the sheet
  // keeps its content while the Modal slides out.
  const [sheetThread, setSheetThread] = useState<BorrowThread | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const wears = useOwnItemWears(sheetThread?.item?.id ?? null);

  // The toast animates out after the data layer nulls it, so the last real
  // content has to outlive the state that showed it. Derived in render (the
  // prev-state pattern), never from a ref — render must not read refs.
  const [lastToast, setLastToast] = useState<BorrowToast | null>(null);
  if (toast && toast !== lastToast) setLastToast(toast);
  const shownToast = toast ?? lastToast;

  const rows = [...model.incoming, ...model.outgoing];
  const { resolve } = useSignedUrls(
    rows.flatMap((r) => [r.thread.item?.thumbPath, r.thread.item?.cutoutPath]),
  );

  const openSheet = (thread: BorrowThread) => {
    setSheetThread(thread);
    setSheetOpen(true);
  };

  const renderRow = (row: BorrowRowModel) => {
    const { thread } = row;
    const override = pendingLocal[thread.request.id];
    const copy = override ? overriddenCopy(row, override) : row;

    let primaryAction: { title: string; onPress: () => void } | undefined;
    let secondaryAction: { title: string; onPress: () => void } | undefined;
    if (!override) {
      if (row.kind === 'incoming-pending') {
        primaryAction = { title: 'Lend it', onPress: () => openSheet(thread) };
        secondaryAction = { title: 'Decline', onPress: () => decline(thread) };
      } else if (row.kind === 'incoming-approved') {
        secondaryAction = { title: 'Mark returned', onPress: () => markReturned(thread) };
      } else if (row.kind === 'outgoing-pending') {
        secondaryAction = { title: 'Withdraw', onPress: () => withdraw(thread) };
      }
    }

    return (
      <BorrowRequestRow
        key={row.key}
        imageUri={resolve(thread.item?.thumbPath, thread.item?.cutoutPath)}
        headline={copy.headline}
        meta={copy.meta}
        settled={row.settled || Boolean(override)}
        primaryAction={primaryAction}
        secondaryAction={secondaryAction}
      />
    );
  };

  const section = (title: string, sectionRows: BorrowRowModel[], emptyLine: string, first: boolean) => (
    <>
      <SectionHeader
        title={title}
        className={first ? 'mb-3 mt-6' : 'mb-3 mt-7'}
        trailing={
          sectionRows.length > 0 ? (
            <Text variant="noteSmall">{sectionRows.length}</Text>
          ) : undefined
        }
      />
      {sectionRows.length === 0 ? (
        // The empty half is a line of grey text, not a card — the headings
        // hold their order so the page never rearranges itself between visits.
        <Text variant="note">{emptyLine}</Text>
      ) : (
        <View className="gap-3">{sectionRows.map(renderRow)}</View>
      )}
    </>
  );

  const empty = model.incoming.length === 0 && model.outgoing.length === 0;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader align="leading" />

      <View className="px-gutter pt-3">
        <Text variant="display" trim accessibilityRole="header">
          Borrowing
        </Text>
      </View>

      {model.isError ? (
        // A failed fetch is not a settled "nothing on loan" — and the second
        // line matters more than the first: the fear on a failed borrow
        // screen is that you have silently declined someone.
        <ErrorState
          title="Couldn’t load your requests"
          body="Nothing has been lost or answered on your behalf."
          retryTitle="Try again"
          onRetry={model.refetch}
        />
      ) : model.isLoading ? (
        <BorrowSkeleton />
      ) : empty ? (
        model.hasFriends ? (
          // Merely quiet: there is nothing to fix, so nothing is offered.
          <View className="flex-1 items-center justify-center px-8">
            <Text variant="title" trim className="text-center" accessibilityRole="header">
              Nothing is out on loan
            </Text>
            <Text variant="callout" className="mt-2.5 text-center" style={{ color: theme.muted }}>
              Ask from a friend’s closet whenever you need something.
            </Text>
          </View>
        ) : (
          // Borrowing needs people before it needs pieces, so this one routes
          // to Friends. The dashed well is the not-yet shape, not content.
          <View className="flex-1 items-center justify-center px-8">
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              // Spacing lives here, not on the trimmed title below: `trim` sets
              // its own negative margins via the style prop, and a stacked
              // `mt-*` utility resolves against them by merge order, not intent.
              className="mb-5 w-full bg-tray"
              style={{
                height: 120,
                borderRadius: 14,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: theme.rule,
              }}
            />
            <Text variant="title" trim className="text-center" accessibilityRole="header">
              Nothing is out on loan
            </Text>
            <Text variant="callout" className="mt-2.5 text-center" style={{ color: theme.muted }}>
              Borrowing runs on friends. Add a few and the pieces they’ve marked borrowable show up
              in their closets.
            </Text>
            <Button
              title="Find friends"
              variant="ink"
              haptic
              className="mt-6 px-6"
              onPress={() => router.push('/friends')}
            />
          </View>
        )
      ) : (
        <ScrollView
          contentContainerClassName="px-gutter pb-24"
          refreshControl={
            <RefreshControl
              refreshing={model.isRefetching}
              onRefresh={model.refetch}
              tintColor={theme.muted}
            />
          }>
          {section('Asked of you', model.incoming, 'No one has asked you for anything.', true)}
          {section('You asked', model.outgoing, 'You haven’t asked for anything.', false)}

          <Text variant="note" className="mt-6">
            Anything settled disappears from here after a week. Cinch keeps no ledger.
          </Text>
        </ScrollView>
      )}

      {sheetThread ? (
        <BorrowLendSheet
          visible={sheetOpen}
          itemName={(() => {
            const piece = garmentNoun(sheetThread.item);
            return piece.charAt(0).toUpperCase() + piece.slice(1);
          })()}
          wears={wears}
          counterpartFirstName={firstName(sheetThread.counterpart)}
          imageUri={resolve(sheetThread.item?.thumbPath, sheetThread.item?.cutoutPath)}
          onConfirm={() => {
            // Confirm commits and the sheet drops at once — a failure comes
            // back through the actions' Retry toast, not an in-sheet spinner.
            lend(sheetThread);
            setSheetOpen(false);
          }}
          onDismiss={() => setSheetOpen(false)}
        />
      ) : null}

      {shownToast ? (
        <Toast
          message={shownToast.message}
          actionLabel={shownToast.actionLabel}
          onAction={shownToast.onAction}
          onDismiss={dismissToast}
          visible={toast !== null}
        />
      ) : null}
    </SafeAreaView>
  );
}
