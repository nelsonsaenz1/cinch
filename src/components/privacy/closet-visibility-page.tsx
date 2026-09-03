import { View } from 'react-native';

import { PrivacyPage } from '@/components/privacy/privacy-page';
import { Card, Disclosure, Rule, SectionHeader, Text } from '@/components/ui';
import { ToggleRow } from '@/components/ui/settled-row';
import {
  VISIBILITY_LABELS,
  VISIBILITY_LEAD,
  VISIBILITY_OVERRIDDEN_REASON,
  VISIBILITY_TITLE,
  visibilityState,
} from '@/features/privacy/visibility-copy';
import {
  WORN_SHARING_FOOTER,
  WORN_SHARING_LABEL,
  WORN_SHARING_OVERRIDDEN_REASON,
  WORN_SHARING_SCOPE,
  WORN_SHARING_SECTION,
  wornSharingState,
} from '@/features/privacy/worn-sharing-copy';
import type { ClosetVisibility, VisibilityFlag } from '@/features/privacy/use-closet-visibility';
import { useTheme } from '@/theme/tokens';

/**
 * What friends can see — the control for the four flags that shipped without one.
 *
 * ── WHY THE STAT SWITCHES GO INERT ────────────────────────────────────────
 *
 * `friend_closet_meta` nulls all three stats behind
 * `case when p.closet_hidden or p.stat_*_hidden`, so with the closet hidden
 * the three below already answer null however they are set. Leaving them live
 * would let somebody switch "Times worn" on and change nothing — a control
 * that lies about its own effect. `ToggleRow`'s `overridden` is the state
 * NT-02 built for exactly this shape, and it keeps the label at full strength
 * while the track goes tray, because WCAG's exemption for a disabled control
 * has never covered the prose beside one.
 *
 * The remembered value is still drawn while overridden. Someone who hides the
 * whole closet and shows it again should find their stat choices where they
 * left them, not silently reset — the same promise the notification
 * preferences make.
 *
 * ── DS-07 LIVES HERE, NOT ON A ROUTE OF ITS OWN ───────────────────────────
 *
 * "Share what you wear" is the switch the whole Daily Social unit depends on,
 * and it is a row on this page rather than a screen: it answers the same
 * question the four above it answer — what do the friends I follow back get to
 * see — and a second privacy screen is how two privacy screens start
 * disagreeing about who "friends" means.
 *
 * It defaults OFF, which is the opposite of the four above it, and
 * deliberately: those four preserved behaviour that already shipped, this one
 * opens a path that never existed, and new exposure starts closed. It goes
 * inert with the closet for the same reason the three stats do —
 * `friend_worn_outfits` carries `not p.closet_hidden`, so with the closet
 * hidden no look crosses however this is set, and an operable switch there
 * would be a control that lies about its own effect.
 */
export function ClosetVisibilityPage({
  visibility,
  wornSharing,
  onChange,
  onWornSharingChange,
  onBack,
}: {
  visibility: ClosetVisibility;
  /** DS-07. `profiles.worn_outfits_shared_since` is non-null. Default false. */
  wornSharing: boolean;
  onChange: (flag: VisibilityFlag, visible: boolean) => void;
  onWornSharingChange: (shared: boolean) => void;
  onBack: () => void;
}) {
  const { ghost, ink, muted } = useTheme();
  const closetHidden = !visibility.closetVisible;

  const stats: VisibilityFlag[] = ['piecesVisible', 'wearsVisible', 'costPerWearVisible'];

  return (
    <PrivacyPage parent="Privacy and data" title={VISIBILITY_TITLE} intro={VISIBILITY_LEAD} onBack={onBack}>
      <View className="mx-gutter mt-6">
        <Card>
          <ToggleRow
            label={VISIBILITY_LABELS.closetVisible}
            state={visibilityState('closetVisible', visibility.closetVisible)}
            value={visibility.closetVisible}
            onValueChange={(next) => onChange('closetVisible', next)}
          />
        </Card>
      </View>

      <View className="mx-gutter mt-4">
        <Card>
          {stats.map((flag, index) => (
            <View key={flag}>
              {index > 0 ? <Rule tone="hairline" /> : null}
              <ToggleRow
                label={VISIBILITY_LABELS[flag]}
                state={visibilityState(flag, visibility[flag])}
                value={visibility[flag]}
                onValueChange={(next) => onChange(flag, next)}
                overridden={closetHidden}
                overriddenReason={VISIBILITY_OVERRIDDEN_REASON}
              />
            </View>
          ))}
        </Card>
      </View>

      <View className="mx-gutter mt-8">
        {/* Its own group, because it is not the closet. The four above govern
            what a friend finds when they open your closet; this governs
            something that leaves on its own and comes to them. */}
        <SectionHeader title={WORN_SHARING_SECTION} className="mb-2.5" />
        <Card>
          <ToggleRow
            label={WORN_SHARING_LABEL}
            state={wornSharingState(wornSharing)}
            value={wornSharing}
            onValueChange={onWornSharingChange}
            overridden={closetHidden}
            overriddenReason={WORN_SHARING_OVERRIDDEN_REASON}
          />
        </Card>
        {/* P2 #24 — the switch label and its one-line consequence
            (`ToggleRow` above) already say what turning this on does. The
            five-fact breakdown of who, when and what is detail for someone who
            wants it before they decide, not a paragraph everyone has to read
            past. Collapsed behind "Learn more"; nothing in it changed. */}
        <Disclosure
          label="Learn more"
          variant="link"
          className="mt-5"
          summary="Who sees it, when it starts, and what stays out.">
          {/* DS-07'S SCOPE LIST — five headed facts, not one paragraph.

              Somebody standing at a privacy switch is looking for the one thing
              they are worried about, and five facts running together is where a
              reader decides they have understood and stops. Each title is the
              question in three words; the sentence under it is the answer.

              `callout` at 16px for the bodies, not `note` at 13, and set in muted
              rather than faint: these are sentences about what the app does with
              somebody's data, and the group's floor is that no such sentence is
              set below 15pt. Same treatment `PrivacyPage` gives its own intro.
              Tone is inline — two `text-*` utilities on one element are resolved
              by stylesheet order, not by intent.

              The dot is `aria-hidden` furniture and the pair is one accessible
              element: a reader should hear "Sharing starts now. Turning this on
              starts from the moment you tap it." as one fact, not as a bullet
              followed by a sentence. */}
          <View className="gap-4">
            {WORN_SHARING_SCOPE.map((scope) => (
              <View key={scope.title} className="flex-row gap-2.5" accessible>
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  className="mt-2 h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: ghost }}
                />
                <View className="min-w-0 flex-1">
                  <Text variant="label" style={{ color: ink }}>
                    {scope.title}
                  </Text>
                  <Text variant="callout" className="mt-1" style={{ color: muted }}>
                    {scope.body}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* The way back out, and how soon — §6's "revocation is immediate",
              which had no sentence anywhere a person could read it. Everything
              above describes turning sharing ON; this is what makes trying it a
              small decision. */}
          <Text variant="callout" className="mt-5" style={{ color: muted }}>
            {WORN_SHARING_FOOTER}
          </Text>
        </Disclosure>
      </View>
    </PrivacyPage>
  );
}
