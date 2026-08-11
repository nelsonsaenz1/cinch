-- The cache stops remembering what people typed.
--
-- `catalog_lookups.query` held the normalised description verbatim. The table is
-- keyed globally and attributed to nobody, which is exactly what makes one paid
-- request answer a question for everyone who asks it again — but an
-- unattributed table is not an anonymous one when the sentence inside it is
-- "my late nan's cardigan", or names a person, a place, or an occasion. People
-- describe clothes by what happened in them.
--
-- Replaced with `terms`: a sorted, deduplicated subset of a fixed garment
-- vocabulary (colours, garment nouns, materials, cuts), computed in
-- `catalog.ts` and capped at 12. Sorting is load-bearing rather than tidy — it
-- turns a phrase into a set, so word order is destroyed and the original
-- sentence cannot be reconstructed from the row even in principle.
--
-- The lookup itself is unaffected: it has always been keyed on the SHA-256 of
-- the normalised query, and a hash is not reversible. Nothing about the cache's
-- behaviour changes; it simply stops keeping something it never needed.
--
-- No backfill and no purge: the table was empty when this ran (verified), so
-- there is no historical free text to migrate or destroy.

alter table catalog_lookups drop column query;

alter table catalog_lookups
  add column terms text[] not null default '{}'
  check (array_length(terms, 1) is null or array_length(terms, 1) <= 12);

comment on column catalog_lookups.terms is
  'Sorted, deduplicated subset of a fixed garment vocabulary. NEVER the words a user typed — see RETAINED_TERMS in catalog.ts. Sorting destroys word order on purpose.';

-- ---------------------------------------------------------------------------
-- Count cache write failures.
--
-- A failed write is invisible from the outside: the user still gets the answer
-- from the response already in hand, and the only consequence is that the next
-- identical lookup pays the provider again. So this is a cost leak that reports
-- itself as nothing at all, which is the kind worth counting. (Audit item 28.)
-- ---------------------------------------------------------------------------
alter table catalog_quota
  add column cache_write_failures integer not null default 0
  check (cache_write_failures >= 0);

create function note_catalog_cache_write_failure(p_provider catalog_provider)
returns void
language sql security definer set search_path = '' as $$
  update public.catalog_quota
     set cache_write_failures = cache_write_failures + 1,
         updated_at = now()
   where provider = p_provider;
$$;

revoke execute on function note_catalog_cache_write_failure(catalog_provider)
  from public, anon, authenticated;
