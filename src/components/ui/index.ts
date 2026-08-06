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
export { Chip, type ChipProps } from '@/components/ui/chip';
export { EmptyState, type EmptyStateProps } from '@/components/ui/empty-state';
export { ErrorState, type ErrorStateProps } from '@/components/ui/error-state';
export { Rule } from '@/components/ui/rule';
export { BackButton, ScreenHeader, type ScreenHeaderProps } from '@/components/ui/screen-header';
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
export { Text, type TextProps } from '@/components/ui/text';
