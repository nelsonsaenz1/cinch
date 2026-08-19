import { useState } from 'react';
import { ScrollView } from 'react-native';

import { SheetHeader, SheetShell } from '@/components/events/date-sheet';
import { PlaceField, type PlaceSelection } from '@/components/events/place-field';

/**
 * How tall the field and its results may grow before they scroll.
 *
 * 420pt, which is what a 393×852 phone has left once the keyboard (about 336pt
 * with its accessory bar), the sheet's own header and its padding are taken
 * off. A cap rather than a computed height because the sheet is bottom-anchored
 * and lifted by the keyboard: there is no container above it whose height this
 * could be a fraction of, and the number that matters is "less than what is
 * left", which this is on every phone the app runs on.
 */
const PANEL_MAX_HEIGHT = 420;

export type PlaceSheetProps = {
  visible: boolean;
  /**
   * What the caller is already holding, seeded every time the sheet opens.
   *
   * Empty for the N-10 gap-filling case this sheet was written for; the New
   * Event composer passes the venue already on the row, because a sheet that
   * opens blank over an answered field asks the user to retype an answer they
   * have already given.
   */
  initialText?: string;
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
export function PlaceSheet({ visible, initialText = '', onDone, onClose }: PlaceSheetProps) {
  const [text, setText] = useState(initialText);
  const [selection, setSelection] = useState<PlaceSelection | null>(null);

  // Re-seeded on OPEN and only then — React's own "adjusting state when a prop
  // changes" pattern, exactly as `DateSheet` re-seats its visible month. An
  // effect would paint one frame of the previous value first, and keying on
  // `initialText` would yank the field out from under live typing.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setText(initialText);
      setSelection(null);
    }
  }

  const done = () => {
    // A row that was tapped wins; otherwise whatever survived in the field is
    // taken as typed, which is the same escape hatch the form offers.
    const typed = text.trim();
    onDone(selection ?? (typed ? { kind: 'typed', name: typed } : null));
    setText('');
    setSelection(null);
  };

  return (
    <SheetShell
      visible={visible}
      onRequestClose={onClose}
      grabber
      // The founder's item 10. This is the ONE sheet in the set with a text
      // field in it, so it is the one that lifts: without this the keyboard
      // comes up over a bottom-anchored sheet and covers both the field being
      // typed into and the list of places it is suggesting.
      avoidKeyboard
      accessibilityLabel="Where is it?">
      <SheetHeader title="Where is it?" onDone={done} />
      {/* No eyebrow: the sheet's own title is the question, and a `WHERE`
          above the field would ask it a second time.

          The field and its panel SCROLL. Lifting the sheet clear of the keys
          is only half the fix: what is left above the keyboard is a few hundred
          points, and MapKit's panel is up to five rows plus the as-typed row
          plus `Search near me` — more than fits at the accessibility sizes, and
          the last rows would be cut off with nothing to scroll them into view.

          `keyboardShouldPersistTaps="handled"` is load-bearing rather than
          tidy: inside a scroll view the first tap on a suggestion would
          otherwise be swallowed dismissing the keyboard, so choosing a place
          would take two taps and read as a dead row. It is the same default
          `KeyboardAwareScrollView` sets, written out here because this is a
          plain `ScrollView` on purpose — `automaticallyAdjustKeyboardInsets`
          on top of the shell's own avoidance is the two mechanisms compounding,
          and the sheet would lift twice. */}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        // The panel is allowed to grow to the room the lifted sheet has and no
        // further. `flexGrow: 0` keeps a one-row sheet the height of one row
        // rather than stretching to the cap.
        style={{ flexGrow: 0, maxHeight: PANEL_MAX_HEIGHT }}>
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
      </ScrollView>
    </SheetShell>
  );
}
