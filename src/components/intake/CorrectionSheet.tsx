import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import type { Slot } from '@/lib/styling/types';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

// ColourGrid is being built concurrently by another unit
// (src/components/intake/ColourGrid.tsx) and does not exist at the time this
// file was written. The assumed contract — stated in the build report, not
// just here — is a controlled field: the currently-selected colour TERM in,
// a new term out. Nothing about hex or OKLCH crosses this boundary, which
// matches colour-lexicon.ts's own contract (`resolveSpokenColour` takes a
// term) and keeps the "the model never invents OKLCH" refusal intact all the
// way through a manual correction.
import { ColourGrid } from './ColourGrid';

/**
 * V-07 — the correction sheet.
 *
 * A sheet over V-06, never a screen of its own: `GarmentCard` stays mounted
 * underneath (dimmed by the scrim) so "Save" reads as *this card, corrected*
 * rather than a navigation away and back. The caller owns `visible` and the
 * open/close transition; this component only draws what is inside it.
 *
 * FIELD ORDER IS THE DIRECTIVE'S, NOT ALPHABETICAL OR SCHEMA ORDER.
 * Name → Kind → Colour → Fabric → Pattern → How dressy → How warm (§3, V-07's
 * table). Kind is asked before Colour on purpose: correcting "navy" on a
 * garment that is actually a bag rather than a top is a wasted correction if
 * the kind was wrong all along, so the field that changes what the rest of
 * the sheet even means comes first.
 *
 * WHY CHIPS FOR EVERYTHING BUT NAME/FABRIC/PATTERN
 *
 * `add-tag-sheet.tsx` set the precedent this follows: a correction should take
 * one tap, never a keyboard, whenever the value comes from a closed
 * vocabulary. Kind is the slot union the styling engine actually reads (see
 * `SLOTS` in `supabase/functions/_shared/intake-schema.ts`, mirrored here via
 * the client-side `Slot` type — that Edge Function file is Deno-only and
 * excluded from this project's tsconfig, so the vocabulary is re-declared
 * against the identical union rather than imported). Formality and warmth are
 * the tagger's own closed 1..5 scales (`tag-schema.ts`'s
 * `formalityScore`/`warmthScore`). Fabric and pattern are free strings in the
 * parse schema — a chip row would either invent a vocabulary the model was
 * never constrained to, or silently drop whatever the model actually wrote
 * down, so those two stay text fields.
 */

/** The slot union, in the order the directive's chip rows read most naturally
 *  — tops before layers before bottoms — not the schema's declaration order.
 *  `slotLabel` and `GarmentCard`'s attribute row both read off this table, so
 *  a garment's "Top" chip and its Kind-field selection can never disagree. */
export const SLOT_OPTIONS: { value: Slot; label: string }[] = [
  { value: 'base_top', label: 'Top' },
  { value: 'mid_layer', label: 'Layer' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'dress', label: 'Dress' },
  { value: 'outerwear', label: 'Coat' },
  { value: 'footwear', label: 'Shoes' },
  { value: 'bag', label: 'Bag' },
  { value: 'headwear', label: 'Hat' },
  { value: 'accessory', label: 'Accessory' },
];

/** `tag-schema.ts`'s own gloss for the scale — "1 = loungewear, 3 = smart
 *  casual, 5 = black tie" — turned into the five words a chip can carry. A
 *  user was never asked for a number; they should not be asked to correct one. */
export const FORMALITY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Loungewear' },
  { value: 2, label: 'Casual' },
  { value: 3, label: 'Smart casual' },
  { value: 4, label: 'Dressy' },
  { value: 5, label: 'Black tie' },
];

/** Mirrors `tag-schema.ts`'s warmth gloss — "1 = hot weather only, 3 = mild,
 *  5 = deep winter". */
export const WARMTH_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Hot weather' },
  { value: 2, label: 'Light layer' },
  { value: 3, label: 'Mild' },
  { value: 4, label: 'Warm' },
  { value: 5, label: 'Deep winter' },
];

export function slotLabel(slot: string): string {
  return SLOT_OPTIONS.find((o) => o.value === slot)?.label ?? 'Item';
}

export function formalityLabel(value: number | null): string | null {
  if (value == null) return null;
  return FORMALITY_OPTIONS.find((o) => o.value === value)?.label ?? null;
}

export function warmthLabel(value: number | null): string | null {
  if (value == null) return null;
  return WARMTH_OPTIONS.find((o) => o.value === value)?.label ?? null;
}

/** Which field a tap should land the sheet on. Named identically to
 *  `EditedField` in `features/intake/buckets.ts` (minus `quantity`, which
 *  V-07 does not carry — that correction is V-09's stepper) so a caller can
 *  feed this straight into `intakeCardEdited()` without a translation layer. */
export type CorrectionField = 'name' | 'kind' | 'colour' | 'fabric' | 'pattern' | 'formality' | 'warmth';

/** Exactly the columns V-07 can touch. Deliberately not the whole
 *  `IntakeDraftRow` — `ordinal`, `utterance`, `confidence`, `state` and the
 *  rest are the procession's business, not a form field's. */
export type CorrectionDraft = {
  name: string;
  slot: string;
  colourTerm: string;
  fabric: string | null;
  pattern: string | null;
  formality: number | null;
  warmth: number | null;
};

export type CorrectionSheetProps = {
  visible: boolean;
  initial: CorrectionDraft;
  /** Set when a specific attribute chip on V-06 opened this sheet, so the
   *  sheet can scroll straight to that field instead of making a re-check of
   *  five things for a mistake in one of them. Unset for the plain "Fix
   *  something" action, which opens at the top. */
  focusField?: CorrectionField;
  onSave: (next: CorrectionDraft) => void;
  onDismiss: () => void;
  busy?: boolean;
};

export function CorrectionSheet({
  visible,
  initial,
  focusField,
  onSave,
  onDismiss,
  busy = false,
}: CorrectionSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  // Measured on layout, once per field. State rather than a ref: a ref's
  // `.current` may only be read outside of render (an event handler or an
  // effect — see the scroll effect below), and the render-phase reseed this
  // needs to feed reads it synchronously during render, which only state can
  // do safely.
  const [sectionY, setSectionY] = useState<Partial<Record<CorrectionField, number>>>({});
  const recordSection = (field: CorrectionField) => (e: LayoutChangeEvent) => {
    const y = e.nativeEvent.layout.y;
    setSectionY((prev) => (prev[field] === y ? prev : { ...prev, [field]: y }));
  };

  const [draft, setDraft] = useState<CorrectionDraft>(initial);

  /**
   * Re-seed from the draft in the render pass that OPENS the sheet — not in
   * an effect. Same reasoning as `item-edit-sheet.tsx`: an effect commits a
   * frame late, and `initial` is a fresh object literal on every render of
   * the caller, so keying off it instead of `visible` would reset whatever
   * the user is mid-edit of.
   */
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setDraft(initial);
  }

  /**
   * Jump to the focused field once the sheet is open and that field's layout
   * has been measured — an imperative `ScrollView.scrollTo`, which (like any
   * other ref read) belongs in an effect, not folded into the render-phase
   * reseed above. The layout measured on the sheet's PREVIOUS open is almost
   * always still valid (the field list never changes shape), so this fires
   * the very first time `sectionY` already has the answer rather than
   * waiting for a fresh measurement that will not differ from the old one.
   */
  useEffect(() => {
    if (!visible || !focusField) return;
    const y = sectionY[focusField];
    if (y == null) return;
    const frame = requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ y: Math.max(y - 16, 0), animated: false }),
    );
    return () => cancelAnimationFrame(frame);
    // Deliberately keyed on `visible`/`focusField` alone. Re-running this
    // every time `sectionY` gains a new measurement would fight a scroll the
    // user has already made by hand while the sheet is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, focusField]);

  const canSave = draft.name.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={busy ? undefined : onDismiss}>
      <View className="flex-1 justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          disabled={busy}
          onPress={onDismiss}
          style={{ position: 'absolute', inset: 0, backgroundColor: theme.scrim }}
        />

        <View
          accessibilityViewIsModal
          className="overflow-hidden rounded-t-plate bg-surface dark:bg-surface-dark"
          style={{ maxHeight: '88%' }}>
          {/* Grab handle — the sheet's own furniture, per every other sheet
              in the app (see borrow-lend-sheet.tsx). */}
          <View className="items-center pb-1 pt-2.5">
            <View className="h-[5px] w-9 rounded-full bg-sand" />
          </View>

          <View className="flex-row items-start justify-between px-5 pb-3 pt-1">
            <Text variant="title" trim>
              Fix this one
            </Text>
            {/* The directive's own spec for V-07: "close ✕ top-right" — the one
                sheet in the app that draws a literal close glyph rather than a
                text "Cancel", because Save is the only other exit and it needs
                to read as unambiguously optional. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              accessibilityHint="Discards this correction and returns to the card"
              disabled={busy}
              hitSlop={12}
              onPress={onDismiss}
              style={{ minWidth: MIN_TAP_TARGET - 12, minHeight: MIN_TAP_TARGET - 12 }}
              className="items-end justify-center active:opacity-60">
              <SymbolView name="xmark" size={16} tintColor={theme.muted} resizeMode="scaleAspectFit" />
            </Pressable>
          </View>

          <ScrollView
            ref={scrollRef}
            contentContainerClassName="px-5 pb-4"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag">
            <Field label="Name" onLayout={recordSection('name')}>
              <TextInput
                value={draft.name}
                onChangeText={(name) => setDraft((d) => ({ ...d, name }))}
                autoFocus={focusField === 'name'}
                placeholder="Navy wool crewneck"
                placeholderTextColor={theme.faint}
                accessibilityLabel="Garment name"
                returnKeyType="done"
                editable={!busy}
                className="flex-1 font-body text-callout text-ink"
                style={{ minHeight: MIN_TAP_TARGET, color: theme.ink }}
              />
            </Field>

            <ChipSection label="Kind" onLayout={recordSection('kind')}>
              {SLOT_OPTIONS.map((o) => (
                <Chip
                  key={o.value}
                  label={o.label}
                  selected={draft.slot === o.value}
                  selectedGround="ink"
                  accessibilityHint={`Sets kind to ${o.label}`}
                  onPress={() => setDraft((d) => ({ ...d, slot: o.value }))}
                />
              ))}
            </ChipSection>

            <View onLayout={recordSection('colour')}>
              <Text variant="colophon" className="mb-2.5 mt-6">
                Colour
              </Text>
              <ColourGrid
                value={draft.colourTerm}
                onChange={(colourTerm: string) => setDraft((d) => ({ ...d, colourTerm }))}
              />
            </View>

            <Field label="Fabric" onLayout={recordSection('fabric')}>
              <TextInput
                value={draft.fabric ?? ''}
                onChangeText={(text) => setDraft((d) => ({ ...d, fabric: text.length > 0 ? text : null }))}
                autoFocus={focusField === 'fabric'}
                placeholder="Wool"
                placeholderTextColor={theme.faint}
                accessibilityLabel="Fabric"
                returnKeyType="done"
                editable={!busy}
                className="flex-1 font-body text-callout text-ink"
                style={{ minHeight: MIN_TAP_TARGET, color: theme.ink }}
              />
            </Field>

            <Field label="Pattern" onLayout={recordSection('pattern')}>
              <TextInput
                value={draft.pattern ?? ''}
                onChangeText={(text) => setDraft((d) => ({ ...d, pattern: text.length > 0 ? text : null }))}
                autoFocus={focusField === 'pattern'}
                placeholder="Solid"
                placeholderTextColor={theme.faint}
                accessibilityLabel="Pattern"
                returnKeyType="done"
                editable={!busy}
                className="flex-1 font-body text-callout text-ink"
                style={{ minHeight: MIN_TAP_TARGET, color: theme.ink }}
              />
            </Field>

            <ChipSection label="How dressy" onLayout={recordSection('formality')}>
              {FORMALITY_OPTIONS.map((o) => (
                <Chip
                  key={o.value}
                  label={o.label}
                  selected={draft.formality === o.value}
                  selectedGround="ink"
                  accessibilityHint={`Sets how dressy to ${o.label}`}
                  onPress={() => setDraft((d) => ({ ...d, formality: o.value }))}
                />
              ))}
            </ChipSection>

            <ChipSection label="How warm" onLayout={recordSection('warmth')}>
              {WARMTH_OPTIONS.map((o) => (
                <Chip
                  key={o.value}
                  label={o.label}
                  selected={draft.warmth === o.value}
                  selectedGround="ink"
                  accessibilityHint={`Sets how warm to ${o.label}`}
                  onPress={() => setDraft((d) => ({ ...d, warmth: o.value }))}
                />
              ))}
            </ChipSection>
          </ScrollView>

          <View className="gap-2.5 px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12) + 8 }}>
            {/* The sheet's one oxblood action (refusal 6) — "Fix something"
                already spent its tap opening this sheet, so nothing here
                competes with Save for the accent. */}
            <Button title="Save" loading={busy} disabled={!canSave} onPress={() => onSave(draft)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** A labelled text-field well — the eyebrow above, the bordered row below.
 *  Matches `item-edit-sheet.tsx`'s `Field`, duplicated rather than imported:
 *  that one is a private, unexported helper local to its own file. */
function Field({
  label,
  onLayout,
  children,
}: {
  label: string;
  onLayout?: (e: LayoutChangeEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <View className="mt-6" onLayout={onLayout}>
      <Text variant="colophon" className="mb-1.5">
        {label}
      </Text>
      <View
        className="flex-row items-center rounded-md border border-rule px-3 dark:border-rule-dark"
        style={{ minHeight: MIN_TAP_TARGET }}>
        {children}
      </View>
    </View>
  );
}

/** A labelled, wrapping chip row — the eyebrow above, the chips below. */
function ChipSection({
  label,
  onLayout,
  children,
}: {
  label: string;
  onLayout?: (e: LayoutChangeEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <View className="mt-6" onLayout={onLayout}>
      <Text variant="colophon" className="mb-2.5">
        {label}
      </Text>
      <View className="flex-row flex-wrap gap-2">{children}</View>
    </View>
  );
}
