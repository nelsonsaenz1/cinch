-- ===========================================================================
-- The first-run tour, shown once.
--
-- TR's rule is "once, ever, on any device", which is a fact about a PERSON and
-- not about a phone. AsyncStorage would show it again on the iPad, and again
-- after a reinstall — the two moments a returning user is least in the mood
-- to be told what the app is.
--
-- `onboarding_complete` is deliberately not reused. It already gates name
-- capture (20260803154431), so overloading it would make a skipped tour look
-- like an unfinished account, and an unfinished account look like a tour that
-- had not been shown.
-- ===========================================================================

alter table profiles
  add column if not exists toured_at timestamptz;
