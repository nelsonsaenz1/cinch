/**
 * Explore's presentational kit — redesign 17, in one import path.
 *
 * Everything here takes props and draws. Nothing fetches, signs a URL, writes
 * a reaction or navigates; the route composes these and owns all four. That
 * split is what lets the accepted frames be posed as fixtures without a
 * network, and what keeps the privacy rules checkable — a component that
 * cannot read cannot leak.
 */

export { CaughtUpMark, AdditionsEndMark } from './caught-up-mark';
export { CircleErrorBand } from './circle-error-band';
export { CircleSheet, type CircleRow } from './circle-sheet';
export { EarlierRule, NewSinceRule } from './feed-dividers';
export { LookEntryCard, type LookEntryCardProps, type LookEntryPiece } from './look-entry-card';
export { LookFeedSkeleton } from './look-feed-skeleton';
export { LookWell, type LookWellPiece } from './look-well';
export { ReactionFailureStrip } from './reaction-failure-strip';
