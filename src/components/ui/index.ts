/**
 * The shared primitives, in one import path.
 *
 * `import { Skeleton, ErrorState } from '@/components/ui'` — the per-file paths
 * (`@/components/ui/text` and friends) keep working and every existing import
 * is left alone, but a screen adding a loading and an error branch should not
 * need to know which of six files each lives in.
 */

export { Avatar, initialsFor, type AvatarProps } from '@/components/ui/avatar';
export { Button, type ButtonProps } from '@/components/ui/button';
export { Card, type CardProps } from '@/components/ui/card';
export { Chip, type ChipProps } from '@/components/ui/chip';
export { DoorCondition, DoorPlate, type DoorPlateProps } from '@/components/ui/door-plate';
export { EditorialFrame } from '@/components/ui/editorial-frame';
export { EmptyState, type EmptyStateProps } from '@/components/ui/empty-state';
export { ErrorState, type ErrorStateProps } from '@/components/ui/error-state';
// UX-08's classifier. Not a component — the shared rule three lanes answer their
// `Alert.alert` inventory against. See the file.
export {
  feedbackRationale,
  feedbackSurface,
  type FeedbackCase,
  type FeedbackSurface,
} from '@/components/ui/feedback';
export { GHOSTED_RAIL_HEIGHT, GhostedRail } from '@/components/ui/ghosted-rail';
export {
  KeyboardAvoidingScreen,
  KeyboardAwareScrollView,
} from '@/components/ui/keyboard-aware-scroll-view';
export { Notice, type NoticeProps } from '@/components/ui/notice';
export { NoticeBand, type NoticeBandAction } from '@/components/ui/notice-band';
export { PlateTile } from '@/components/ui/plate-tile';
// UX-07's shared press. `usePressFeedback` is the hook it wraps and stays
// exported for the controls that already compose it by hand.
export {
  PressableSurface,
  type PressableSurfaceProps,
} from '@/components/ui/pressable-surface';
export { Rule } from '@/components/ui/rule';
export { SearchField, type SearchFieldProps } from '@/components/ui/search-field';
export { BackButton, ScreenHeader, type ScreenHeaderProps } from '@/components/ui/screen-header';
export { SectionHeader, type SectionHeaderProps } from '@/components/ui/section-header';
export { SettingsRow } from '@/components/ui/settings-row';
// `ProgressTrack` was exported here until Wave 3. It is gone, not moved: the
// constitution's refusal is "Progress is a count, never a bar or percentage",
// and by the time it was retired every render call site had already been
// rewritten as a count by the lane that owned it. The comments left behind in
// `capture.tsx`, `queue-count.ts`, `insight-card.tsx` and `dev-w3-g3-cp-03.tsx`
// are the record of why, and stay.
//
// `PlateSkeleton` left this barrel at the same time. `components/today/
// plate-skeleton.tsx` is the plate's wait state now, drawn to the current
// geometry; the one here still reserved the retired 5:4 garment well, so
// keeping it exported meant a screen could reach for a placeholder that
// reflows the moment the real plate lands.
export {
  ClosetGridSkeleton,
  ListSkeleton,
  RowSkeleton,
  Skeleton,
  SkeletonLead,
  Spinner,
  type SkeletonProps,
} from '@/components/ui/skeleton';
export { Swatch, type SwatchProps } from '@/components/ui/swatch';
export { Toast, type ToastProps } from '@/components/ui/toast';
// The host is mounted once in app/_layout.tsx; `useToast()` is how a tab-level
// surface raises one. A sheet still renders `Toast` itself — see toast-host.tsx.
export { ToastHost, useToast, type ShowToastOptions } from '@/components/ui/toast-host';
export { Text, type TextProps } from '@/components/ui/text';
export { usePressFeedback } from '@/components/ui/use-press-feedback';
