/**
 * The Daily Social presentational kit, in one import path.
 *
 * Everything here takes props and draws. Nothing fetches, signs a URL, writes a
 * reaction or navigates — the surface that composes these owns all four, and
 * the split is what lets the six states be tested without a renderer or a
 * network.
 */

export { LookCard, type LookCardPiece, type LookCardProps } from './look-card';
export { LookCollage, type LookCollagePiece } from './look-collage';
export { collageRows, lookNameTrimmed } from './look-card-spec';
export { DailyLookSkeleton } from './look-skeleton';
export { ReactionRow, type ReactionRowProps } from './reaction-row';
export {
  DAILY_REACTION_GAP,
  DAILY_REACTION_MIN_HEIGHT,
  dailyReactionsStacked,
  dailyReactionVisual,
  type DailyReactionVisual,
} from './reaction-spec';
export {
  CaughtUpLine,
  DailyOfflineState,
  NobodySharingState,
  QuietDayState,
} from './state-screens';
