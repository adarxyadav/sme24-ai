-- Admin surface (t-022-spec.md; auth.md): admins read everything through RLS,
-- never through the service role in a page. is_admin() reads the caller's own
-- profile as security definer so a policy can ask it without granting
-- profiles-wide select. Writes stay service-role (the admin Server Action).

create function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
$$;
alter function public.is_admin() owner to postgres;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create policy "admin reads all runs" on public.analysis_runs for select to authenticated using (public.is_admin());
create policy "admin reads all kpis" on public.kpis for select to authenticated using (public.is_admin());
create policy "admin reads all benchmarks" on public.benchmarks for select to authenticated using (public.is_admin());
create policy "admin reads all matches" on public.expert_matches for select to authenticated using (public.is_admin());
create policy "admin reads all proposals" on public.proposals for select to authenticated using (public.is_admin());
create policy "admin reads all experts" on public.experts for select to authenticated using (public.is_admin());
create policy "admin reads all profiles" on public.profiles for select to authenticated using (public.is_admin());

-- agent_logs had no client grant at all ("clients never see pipeline
-- internals"). Admins are not clients: the grant is restored for
-- authenticated and the only policy is the admin one, so a client session
-- still reads zero rows.
grant select on public.agent_logs to authenticated;
create policy "admin reads agent logs" on public.agent_logs for select to authenticated using (public.is_admin());

-- Emails live in auth.users, which no client role can read. One projection,
-- admin-gated inside the function.
create function public.admin_list_users()
returns table (id uuid, email text, role public.user_role, expert_status public.expert_status, created_at timestamptz)
language sql
security definer
set search_path = ''
stable
as $$
  select u.id, u.email::text, p.role, p.expert_status, u.created_at
  from auth.users u
  join public.profiles p on p.id = u.id
  where public.is_admin()
  order by u.created_at desc
$$;
alter function public.admin_list_users() owner to postgres;
revoke execute on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;
