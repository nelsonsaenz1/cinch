-- Audit 23, follow-up: name the failure the ledger could not previously express.
--
-- The first cut of the ledger stored `no_state_change` for anything it had not
-- yet decided, which meant a subscription write that FAILED was indistinguishable
-- from an event that legitimately changed nothing. It is neither. It is the one
-- outcome an operator most needs to find.
alter type superwall_outcome add value if not exists 'write_failed';
