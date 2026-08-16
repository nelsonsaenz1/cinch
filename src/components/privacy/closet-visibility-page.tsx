import { View } from 'react-native';

import { PrivacyPage } from '@/components/privacy/privacy-page';
import { Card, Rule } from '@/components/ui';
import { ToggleRow } from '@/components/ui/settled-row';
import {
  VISIBILITY_LABELS,
  VISIBILITY_LEAD,
  VISIBILITY_OVERRIDDEN_REASON,
  VISIBILITY_TITLE,
  visibilityState,
} from '@/features/privacy/visibility-copy';
import type { ClosetVisibility, VisibilityFlag } from '@/features/privacy/use-closet-visibility';

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
 */
export function ClosetVisibilityPage({
  visibility,
  onChange,
  onBack,
}: {
  visibility: ClosetVisibility;
  onChange: (flag: VisibilityFlag, visible: boolean) => void;
  onBack: () => void;
}) {
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
    </PrivacyPage>
  );
}
