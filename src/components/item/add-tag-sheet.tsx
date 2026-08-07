import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { occasion, season } from '@/schemas/item';

/** The vocabularies the tagger itself is constrained to — see schemas/item.ts. */
const OCCASIONS = occasion.options;
const SEASONS = season.options;

export type TagDraft = { occasions: string[]; seasons: string[] };

export type AddTagSheetProps = {
  visible: boolean;
  initial: TagDraft;
  onSave: (next: TagDraft) => void;
  onCancel: () => void;
  busy?: boolean;
};

/** Capitalised for display only; the stored vocabulary stays lowercase. */
function label(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * What the dashed "+ Tag" chip opens.
 *
 * ── Why a fixed vocabulary and not a text field ───────────────────────────
 *
 * `occasions` and `seasons` are plain `text[]` columns, so a free-text field
 * would write happily. It would also be the one place in the app where a tag is
 * typed rather than tapped, and the values would immediately drift out of the
 * lists the TAGGER is constrained to (`SEASONS` / `OCCASIONS` in
 * `supabase/functions/_shared/tag-schema.ts`, mirrored by the enums in
 * `schemas/item.ts`). Everything downstream — the styling engine's season and
 * occasion matching, the closet's filters — reads those lists. A hand-typed
 * "autumn" beside a machine-written "fall" is two tags that mean one thing and
 * match nothing, and the user would have no way to see why.
 *
 * So this offers exactly the vocabulary the rest of the system speaks, as chips,
 * which is the same answer the review deck already gives for the same question:
 * a correction should take one tap, never a keyboard.
 *
 * Values that have drifted out of the vocabulary are still shown and still
 * removable — `schemas/item.ts` keeps those columns permissive on purpose, and
 * a tag this sheet could display but not delete would be a trap.
 */
export function AddTagSheet({ visible, initial, onSave, onCancel, busy = false }: AddTagSheetProps) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<TagDraft>(initial);

  /**
   * Re-seed on open, adjusted during render rather than in an effect — React's
   * "adjusting state when a prop changes" pattern. Keyed on `visible` and not on
   * `initial`, which is a fresh literal on every render of the page and would
   * discard taps mid-edit.
   */
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setDraft(initial);
  }

  // Anything already on the row that the vocabulary does not contain. Rendered
  // after the known values so the familiar list keeps its order.
  const strayOccasions = draft.occasions.filter((o) => !OCCASIONS.includes(o as never));
  const straySeasons = draft.seasons.filter((s) => !SEASONS.includes(s as never));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={busy ? undefined : onCancel}
      statusBarTranslucent>
      <View className="flex-1 justify-end">
        {/* The atlas's dimming value for a sheet over this screen (I-02), not
            the 40% `scrim` token — the garment stays readable behind the ask. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          disabled={busy}
          onPress={onCancel}
          style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(28,26,22,0.28)' }}
        />

        <View
          accessibilityViewIsModal
          className="mx-2.5 overflow-hidden rounded-plate bg-canvas dark:bg-canvas-dark"
          style={{ marginBottom: Math.max(insets.bottom, 10) + 10, maxHeight: '82%' }}>
          <View className="px-5 pt-5">
            <Text variant="title">Tag this piece</Text>
            <Text variant="label" className="mt-2.5 text-muted dark:text-muted-dark">
              What it suits, and when you reach for it. These are the same words the planner reads.
            </Text>
          </View>

          <ScrollView contentContainerClassName="px-5 pb-2 pt-4">
            <Text variant="colophon" className="mb-2.5">
              Suits
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {OCCASIONS.map((o) => (
                <Chip
                  key={o}
                  label={label(o)}
                  selected={draft.occasions.includes(o)}
                  selectedGround="ink"
                  accessibilityHint={
                    draft.occasions.includes(o) ? 'Removes this tag' : 'Adds this tag'
                  }
                  onPress={() => setDraft((d) => ({ ...d, occasions: toggle(d.occasions, o) }))}
                />
              ))}
              {strayOccasions.map((o) => (
                <Chip
                  key={o}
                  label={label(o)}
                  selected
                  selectedGround="ink"
                  accessibilityHint="Removes this tag"
                  onPress={() => setDraft((d) => ({ ...d, occasions: toggle(d.occasions, o) }))}
                />
              ))}
            </View>

            <Text variant="colophon" className="mb-2.5 mt-6">
              Seasons
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {SEASONS.map((s) => (
                <Chip
                  key={s}
                  label={label(s)}
                  selected={draft.seasons.includes(s)}
                  selectedGround="ink"
                  accessibilityHint={draft.seasons.includes(s) ? 'Removes this tag' : 'Adds this tag'}
                  onPress={() => setDraft((d) => ({ ...d, seasons: toggle(d.seasons, s) }))}
                />
              ))}
              {straySeasons.map((s) => (
                <Chip
                  key={s}
                  label={label(s)}
                  selected
                  selectedGround="ink"
                  accessibilityHint="Removes this tag"
                  onPress={() => setDraft((d) => ({ ...d, seasons: toggle(d.seasons, s) }))}
                />
              ))}
            </View>
          </ScrollView>

          <View className="gap-2.5 px-5 pb-5 pt-3">
            <Button title="Save" loading={busy} onPress={() => onSave(draft)} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              disabled={busy}
              onPress={onCancel}
              style={{ height: 48 }}
              className="items-center justify-center active:opacity-60">
              <Text variant="callout" className="text-muted dark:text-muted-dark">
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
