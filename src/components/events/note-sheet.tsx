import { useState } from 'react';

import { SheetHeader, SheetShell } from '@/components/events/date-sheet';
import { OccasionField } from '@/components/events/occasion-field';
import { NOTE_MAX } from '@/features/events/new-event-spec';

/** How close to the cap the counter starts watching. "The count appears in the
 *  last ten characters and not before — a counter that watches from the first
 *  keystroke reads as a warning." */
const COUNTER_FROM = 10;

export type NoteSheetProps = {
  visible: boolean;
  /** What the composer is already holding, seeded on every open. */
  value: string;
  /** Fired once, on Done, with whatever the field ended up holding. */
  onDone: (note: string) => void;
  onClose: () => void;
};

/**
 * A note for the group — the composer's NOTE row, as its own question.
 *
 * The redesigned composer asks one thing per row and opens one sheet per row,
 * so the note stops being a text area sitting under four other controls and
 * becomes the same shape of question the date and the place already are. The
 * semantics are untouched: it is still the group's note, still capped at 280
 * inside the column's 1000, still optional, and still written by
 * `useCreateEvent` into `note` and nowhere else.
 *
 * Done reports once rather than per keystroke — the same contract `PlaceSheet`
 * keeps, and the reason a dismissed sheet cannot half-answer the row.
 */
export function NoteSheet({ visible, value, onDone, onClose }: NoteSheetProps) {
  const [text, setText] = useState(value);

  // Re-seed every time the sheet OPENS, and only then — React's own "adjusting
  // state when a prop changes" pattern, exactly as `DateSheet` does it. An
  // effect would paint one frame of the previous note first.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setText(value);
  }

  return (
    <SheetShell
      visible={visible}
      onRequestClose={onClose}
      grabber
      accessibilityLabel="A note for the group">
      <SheetHeader title="Anything to add?" onDone={() => onDone(text)} />
      {/* No eyebrow: the sheet's own title is the question, and a `NOTE` above
          the field would ask it a second time. */}
      <OccasionField
        label={null}
        value={text}
        onChangeText={setText}
        placeholder="Anything they should know"
        multiline
        maxLength={NOTE_MAX}
        counterFrom={COUNTER_FROM}
        accessibilityLabel="Note for the group"
        className="mt-4"
      />
    </SheetShell>
  );
}
