/**
 * UX-05 — the Profile/Settings split, stated once so it can be enforced.
 *
 * Profile keeps identity, the closet signals derived from it, and the fields
 * other people can see. Everything that administers the account — membership,
 * preferences, people controls, notifications, help, diagnostics, sign out and
 * deletion — moves behind a gear into a pushed `/settings` route.
 *
 * The one thing a split like this is allowed to do is move a row. It is not
 * allowed to lose one, and "no capability disappears" is not a claim anybody
 * can eyeball across two seven-hundred-line screens. `CAPABILITY_HOMES` is the
 * reconciliation: every capability the single Profile screen carried before the
 * split, and the file it must be reachable from after it. `tests/
 * profile-settings-split.test.ts` reads both routes and checks each one is
 * present in its home and absent from the other, in both directions.
 */

/** The gear's accessibility label, and the pushed route's own serif title. */
export const SETTINGS_TITLE = 'Settings';

/**
 * The row that used to be a lie.
 *
 * Profile drew a `<Switch value disabled>` beside "Daily outfit styling" — a
 * control that could not be operated, wired to `onValueChange={() => {}}`.
 * The fact underneath it was true (the beam search in `src/lib/styling` runs on
 * the phone and has no off switch), but a permanently-on disabled switch states
 * that fact in the one grammar that also promises a choice.
 *
 * UX-05 offers two exits — remove the control, or express it as honest
 * information. This is both: the control is gone and the fact it was standing
 * in for is now written out, in a row that makes no offer at all.
 */
export const DAILY_STYLING_LABEL = 'Daily outfit styling';
export const DAILY_STYLING_FACT =
  'Always on. Outfits are built from your closet, on this phone — no network, no AI, and nothing to switch off.';

/**
 * UX-08 — sign out stops being a blocking alert.
 *
 * The criterion reserves `Alert` for destructive or irreversible choices, and
 * this one is neither: the app's own copy has always said so ("You can sign
 * back in anytime — your closet stays put"). It is a two-option question, and
 * a question is what `ConfirmSheet` is for. Deleting an account stays where it
 * is — `DeleteAccountCard`, with its typed confirmation — because that one
 * genuinely cannot be undone.
 *
 * The keep-option is named for the thing being kept rather than "Cancel", per
 * the sheet's own rule.
 */
export const SIGN_OUT_CONFIRM = {
  title: 'Sign out',
  body: 'You can sign back in anytime — your closet stays put.',
  keepLabel: 'Stay signed in',
  destructiveLabel: 'Sign out',
} as const;

/** What `restorePurchases()` came back with. */
export type RestoreOutcome = 'restored' | 'none' | 'failed';

/**
 * UX-08 again — the three restore endings, none of which is a blocking alert
 * on this surface.
 *
 * `restored` is a success and goes to the shared toast. The other two are
 * recoverable errors, so they go inline into a `NoticeBand` that keeps the
 * recovery visible: the row that caused it is still on screen and still
 * pressable, and the band names the retry as well rather than making the user
 * remember where they were.
 *
 * The copy is the alerts' copy, unchanged. The classification moved; the words
 * were already honest, and "nothing has changed" in the failure case is a
 * promise about the App Store that is still true.
 */
export const RESTORE_OUTCOMES = {
  restored: {
    kind: 'toast',
    message: 'Purchases restored — your membership is back on this device.',
  },
  none: {
    kind: 'notice',
    cause: 'NO SUBSCRIPTION FOUND',
    title: 'No Cinch subscription on this Apple ID',
    body: "We couldn't find a Cinch subscription on this Apple ID. If you paid on another account, sign in to that one and try again.",
    action: 'Try again',
  },
  failed: {
    kind: 'notice',
    cause: "COULDN'T REACH THE APP STORE",
    title: 'Could not restore purchases',
    body: 'Something went wrong talking to the App Store. Nothing has changed — try again in a moment.',
    action: 'Try again',
  },
} as const;

export type CapabilityHome = {
  id: string;
  /** Which route file the capability must live in after the split. */
  home: 'profile' | 'settings';
  /**
   * A literal that appears in the home route's source and in no other. Import
   * identifiers stand in where the user-facing string lives in this file, so
   * the evidence tracks the wiring rather than a copy of the copy.
   */
  evidence: string;
  /** What the row does, for the failure message when one goes missing. */
  note: string;
};

/**
 * Every capability the pre-split Profile screen carried, and where it lives now
 * — plus the one thing the split adds, the gear itself.
 *
 * The count is asserted in the test so that deleting a line here cannot quietly
 * relax the check it exists to enforce.
 */
export const CAPABILITY_HOMES: readonly CapabilityHome[] = [
  // ── Identity and closet signals: kept on Profile ────────────────────────
  { id: 'coaching-card', home: 'profile', evidence: 'ProfileCoachingCard', note: 'PR-C1 first-visit coaching' },
  { id: 'identity-header', home: 'profile', evidence: 'fetchProfileHeader', note: 'avatar, name, handle' },
  { id: 'edit-profile', home: 'profile', evidence: 'EditProfileSheet', note: 'the public fields' },
  // Redesign 07 folded PR-01's two-counter band into the single quiet plan
  // door the founder's spec asks for, so the evidence moves from the row's old
  // label to the hook the row is still built from. The capability is the same
  // one: this screen is where a member meets their ceiling.
  { id: 'capacity', home: 'profile', evidence: 'useCapacity', note: 'the capacity/plan door' },
  // Same move, same reason: "What Cinch has learned" was a titled card of
  // paragraph copy and is now one quiet line under the marks. The read behind
  // it is untouched.
  { id: 'learned', home: 'profile', evidence: 'useStyleProfile', note: 'style profile summary' },
  // The diary is now a row in the overflow menu rather than a card on the page,
  // so the evidence is the handler that opens it rather than the label, which
  // lives in `profile-spec.ts` with the rest of the page's copy.
  { id: 'wear-diary', home: 'profile', evidence: 'onOpenDiary', note: 'the record of what was worn' },
  // NEW with redesign 07, and the founder's own words: "a tappable friends
  // count — '12 friends' opens the friends list". Profile now carries a door to
  // the circle as well as Settings; see the note on `friends` below.
  { id: 'friends-count', home: 'profile', evidence: 'onOpenFriends', note: 'the tappable friends count' },
  // Quoted, because the unquoted path is a substring of this module's own
  // import specifier (`@/features/profile/settings-copy`) and would match in
  // the wrong file.
  { id: 'settings-entry', home: 'profile', evidence: "'/settings'", note: 'the gear into Settings' },

  // ── Administration: pushed behind the gear ──────────────────────────────
  { id: 'membership', home: 'settings', evidence: 'membershipRowFor', note: 'plan row and its retry' },
  { id: 'daily-styling', home: 'settings', evidence: 'DAILY_STYLING_FACT', note: 'honest styling statement' },
  { id: 'where-to-buy', home: 'settings', evidence: 'SHOW_WHERE_TO_BUY_LABEL', note: 'C-03 merchant toggle' },
  { id: 'privacy-data', home: 'settings', evidence: 'Privacy & data', note: 'consent, export, deletion' },
  // Two doors to one list, on purpose. Settings administers the circle; the
  // count in Profile's identity block is the founder's spec and is a different
  // affordance for the same destination — which is why the evidence is the
  // ROW, not the word, and why `friends-count` above is its own capability.
  // Nothing is written from either place, so there is no state to disagree on.
  { id: 'friends', home: 'settings', evidence: 'label="Friends"', note: 'the circle' },
  { id: 'borrow', home: 'settings', evidence: 'Borrow requests', note: 'incoming asks and their count' },
  { id: 'blocked', home: 'settings', evidence: 'Blocked people', note: 'block list and its count' },
  { id: 'notifications', home: 'settings', evidence: 'NOTIFICATION_SETTINGS_AVAILABLE', note: 'push settings, where the build has them' },
  { id: 'restore', home: 'settings', evidence: 'useRestorePurchases', note: 'Guideline 3.1.1 restore path' },
  { id: 'help', home: 'settings', evidence: "'/help'", note: 'the native help pages' },
  { id: 'privacy-policy', home: 'settings', evidence: 'PRIVACY_URL', note: 'the external policy' },
  { id: 'sign-out', home: 'settings', evidence: 'SIGN_OUT_CONFIRM', note: 'ending the session' },
  { id: 'delete-account', home: 'settings', evidence: 'DeleteAccountCard', note: 'Guideline 5.1.1(v) deletion' },
  { id: 'diagnostics', home: 'settings', evidence: 'updateDiagnostics', note: 'update channel facts' },
  { id: 'version', home: 'settings', evidence: 'expoConfig?.version', note: 'the edition mark' },
] as const;
