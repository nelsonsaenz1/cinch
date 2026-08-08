import { useState } from 'react';

import { SheetHeader, SheetShell } from '@/components/events/date-sheet';
import { PlaceField, type PlaceSelection } from '@/components/events/place-field';

export type PlaceSheetProps = {
  visible: boolean;
  /** Fired once, on Done, with whatever the field is holding. */
  onDone: (selection: PlaceSelection | null) => void;
  onClose: () => void;
};

/**
 * Where is it? — the place field in a sheet, for filling a gap after the fact.
 *
 * The form asks for a place inline (N-06) because it is one of five questions
 * being asked at once. Here it is the *only* question: N-10's "Add a place"
 * chip is a single missing detail on an occasion that already exists, and a
 * sheet is what the app opens for a single question.
 *
 * Done reports the current selection rather than each keystroke, because the
 * write behind this is an UPDATE on a live row that other people are already
 * looking at — the atlas's promise is that "the details fill in later, and
 * everyone sees the change", which is a reason to write once and deliberately,
 * not on every character.
 */
export function PlaceSheet({ visible, onDone, onClose }: PlaceSheetProps) {
  const [text, setText] = useState('');
  const [selection, setSelection] = useState<PlaceSelection | null>(null);

  const done = () => {
    // A row that was tapped wins; otherwise whatever survived in the field is
    // taken as typed, which is the same escape hatch the form offers.
    const typed = text.trim();
    onDone(selection ?? (typed ? { kind: 'typed', name: typed } : null));
    setText('');
    setSelection(null);
  };

  return (
    <SheetShell visible={visible} onRequestClose={onClose} grabber accessibilityLabel="Where is it?">
      <SheetHeader title="Where is it?" onDone={done} />
      {/* No eyebrow: the sheet's own title is the question, and a `WHERE`
          above the field would ask it a second time. */}
      <PlaceField
        value={text}
        onChangeText={(next) => {
          setText(next);
          // Typing after a pick means the text is no longer that place.
          setSelection(null);
        }}
        onSelect={(picked) => {
          setSelection(picked);
          setText(picked.name);
        }}
        label={null}
        className="mt-4"
      />
    </SheetShell>
  );
}
