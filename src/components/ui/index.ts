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
export { EditorialFrame } from '@/components/ui/editorial-frame';
export { EmptyState, type EmptyStateProps } from '@/components/ui/empty-state';
export { ErrorState, type ErrorStateProps } from '@/components/ui/error-state';
export { GHOSTED_RAIL_HEIGHT, GhostedRail } from '@/components/ui/ghosted-rail';
export {
  KeyboardAvoidingScreen,
  KeyboardAwareScrollView,
} from '@/components/ui/keyboard-aware-scroll-view';
export { Notice, type NoticeProps } from '@/components/ui/notice';
export { PlateTile } from '@/components/ui/plate-tile';
export { Rule } from '@/components/ui/rule';
export { SearchField, type SearchFieldProps } from '@/components/ui/search-field';
export { BackButton, ScreenHeader, type ScreenHeaderProps } from '@/components/ui/screen-header';
export { SectionHeader, type SectionHeaderProps } from '@/components/ui/section-header';
export { SettingsRow } from '@/components/ui/settings-row';
export { ProgressTrack, type ProgressTrackProps } from '@/components/ui/progress-track';
export {
  ClosetGridSkeleton,
  ListSkeleton,
  PlateSkeleton,
  RowSkeleton,
  Skeleton,
  SkeletonLead,
  Spinner,
  type SkeletonProps,
} from '@/components/ui/skeleton';
export { Swatch, type SwatchProps } from '@/components/ui/swatch';
export { Toast, type ToastProps } from '@/components/ui/toast';
export { Text, type TextProps } from '@/components/ui/text';
