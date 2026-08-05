-- The other half of 20260806100000: service_role's privileges were also
-- ambient platform defaults, and the current image no longer hands them out —
-- a fresh replay left the Edge Functions' own role unable to read items.
-- service_role carries BYPASSRLS, so table grants are its only gate; it gets
-- everything, which is what "the backend's key" has always meant here.
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- And the forward-looking half for both roles: new tables in this schema are
-- born with service_role access and nothing for the client roles — every
-- authenticated grant is a deliberate line in a migration from now on.
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
