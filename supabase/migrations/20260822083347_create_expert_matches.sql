-- Stage 4 output (pipeline-rules.md, Stage 4; t-018-spec.md): the top-3
-- experts for a run. Written by the service role through one function so the
-- set is replaced atomically on a retry. Read two ways: the run's owner reads
-- its matches (and, through a second policy on experts, the matched experts'
-- rows); a matched expert reads "which runs named me" through a security
-- definer function that projects company_name and rank only — an expert never
-- holds a select on analysis_runs.

create table public.expert_matches (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.analysis_runs (id) on delete cascade,
  expert_id uuid not null references public.experts (id) on delete cascade,
  rank integer not null check (rank between 1 and 3),
  score integer not null check (score between 0 and 100),
  rationale text not null,
  created_at timestamptz not null default now(),
  unique (run_id, expert_id),
  unique (run_id, rank)
);

create index expert_matches_expert_idx on public.expert_matches (expert_id);

alter table public.expert_matches enable row level security;

revoke all on public.expert_matches from public, anon, authenticated;
grant select on public.expert_matches to authenticated;
grant select, insert, update, delete on public.expert_matches to service_role;

create policy "owner reads matches of own runs"
  on public.expert_matches for select
  to authenticated
  using (
    exists (
      select 1 from public.analysis_runs r
      where r.id = expert_matches.run_id and r.user_id = (select auth.uid())
    )
  );

-- The client may see the experts matched to a run they own — and nothing
-- about any other expert.
create policy "owner reads experts matched to own runs"
  on public.experts for select
  to authenticated
  using (
    exists (
      select 1
      from public.expert_matches m
      join public.analysis_runs r on r.id = m.run_id
      where m.expert_id = experts.id and r.user_id = (select auth.uid())
    )
  );

-- Stage 4's only write: replace the run's set in one transaction.
create function public.replace_expert_matches(
  p_run_id uuid,
  p_matches jsonb default '[]'::jsonb
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_inserted integer;
begin
  delete from public.expert_matches where run_id = p_run_id;

  insert into public.expert_matches (run_id, expert_id, rank, score, rationale)
  select
    p_run_id,
    (m ->> 'expert_id')::uuid,
    (m ->> 'rank')::integer,
    (m ->> 'score')::integer,
    m ->> 'rationale'
  from jsonb_array_elements(p_matches) as m;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;
revoke execute on function public.replace_expert_matches(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_expert_matches(uuid, jsonb) to service_role;

-- The expert's view of their matches: company and rank, nothing else from
-- the run. Keyed on auth.uid() through experts.user_id.
create function public.my_expert_matches()
returns table (run_id uuid, company_name text, rank integer, matched_at timestamptz)
language sql
security definer
set search_path = ''
stable
as $$
  select m.run_id, r.company_name, m.rank, m.created_at
  from public.expert_matches m
  join public.experts e on e.id = m.expert_id
  join public.analysis_runs r on r.id = m.run_id
  where e.user_id = auth.uid()
  order by m.created_at desc
$$;
alter function public.my_expert_matches() owner to postgres;
revoke execute on function public.my_expert_matches() from public, anon;
grant execute on function public.my_expert_matches() to authenticated;
