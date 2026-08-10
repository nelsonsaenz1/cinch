-- The spans a parse could not turn into a garment, kept.
--
-- `parse-closet` returned `unconsumed` in its response and nothing ever stored
-- it. The reused branch — which is the resume path, taken whenever a session is
-- reopened after a cold start — therefore always answered `[]`, and V-04/V-05's
-- "things I didn't catch" disclosure silently emptied itself.
--
-- That is a direct breach of the wave's own refusal 7, "nothing is ever lost",
-- and of the rule underneath it: if the app failed to understand something a
-- person said out loud, that failure has to stay visible rather than being
-- swallowed. Losing it on resume is exactly the swallow the disclosure exists
-- to prevent.
--
-- text[] rather than jsonb: it is a list of strings, it is only ever read whole,
-- and an array keeps the shape honest about that.
alter table intake_sessions
  add column if not exists unconsumed text[] not null default '{}';

comment on column intake_sessions.unconsumed is
  'Spans of the transcript the parse could not turn into a garment. Shown to the user under "things I didn''t catch" (V-05) and preserved across a resume.';
