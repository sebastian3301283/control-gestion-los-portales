-- Keep PostgREST's schema cache in sync after publishing the multi-ownership guideline RPC.
-- This is operational only: it does not change tables, data, permissions, or function semantics.
select pg_notify('pgrst', 'reload schema');
