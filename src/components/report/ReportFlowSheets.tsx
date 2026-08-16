import { Pressable, TextInput, View } from 'react-native';

import { SheetOverlay } from '@/components/social/FriendOverflowSheet';
import { Button } from '@/components/ui/button';
import { Rule } from '@/components/ui/rule';
import { Text } from '@/components/ui/text';
import type { ReportFlowState } from '@/features/social-graph/use-report-flow';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * RP-02, RP-03, RP-04 — the three sheets `useReportFlow` drives.
 *
 * One mount per screen, at the bottom of whatever renders the overflow menus
 * (RP-01) that call `flow.open(...)`. All three read `flow.target` /
 * `flow.step`; only one is ever visible at a time, and each is its own
 * `SheetOverlay` rather than one shell switching content, so the step
 * transitions cross-fade instead of the same card silently rewriting itself
 * underneath the same backdrop.
 */
export function ReportFlowSheets({ flow }: { flow: ReportFlowState }) {
  return (
    <>
      <ReasonSheet flow={flow} />
      <ConfirmationSheet flow={flow} />
      <BlockOfferSheet flow={flow} />
    </>
  );
}

/** The 19pt disc — a thick ink ring when chosen. */
function Radio({ selected }: { selected: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={{
        width: 19,
        height: 19,
        borderRadius: 9.5,
        borderWidth: selected ? 5 : 1.5,
        // `faint` is banned as text; as a control glyph it clears the 3:1
        // non-text floor `rule` at 12% never could.
        borderColor: selected ? theme.ink : theme.faint,
      }}
    />
  );
}

/** RP-02 — five fixed reasons, single select; Other requires the note. */
function ReasonSheet({ flow }: { flow: ReportFlowState }) {
  const theme = useTheme();
  const visible = flow.target !== null && flow.step === 'reason';

  return (
    <SheetOverlay visible={visible} onClose={flow.submitting ? () => undefined : flow.close}>
      {visible && flow.target ? (
        <View className="overflow-hidden rounded-plate bg-canvas">
          <View className="flex-row items-center justify-between px-5 pt-4">
            <Text variant="label">
              Report
            </Text>
            <Pressable
              onPress={flow.close}
              disabled={flow.submitting}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              hitSlop={8}>
              <Text variant="label" className="text-muted">
                Cancel
              </Text>
            </Pressable>
          </View>

          <View className="px-5 pb-3.5 pt-3">
            <Text variant="plate" trim accessibilityRole="header">
              {flow.target.label}
            </Text>
            <Text variant="body" className="mt-2 text-muted">
              Pick the closest reason.
            </Text>
          </View>

          {flow.reasons.map((r) => (
            <View key={r}>
              <Rule tone="hairline" />
              <Pressable
                onPress={() => flow.setReason(r)}
                accessibilityRole="radio"
                accessibilityLabel={r}
                accessibilityState={{ checked: flow.reason === r }}
                style={{ minHeight: MIN_TAP_TARGET }}
                className="flex-row items-center justify-between px-5 py-3 active:opacity-60">
                <Text variant="callout">{r}</Text>
                <Radio selected={flow.reason === r} />
              </Pressable>
            </View>
          ))}

          <Rule tone="hairline" />

          <View className="px-5 pb-5 pt-3.5">
            <Text variant="label" className="mb-1.5">
              Anything else we should know? {flow.reason === 'Other' ? '' : 'Optional.'}
            </Text>
            <TextInput
              value={flow.note}
              onChangeText={flow.setNote}
              placeholder={
                flow.reason === 'Other' ? 'What happened?' : 'Anything else we should know?'
              }
              placeholderTextColor={theme.muted}
              multiline
              maxLength={2000}
              accessibilityLabel="Additional details"
              className="rounded-md border border-rule px-3.5 py-3 font-body text-body"
              style={{ minHeight: 64, textAlignVertical: 'top', color: theme.ink }}
            />

            <Button
              title="Send report"
              variant="primary"
              disabled={!flow.canSubmit}
              loading={flow.submitting}
              onPress={flow.submit}
              className="mt-4"
            />
            {flow.submitError ? (
              <Text variant="caption" className="mt-2" style={{ color: theme.critical }}>
                {flow.submitError}
              </Text>
            ) : (
              <Text variant="caption" className="mt-3 text-muted">
                We share this, the account and your reason with the review team. Your name is not
                shown to them.
              </Text>
            )}
          </View>
        </View>
      ) : null}
    </SheetOverlay>
  );
}

/** RP-03 — review, not resolution. Nothing here implies an action already taken. */
function ConfirmationSheet({ flow }: { flow: ReportFlowState }) {
  const visible = flow.target !== null && flow.step === 'confirmation';

  return (
    <SheetOverlay visible={visible} onClose={flow.close}>
      {visible && flow.target ? (
        <View className="overflow-hidden rounded-plate bg-canvas p-5">
          <Text variant="plate" trim accessibilityRole="header" accessibilityLiveRegion="polite">
            Thank you. Every report is reviewed.
          </Text>
          <Text variant="body" className="mt-2.5 text-muted">
            We will not tell you the outcome, and {flow.target.handle} will not know it was you.
            It stays visible to others until the review is done.
          </Text>
          <Button title="Done" variant="ink" onPress={flow.acknowledge} className="mt-4" />
        </View>
      ) : null}
    </SheetOverlay>
  );
}

/**
 * RP-04 — the one block offer, made once immediately after the report and
 * never again for that account (`useReportFlow`'s `offeredBlockFor`). Block
 * is the screen's one oxblood action; Not now is quiet.
 */
function BlockOfferSheet({ flow }: { flow: ReportFlowState }) {
  const visible = flow.target !== null && flow.step === 'blockOffer';

  return (
    <SheetOverlay visible={visible} onClose={flow.blocking ? () => undefined : flow.close}>
      {visible && flow.target ? (
        <View className="overflow-hidden rounded-plate bg-canvas p-5">
          <Text variant="plate" trim accessibilityRole="header">
            Block {flow.target.handle} as well?
          </Text>
          <Text variant="body" className="mt-2.5 text-muted">
            Blocking retracts their votes on your looks, removes them from your events and hides
            your closet from them. They are not told. You can undo it in Profile.
          </Text>
          <View className="mt-4 gap-2.5">
            <Button title="Block" variant="primary" loading={flow.blocking} onPress={flow.confirmBlock} />
            <Button title="Not now" variant="secondary" disabled={flow.blocking} onPress={flow.close} />
          </View>
        </View>
      ) : null}
    </SheetOverlay>
  );
}
