import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import Animated, { LinearTransition, useReducedMotion } from 'react-native-reanimated';

import { PrivacyPage } from '@/components/privacy/privacy-page';
import { Rule, SectionHeader, Text } from '@/components/ui';
import { motion } from '@/theme/metrics';
import { SHOPPABLE_DETAIL, SHOPPABLE_LABEL } from '@/features/commerce/copy';
import {
  DELETE_TOPIC_GIST,
  EXPORT_TOPIC_GIST,
  INDEX_INTRO,
  LINK_HANDLING_ROW,
  PRIVACY_TOPICS,
  SELLS_NOTHING_FOOTER,
  type PrivacyTopic,
} from '@/features/privacy/copy';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * PV-01 / PV-02 — the disclosure as an index.
 *
 * ── What audit 75 and 76 actually asked for ────────────────────────────────
 *
 * "Summary rows with expandable detail; the collapsed index names all nine
 * categories" and "full detail stays in-app at 17 pt". The page this replaces
 * was one continuous card of full paragraphs: correct in substance, and a wall.
 * A reader arriving to answer one question ("do you send my calendar?") had to
 * read three unrelated disclosures to find out whether a fourth existed.
 *
 * So every category is now a titled row with a one-line gist, and the gist is a
 * summary of the paragraph beneath it rather than a claim of its own — the
 * bodies are unchanged and still carry their citations in
 * `features/privacy/copy.ts`. Nothing moved to a web page and nothing was
 * summarised away: the full text is one tap down, in place, at `body` (17px).
 *
 * ── Rules rather than cards ────────────────────────────────────────────────
 *
 * The atlas's reason, and it is the right one: nine cards read as nine
 * competing objects. A hairline between rows reads as one list.
 *
 * ── Three rows keep their chevron ──────────────────────────────────────────
 *
 * AI partners, export and deletion are pages, not paragraphs — one carries the
 * withdrawal control, one a request button and a history, one a typed
 * confirmation. Expanding a destructive action into a disclosure row would be
 * the wrong shape. They gain the gist and keep the push.
 *
 * ── Not drawn, and kept ────────────────────────────────────────────────────
 *
 * The "Let friends find where your pieces are from" switch (commerce-directive
 * C-05) is not in PV-01. It is a live consent control that ships, and an atlas
 * that does not draw a control is not an instruction to delete it.
 *
 * Purely presentational: props in, callbacks out, expansion held locally.
 * `dev-w3-g4-pv-01`/`-pv-02` render this exact component from fixtures.
 */

/** The chevron's two positions. `chevron.down` when the row is open. */
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

/**
 * One row of the index that opens in place.
 *
 * The title is the only Medium thing in it. The gist is regular at `callout`
 * (16px) rather than `note` (13px) — the group's floor is "no legal sentence
 * below 15 pt", and a gist that summarises a disclosure is a legal sentence.
 * `muted`, never `faint`: #8A8578 is 3.52:1 on canvas and fails AA.
 */
function TopicRow({
  topic,
  open,
  first,
  reduceMotion,
  onToggle,
}: {
  topic: PrivacyTopic;
  open: boolean;
  first: boolean;
  reduceMotion: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();

  return (
    <Animated.View
      layout={reduceMotion ? undefined : LinearTransition.duration(motion.duration.base)}
      className={first ? '' : 'border-t border-hairline'}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={topic.title}
        accessibilityHint={topic.gist}
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={{ minHeight: MIN_TAP_TARGET }}
        className="flex-row items-center gap-3 px-gutter py-3.5 active:opacity-60">
        <View className="flex-1">
          <Text variant="body">
            {topic.title}
          </Text>
          {/* Inline tone, never a second `text-*` class: two colour utilities
              on one element are resolved by stylesheet order, not by intent. */}
          <Text variant="callout" className="mt-0.5" style={{ color: theme.muted }}>
            {topic.gist}
          </Text>
        </View>
        <Chevron open={open} tint={theme.muted} />
      </Pressable>

      {open ? (
        <View className="gap-4 px-gutter pb-5">
          {topic.body ? (
            <Text variant="body" style={{ color: theme.muted }}>
              {topic.body}
            </Text>
          ) : null}
          {topic.sections?.map((section) => (
            <View key={section.title}>
              <Text variant="body">
                {section.title}
              </Text>
              <Text variant="body" className="mt-1" style={{ color: theme.muted }}>
                {section.body}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

/**
 * One row of the index that opens a page. Same anatomy minus the expansion —
 * title, gist, chevron, 44pt floor.
 */
function PageRow({
  title,
  gist,
  first,
  onPress,
}: {
  title: string;
  gist: string;
  first: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={gist}
      onPress={onPress}
      style={{ minHeight: MIN_TAP_TARGET }}
      className={`flex-row items-center gap-3 px-gutter py-3.5 active:opacity-60 ${
        first ? '' : 'border-t border-hairline'
      }`}>
      <View className="flex-1">
        <Text variant="body">
          {title}
        </Text>
        <Text variant="callout" className="mt-0.5" style={{ color: theme.muted }}>
          {gist}
        </Text>
      </View>
      <SymbolView
        name="chevron.right"
        size={13}
        tintColor={theme.muted}
        resizeMode="scaleAspectFit"
      />
    </Pressable>
  );
}

/**
 * The one real toggle on the page — commerce-directive.md C-05. Same anatomy as
 * a row minus the chevron, plus a `Switch`, plus the word: "Toggle state is
 * printed as On or Off beside the switch, never left to the switch alone."
 */
function ToggleRow({
  title,
  detail,
  value,
  onValueChange,
  disabled = false,
}: {
  title: string;
  detail: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      style={{ minHeight: MIN_TAP_TARGET }}
      className="flex-row items-center gap-3 px-gutter py-3.5">
      <View className="flex-1">
        <Text variant="body">
          {title}
        </Text>
        <Text variant="callout" className="mt-0.5" style={{ color: theme.muted }}>
          {value ? 'On' : 'Off'} · {detail}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: theme.rule, true: theme.ink }}
        accessibilityLabel={title}
        accessibilityHint={detail}
      />
    </View>
  );
}

export type PrivacyIndexPageProps = {
  /** "Given 12 March 2026" / "Not given" — the real state, never a placeholder. */
  consentDetail: string;
  /**
   * Whether the binary can attribute a cold install to an invite.
   *
   * The Link handling row renders if and only if this is true. The attribution
   * SDK's stable release predates the New Architecture and its New-Arch rewrite
   * pins `react-native <0.85` against this app's 0.86, so it may never land
   * (`src/features/invite/native.ts:33-45`) — and disclosing something the app
   * does not do is exactly as wrong as concealing something it does. Same gate
   * Profile puts on its Notifications row with `NOTIFICATION_SETTINGS_AVAILABLE`.
   */
  deferredLinksAvailable: boolean;
  /** C-05 — `profiles.shoppable`'s current value. */
  shoppable: boolean;
  onToggleShoppable: (value: boolean) => void;
  /** True only while the write itself is in flight — the read never blocks the switch. */
  shoppablePending?: boolean;
  /**
   * Which topic is open on first render, by title. `__DEV__` fixtures only —
   * PV-02 is PV-01 with one row open, and a fixture that had to tap to reach it
   * would be a fixture of the tap.
   */
  initialOpen?: string;
  onBack: () => void;
  onOpenConsent: () => void;
  onOpenExport: () => void;
  onOpenDelete: () => void;
};

export function PrivacyIndexPage({
  consentDetail,
  deferredLinksAvailable,
  shoppable,
  onToggleShoppable,
  shoppablePending = false,
  initialOpen,
  onBack,
  onOpenConsent,
  onOpenExport,
  onOpenDelete,
}: PrivacyIndexPageProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState<string | null>(initialOpen ?? null);

  const topics = deferredLinksAvailable
    ? [...PRIVACY_TOPICS, LINK_HANDLING_ROW]
    : PRIVACY_TOPICS;

  // One open at a time, and the neighbours keep their position — the atlas's
  // "expansion happens in place; siblings collapse to their titles". The height
  // change is Reanimated's `LinearTransition` at the base duration rather than
  // `LayoutAnimation`, which nothing else in this app uses and which the New
  // Architecture only partly honours. Under Reduce Motion the layout prop is
  // dropped entirely, so the row becomes an instant height change.
  const toggle = (title: string) => setOpen((current) => (current === title ? null : title));

  return (
    <PrivacyPage parent="Settings" title="Privacy and data" intro={INDEX_INTRO} onBack={onBack}>
      <View className="mt-6">
        {topics.map((topic, index) => (
          <TopicRow
            key={topic.title}
            topic={topic}
            open={open === topic.title}
            first={index === 0}
            reduceMotion={reduceMotion}
            onToggle={() => toggle(topic.title)}
          />
        ))}

        {/* The live one. Its gist is the consent record and the ledger, so the
            most consequential setting on the page is legible without opening
            anything — the atlas's own reason for putting state in this row. */}
        <PageRow
          title="AI partners"
          gist={consentDetail}
          first={false}
          onPress={onOpenConsent}
        />
        <PageRow
          title="Take your data with you"
          gist={EXPORT_TOPIC_GIST}
          first={false}
          onPress={onOpenExport}
        />
        {/* Last, and in the same weight as the rest: it is a section, not a red
            button. The oxblood is spent inside the page it opens. */}
        <PageRow
          title="Delete your closet and account"
          gist={DELETE_TOPIC_GIST}
          first={false}
          onPress={onOpenDelete}
        />
      </View>

      <SectionHeader title="Selling your pieces" className="mb-1 mt-8 px-gutter" />
      <View className="border-t border-hairline">
        <ToggleRow
          title={SHOPPABLE_LABEL}
          detail={SHOPPABLE_DETAIL}
          value={shoppable}
          onValueChange={onToggleShoppable}
          disabled={shoppablePending}
        />
      </View>

      <View className="mt-8 px-gutter">
        <Rule />
        <Text variant="callout" className="mt-4" style={{ color: theme.muted }}>
          {SELLS_NOTHING_FOOTER}
        </Text>
      </View>
    </PrivacyPage>
  );
}
