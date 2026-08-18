import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActivityRow as LegacyActivityRow } from '@/components/activity/ActivityRow';
import type { AnswerState } from '@/features/activity/answers';
import type {
  ActivityActionId as LegacyActionId,
  ActivityLine as LegacyLine,
} from '@/features/activity/sentence';
import {
  isCollapsibleSection,
  showsSectionHeadings,
  startsCollapsed,
} from '@/features/activity-center/activity-spec';
import { SECTION_HIDE, SECTION_SHOW } from '@/features/activity-center/copy';
import type { MergedSection } from '@/features/activity-center/merge';
import type { ActivityActionId, ActivityLine } from '@/features/activity-center/sentence';
import { useTheme } from '@/theme/tokens';

import {
  ActivityClearAllBar,
  ActivityColophon,
  ActivityEditNote,
  ActivityMasthead,
  ActivitySectionHeading,
} from './activity-parts';
import { ActivityCenterRow, ActivityGroupRow } from './rows';
import { ActivityEmpty, ActivityError, ActivitySkeleton, OfflineBanner } from './state-screens';

/**
 * REDESIGN 28's Activity page, as a pure presentation.
 *
 * Everything that can fail, write or navigate is a prop, which is what lets the
 * eight `dev-av-*` fixtures pose every drawn state against the component the app
 * mounts rather than against a second drawing of it. `app/activity.tsx` is the
 * wiring — queries, mutations, analytics, the seen stamp — and nothing else.
 *
 * ── THE PAGE'S SHAPE ──────────────────────────────────────────────────────
 *
 *   masthead (back tile · Edit/Done · Activity)
 *   [ offline banner | error card | edit note ]
 *   scroll: sections of rows
 *   [ clear all bar, while editing ]
 *   colophon — PINNED, in every state
 *
 * The colophon is outside the `ScrollView` on purpose and it is the structural
 * change the frames insist on most consistently: every one of the fifty-two
 * carries it at the same height off the home indicator, including the ones with
 * nothing above it. See `ActivityColophon` for what that buys.
 */

export type ActivityBodyStatus = 'ready' | 'loading' | 'error';

export type ActivityBodyProps = {
  status: ActivityBodyStatus;
  sections: readonly MergedSection[];
  /** A failed refresh over rows the device already has. Banner, never a hero. */
  cached?: boolean;
  editing?: boolean;
  /** Absent on a page with nothing to edit — see `app/activity.tsx`. */
  onToggleEdit?: () => void;
  onBack: () => void;
  onRetry: () => void;
  lastUpdated?: string | null;
  isRefetching?: boolean;
  onRefresh?: () => void;

  /** Actor id → photograph, for the materialised rows. */
  faceFor?: (line: ActivityLine) => string | null;
  onOpenLine?: (line: ActivityLine, wasGrouped: boolean) => void;
  onAction?: (line: ActivityLine, action: ActivityActionId) => void;
  onRemoveLine?: (line: ActivityLine) => void;
  /** True while an Accept or Decline is in flight. */
  answering?: boolean;

  /** The legacy half of the same list keeps its own component and its own props. */
  legacyFaceFor?: (line: LegacyLine) => string | null;
  legacyStateOf?: (key: string) => AnswerState;
  onLegacyAnswer?: (line: LegacyLine, actionId: LegacyActionId) => void;
  onLegacyNavigate?: (line: LegacyLine, actionId: LegacyActionId) => void;
  onLegacyUndo?: (line: LegacyLine) => void;

  onClearAll?: () => void;
};

const IDLE: AnswerState = { status: 'idle' };

export function ActivityBody({
  status,
  sections,
  cached = false,
  editing = false,
  onToggleEdit,
  onBack,
  onRetry,
  lastUpdated,
  isRefetching = false,
  onRefresh,
  faceFor,
  onOpenLine,
  onAction,
  onRemoveLine,
  answering = false,
  legacyFaceFor,
  legacyStateOf,
  onLegacyAnswer,
  onLegacyNavigate,
  onLegacyUndo,
  onClearAll,
}: ActivityBodyProps) {
  const theme = useTheme();

  /**
   * Which foldable sections the reader has opened.
   *
   * Keyed rather than a boolean, so the state survives a section appearing or
   * disappearing under a refresh — and defaulted through `startsCollapsed`, so
   * "which sections fold" stays one rule in `activity-spec.ts` rather than a
   * condition here and a different one in the heading.
   */
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const isOpen = (key: string) => opened[key] ?? !startsCollapsed(key);

  const headings = showsSectionHeadings(sections.length);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'bottom']}>
      <ActivityMasthead editing={editing} onToggleEdit={onToggleEdit} onBack={onBack} />

      {status === 'error' && !cached ? <ActivityError onRetry={onRetry} lastUpdated={lastUpdated} /> : null}
      {cached ? <OfflineBanner /> : null}
      {editing ? <ActivityEditNote /> : null}

      <ScrollView
        contentContainerClassName="pb-6"
        // `flexGrow`, not `flex`: the empty state centres with `flex-1`, which
        // collapses to nothing inside a content-sized scroll container — and
        // hoisting it out would cost pull-to-refresh on exactly the screen
        // where "try again" matters most.
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={theme.muted} />
          ) : undefined
        }>
        {status === 'loading' ? (
          <ActivitySkeleton />
        ) : sections.length === 0 ? (
          // A failed read with nothing cached has already drawn its card above;
          // the space below it stays empty rather than being filled with a
          // second apology.
          status === 'error' ? null : (
            <ActivityEmpty />
          )
        ) : (
          <View>
            {sections.map((section) => {
              const foldable = isCollapsibleSection(section.key);
              const open = isOpen(section.key);

              return (
                <View key={section.key}>
                  {headings ? (
                    <ActivitySectionHeading
                      title={section.title}
                      className="mb-1.5 mt-6"
                      toggleLabel={foldable ? (open ? SECTION_HIDE : SECTION_SHOW) : undefined}
                      expanded={foldable ? open : undefined}
                      onToggle={
                        foldable
                          ? () => setOpened((was) => ({ ...was, [section.key]: !open }))
                          : undefined
                      }
                    />
                  ) : null}

                  {foldable && !open
                    ? null
                    : section.data.map((entry, i) => {
                        const isLast = i === section.data.length - 1;
                        // The dot answers to the SECTION, not to a second copy
                        // of the unseen rule — see `ActivityCenterRowProps`.
                        const unseen = section.key === 'new';

                        if (entry.kind === 'group') {
                          return (
                            <ActivityGroupRow
                              key={entry.key}
                              entry={entry}
                              avatarFor={faceFor}
                              editing={editing}
                              onOpenLine={onOpenLine ? (line) => onOpenLine(line, true) : undefined}
                              onRemoveLine={onRemoveLine}
                              isLast={isLast}
                            />
                          );
                        }

                        if (entry.kind === 'legacy') {
                          return (
                            <LegacyActivityRow
                              key={entry.key}
                              line={entry.line}
                              avatarUri={legacyFaceFor?.(entry.line) ?? null}
                              unseen={unseen}
                              state={legacyStateOf?.(entry.key) ?? IDLE}
                              onAnswer={(actionId) => onLegacyAnswer?.(entry.line, actionId)}
                              onNavigate={(actionId) => onLegacyNavigate?.(entry.line, actionId)}
                              onUndo={onLegacyUndo ? () => onLegacyUndo(entry.line) : undefined}
                              isLast={isLast}
                            />
                          );
                        }

                        return (
                          <ActivityCenterRow
                            key={entry.key}
                            line={entry.line}
                            avatarUri={faceFor?.(entry.line) ?? null}
                            unseen={unseen}
                            editing={editing}
                            pending={answering}
                            onOpen={onOpenLine ? () => onOpenLine(entry.line, false) : undefined}
                            onAction={onAction ? (action) => onAction(entry.line, action) : undefined}
                            onRemove={onRemoveLine ? () => onRemoveLine(entry.line) : undefined}
                            isLast={isLast}
                          />
                        );
                      })}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {editing && onClearAll ? <ActivityClearAllBar onPress={onClearAll} /> : null}

      <ActivityColophon />
    </SafeAreaView>
  );
}
