import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import { boundedErrorCopy, type BoundedErrorCopy, type BoundedState } from '@/lib/bounded-load';

/**
 * THE ROUTE-LEVEL HALF OF THE BOUNDED CONTRACT.
 *
 * `useBoundedLoad` decides which of the five states a route is in; this draws
 * four of them the same way on every screen that has one, so that a wait, a
 * failure, a timeout and an absence are recognisable as the same four things
 * wherever the reader meets them.
 *
 * ── THE HEADER IS NOT DECORATION ──────────────────────────────────────────
 *
 * The audit's finding #38 is that "several error states are full-screen traps
 * with no back, retry, or safe exit" — a sentence in the middle of an
 * otherwise blank screen, on a route pushed from somewhere, with no way to get
 * back to where that somewhere was. So the header is REQUIRED here rather than
 * optional: `onBack` has no default and cannot be omitted. A route-level state
 * that cannot be left is the defect this component exists to make unwritable.
 *
 * The retry is separate and genuinely optional — some route-level failures are
 * not re-readable (an invalid parameter, a walkthrough with no session id) and
 * a button that re-runs a read which cannot succeed is worse than no button.
 * The way out is what is mandatory.
 *
 * ── CONTENT PASSES STRAIGHT THROUGH ───────────────────────────────────────
 *
 * On `content` this renders `children` with no wrapper at all. Screens own
 * their own chrome — a scroll view, a hero, a sticky footer measured against
 * the tab bar — and wrapping that in a second SafeAreaView would inset it
 * twice. This component is the four states a screen does NOT want to design
 * itself; the fifth is entirely the screen's.
 */
export type RouteStateProps = {
  state: BoundedState;

  /** The small-caps colophon in the header — "Event", "Board", "Your day". */
  title?: string;
  /**
   * Where the back button goes. Required: see the docblock. A route that can
   * be deep-linked into should pass a fallback (`router.canGoBack() ?
   * router.back() : router.replace(…)`) rather than relying on a history that
   * may be one entry long.
   */
  onBack: () => void;
  backLabel?: string;

  /** Drawn for `skeleton` — the screen's own shaped placeholder. */
  skeleton?: React.ReactNode;
  /** Drawn for `empty`. An `EmptyState`, usually; anything, if the screen has a hero. */
  empty?: React.ReactNode;

  /**
   * The screen's own wording for a genuine failure. Replaced wholesale on
   * `timeout`, where "couldn’t reach it" would be a claim nobody can make yet.
   */
  errorCopy?: BoundedErrorCopy;
  /** Absent for a failure that cannot be re-read. Pass `load.retry`, not `refetch`. */
  onRetry?: () => void;
  retrying?: boolean;

  children?: React.ReactNode;
};

export function RouteState({
  state,
  title,
  onBack,
  backLabel,
  skeleton,
  empty,
  errorCopy,
  onRetry,
  retrying = false,
  children,
}: RouteStateProps) {
  if (state === 'content') return <>{children}</>;

  const copy = boundedErrorCopy(state, errorCopy);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader align="leading" title={title} onBack={onBack} backLabel={backLabel} />

      {copy ? (
        <ErrorState
          kicker={copy.kicker}
          title={copy.title}
          body={copy.body}
          retryTitle={copy.retryTitle}
          onRetry={onRetry}
          retrying={retrying}
        />
      ) : state === 'empty' ? (
        (empty ?? (
          <EmptyState
            symbol="tray"
            title="There’s nothing here"
            body="Nothing has been added to this yet."
          />
        ))
      ) : (
        // `skeleton`. A screen with no shaped placeholder of its own gets an
        // empty flexed box rather than a spinner: the bound is what makes the
        // wait safe, and a generic graphic would only make it prettier.
        <View className="flex-1">{skeleton}</View>
      )}
    </SafeAreaView>
  );
}
