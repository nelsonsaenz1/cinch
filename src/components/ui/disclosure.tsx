import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import Animated, { LinearTransition, useReducedMotion } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { motion } from '@/theme/metrics';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * Founder's rule #3, given a shape: short title, one-line consequence, and
 * optional detail — the detail lives here, closed until asked for.
 *
 * `privacy-index-page.tsx`'s `TopicRow` drew this exact anatomy first (title,
 * gist, a chevron, `LinearTransition` on the outer view so the row's own
 * height change is what animates rather than a second, competing spring) but
 * kept it private to one page's nine categories. The 2026-09-02 copy-reduction
 * pass needed the same shape on six more screens — AI consent's disclosure
 * record, a switch's long explanation, Delete Account's implementation detail,
 * Pinterest's OAuth paragraph, Write to Us's process notes, a search sheet's
 * catalogue mechanics — so this is that anatomy, promoted and generalised
 * rather than copied a sixth time.
 *
 * ── Two shapes, one mechanism ────────────────────────────────────────────
 *
 * `variant="row"` (the default) is `TopicRow`'s own look: a Medium `label`,
 * a `summary` line under it in `muted`, a trailing chevron, 44pt tall. For a
 * titled disclosure sitting in a list of its own kind — AI consent's facts,
 * a settings category.
 *
 * `variant="link"` is the compact form — no title row, no chevron column,
 * just `label` set in the accent colour, for "Learn more" sitting under a
 * paragraph that has already said the one-line consequence out loud.
 *
 * Both are the same state machine: closed by default, `accessibilityRole=
 * "button"`, `accessibilityState={{ expanded }}` announced to VoiceOver, and
 * the reveal riding `Animated.View`'s `layout` prop rather than a height
 * spring built by hand — the same choice `TopicRow` made, for the same
 * reason: New Architecture only partly honours `LayoutAnimation`, and
 * `LinearTransition` drops to an instant cut under Reduce Motion for free.
 *
 * ── Controlled or not ────────────────────────────────────────────────────
 *
 * Defaults to owning its own `open` state — the common case, a paragraph that
 * nobody else needs to know is open. Pass `open`/`onToggle` for the rarer case
 * of a parent that has to coordinate more than one (e.g. only one row open at
 * a time, as `PrivacyIndexPage` still does with its own local `TopicRow`).
 *
 * ── The shape `pressable-shape.test.ts` bans ────────────────────────────
 *
 * The `Pressable` here carries its own `className` (`active:opacity-60` and
 * layout classes), so it keeps its press even though an `Animated.View` sits
 * one level up as the outer wrapper — that wrapper is never the `Pressable`'s
 * immediate, bodyless child, which is the shape the test forbids.
 */
export type DisclosureProps = {
  /** The row's title (`variant="row"`) or the link text (`variant="link"`), e.g. "Learn more". */
  label: string;
  /** The one-line consequence, shown while closed. `variant="row"` only — a link states its own reason for existing. */
  summary?: string;
  children: React.ReactNode;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  defaultOpen?: boolean;
  variant?: 'row' | 'link';
  /** Suppresses the top hairline for the first row in a bordered list. `variant="row"` only. */
  first?: boolean;
  /** Adds a top hairline and standard row padding, for sitting inside a plain list. `variant="row"` only. Defaults to true. */
  bordered?: boolean;
  className?: string;
};

function Chevron({ open, tint }: { open: boolean; tint: string }) {
  return (
    <SymbolView
      name={open ? 'chevron.down' : 'chevron.right'}
      size={13}
      tintColor={tint}
      resizeMode="scaleAspectFit"
    />
  );
}

export function Disclosure({
  label,
  summary,
  children,
  open: controlledOpen,
  onToggle,
  defaultOpen = false,
  variant = 'row',
  first = false,
  bordered = true,
  className = '',
}: DisclosureProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const expanded = isControlled ? controlledOpen : internalOpen;

  const toggle = () => {
    const next = !expanded;
    if (!isControlled) setInternalOpen(next);
    onToggle?.(next);
  };

  return (
    <Animated.View
      layout={reduceMotion ? undefined : LinearTransition.duration(motion.duration.base)}
      className={className}>
      {variant === 'row' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={summary}
          accessibilityState={{ expanded }}
          onPress={toggle}
          style={{ minHeight: MIN_TAP_TARGET }}
          className={`flex-row items-center gap-3 py-3.5 active:opacity-60 ${
            bordered && !first ? 'border-t border-hairline' : ''
          }`}>
          <View className="flex-1">
            <Text variant="body">{label}</Text>
            {summary ? (
              <Text variant="callout" className="mt-0.5" style={{ color: theme.muted }}>
                {summary}
              </Text>
            ) : null}
          </View>
          <Chevron open={expanded} tint={theme.muted} />
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ expanded }}
          onPress={toggle}
          style={{ minHeight: MIN_TAP_TARGET }}
          className="flex-row items-center gap-1.5 self-start active:opacity-60">
          <Text variant="callout" style={{ color: theme.accent }}>
            {label}
          </Text>
          <Chevron open={expanded} tint={theme.accent} />
        </Pressable>
      )}

      {expanded ? (
        <View className={variant === 'row' ? 'gap-4 pb-5' : 'mt-1'}>{children}</View>
      ) : null}
    </Animated.View>
  );
}
