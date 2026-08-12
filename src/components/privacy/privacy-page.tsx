import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton, Text } from '@/components/ui';
import { useTheme } from '@/theme/tokens';

/**
 * The frame all six Privacy & data screens are drawn in.
 *
 * Atlas 38 gives every frame the same two-tier head: a nav row naming where
 * back goes, then the page's own serif title with a sentence under it. Built
 * once here because six copies of a header is how a header drifts — the same
 * argument `ui/screen-header.tsx` makes about the nine hand-copied back discs.
 *
 * `ScreenHeader` itself is not used: it carries its own `pt-2`, and this stack
 * is pushed from the Profile form sheet, so the row has to clear the sheet
 * grabber at `pt-5`. Two `pt-*` utilities on one element are resolved by their
 * order in the generated stylesheet rather than by intent, so the row is
 * written out rather than overridden.
 */
export function PrivacyPage({
  /** Where the chevron goes, set in the colophon voice — "Settings". */
  parent,
  title,
  intro,
  onBack,
  children,
}: {
  parent: string;
  title: string;
  intro?: string;
  onBack: () => void;
  children: ReactNode;
}) {
  const { muted } = useTheme();

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="flex-row items-center px-gutter pb-1 pt-5">
        <BackButton onPress={onBack} label={`Back to ${parent}`} />
        <Text variant="colophon" className="flex-1 text-center">
          {parent}
        </Text>
        {/* 36pt of nothing, so the centred colophon is centred on the page. */}
        <View className="h-9 w-9" />
      </View>

      <ScrollView contentContainerClassName="pb-24 pt-4">
        <View className="px-gutter">
          <Text variant="title" trim accessibilityRole="header">
            {title}
          </Text>
          {intro ? (
            // `mt-5` reads large for an 8pt gap because `trim` has already
            // pulled 9pt off the title's bottom edge — the two sum, they do
            // not collapse (Yoga has no margin collapsing). Writing the
            // designed gap here would close it to almost nothing.
            //
            // `callout` (16px) rather than `note` (13px): every one of these
            // intros is a sentence about what the app does with somebody's
            // data, and the group's floor is that no such sentence is set
            // below 15 pt. Tone is inline — two `text-*` utilities on one
            // element are resolved by stylesheet order, not by intent.
            <Text variant="callout" className="mt-5" style={{ color: muted }}>
              {intro}
            </Text>
          ) : null}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
