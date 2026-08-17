import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';

import { Notice } from '@/components/ui/notice';
import { PressableSurface } from '@/components/ui/pressable-surface';
import { Text } from '@/components/ui/text';
import { SAVE, saveButtonLabel } from '@/features/saved-looks/copy';
import { useTheme } from '@/theme/tokens';

/**
 * OS-02's affordance — the one component this feature contributes to somebody
 * else's screen.
 *
 * ── IT IS NOT A ROUTE, AND IT OWNS NO DATA ─────────────────────────────────
 *
 * §1: "The save affordance itself is owned by the source surfaces. This feature
 * contributes the button component and the sheet; it does not add a route
 * there." So this takes its state as props and emits intent. It holds no query,
 * no mutation and no toast: the surface that mounts it already knows which look
 * is on screen, and a button that fetched its own saved-ness would be a second
 * read of the same fact on every look card in a feed.
 *
 * ── TWO STATES, AND THE SECOND IS NOT A DISABLED FIRST ─────────────────────
 *
 * `saved` renders the "Saved" pill and STAYS PRESSABLE — tapping it opens the
 * existing save. A disabled control at that moment would be the app refusing to
 * take somebody to the thing it just told them they have. It is also why the
 * duplicate case is not an error: the second tap has somewhere useful to go.
 *
 * ── STATE LIVES IN THE LABEL, NOT ONLY IN THE FILL ─────────────────────────
 *
 * §9 asks for it in as many words. The two states differ visually by ground and
 * border, which is invisible to a reader who lands on the control cold, so the
 * spoken label is "Save look" or "Saved, in your looks" and
 * `accessibilityState.selected` carries the toggle besides. The label never
 * appends ", selected" — that would announce the same change twice for anybody
 * who has both.
 *
 * ── THE HAPTICS ARE SPECIFIED, SO THEY ARE PASSED EXPLICITLY ───────────────
 *
 * §8 gives the save `notificationAsync(Success)` and the duplicate
 * `impactAsync(Light)` with "no success chime". In this app's vocabulary those
 * are `haptics.success()` and `haptics.commit()`, and they are fired by the
 * SURFACE at the moment the mutation resolves — not here, because only the
 * caller knows which of the two happened, and the answer comes from the
 * database's unique constraint rather than from the tap.
 *
 * So this component passes no `haptic` at all. A control that ticked on press
 * and then ticked again on the result would be two feedbacks for one act.
 *
 * ── AND A REFUSAL IS PRINTED HERE, NEXT TO THE CONTROL ─────────────────────
 *
 * §10's `blocked(inline error, no write)`. A look that expired between the
 * screen being drawn and the tap landing is refused by the insert policy with
 * nothing written, and the honest place to say so is under the button that was
 * tapped — not in a banner that reads as the app being broken.
 */

export type SaveLookButtonProps = {
  /** Whether this look is already in the reader's saves. The surface knows. */
  saved: boolean;
  /** A save or a lookup is in flight. Reported to VoiceOver as busy. */
  busy?: boolean;
  onSave: () => void;
  /** Where a tap on the "Saved" pill goes. Required: a pill with nowhere to go is a lie. */
  onOpenSaved: () => void;
  /**
   * The inline refusal — set when the last attempt was `no_access`. Cleared by
   * the surface on the next attempt; this component never clears it, because it
   * does not know when the next attempt happened.
   */
  refusal?: string | null;
};

export function SaveLookButton({
  saved,
  busy = false,
  onSave,
  onOpenSaved,
  refusal = null,
}: SaveLookButtonProps) {
  const theme = useTheme();

  return (
    <View className="gap-2">
      <PressableSurface
        onPress={saved ? onOpenSaved : onSave}
        busy={busy}
        accessibilityRole="button"
        accessibilityLabel={saveButtonLabel(saved)}
        accessibilityState={{ selected: saved }}
        accessibilityHint={saved ? 'Opens the saved look' : 'Keeps this look in Saved, just for you'}
        className={
          saved
            ? 'rounded-md border border-accent bg-tray px-5 py-3'
            : 'rounded-md bg-accent px-5 py-3'
        }
        contentStyle={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
        <SymbolView
          name={saved ? 'bookmark.fill' : 'bookmark'}
          size={16}
          tintColor={saved ? theme.accent : theme.canvas}
        />
        <Text variant="label" className={saved ? 'text-accent' : 'text-canvas'}>
          {saved ? SAVE.savedPill : SAVE.cta}
        </Text>
      </PressableSurface>

      {/*
        `Notice` carries `accessibilityLiveRegion="polite"`, which is what makes
        this announced at all: it appears after the control that produced it has
        already been left behind, and a refusal nobody hears is a tap that did
        nothing for no stated reason.
      */}
      {refusal ? <Notice message={refusal} /> : null}
    </View>
  );
}
