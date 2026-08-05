-- ===========================================================================
-- Account deletion state  (CIN-02)
--
-- `delete-account` destroys storage objects and then the auth user. Those are
-- two irreversible steps against two different systems, and no transaction
-- spans them. The old code pretended otherwise: a failure part-way through the
-- storage pass returned "Nothing has been removed", which was false the moment
-- the first chunk succeeded, and a storage pass that succeeded followed by a
-- failed deleteUser left an account whose photographs were gone.
--
-- There is no way to make those two steps atomic. There is a way to make them
-- resumable, which is what this column is for: it marks the point of no return,
-- so a half-finished deletion is a state the system can recognise and finish
-- rather than an inconsistency nobody can see.
-- ===========================================================================

alter table profiles
  add column if not exists deletion_requested_at timestamptz;

comment on column profiles.deletion_requested_at is
  'Set by the delete-account function before it destroys anything. Non-null means the account is mid-deletion: photographs may already be gone and the only correct way forward is to finish. Retrying deletion keeps the original timestamp, so this is the time the user asked, not the time of the last attempt. Deliberately not revoked from the client: an owner setting it on their own row grants them nothing, since deletion itself still requires the service role.';

-- A deletion that never finished is an obligation, not a curiosity: the user
-- asked to be forgotten and part of their data may still exist. Small partial
-- index so "who is stuck mid-deletion" is one cheap query.
create index if not exists profiles_deletion_pending_idx
  on profiles (deletion_requested_at)
  where deletion_requested_at is not null;
