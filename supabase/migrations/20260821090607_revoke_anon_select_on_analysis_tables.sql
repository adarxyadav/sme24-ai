-- create_analysis_tables revoked only the write privileges, so anon kept the
-- select that pg_default_acl grants on every new table in public. Nothing
-- leaked -- the owner policies are scoped `to authenticated`, so anon matches
-- no policy and reads zero rows -- but that left the boundary resting on RLS
-- alone. create_profiles_and_role_lock got this right the same day with
-- `revoke all` then re-grant; these two tables now follow that idiom, so anon
-- is denied at the grant before any policy is consulted.
revoke all on public.analysis_runs, public.kpis from public, anon, authenticated;

grant select on public.analysis_runs, public.kpis to authenticated;
grant select, insert, update, delete on public.analysis_runs, public.kpis to service_role;
