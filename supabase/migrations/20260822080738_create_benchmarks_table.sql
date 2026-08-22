-- Stage 3 output (pipeline-rules.md, Stage 3; t-016-spec.md). One row per run:
-- the judgment (maturity, verdict, rationale) and the stored peer list the
-- read layer re-derives rank/peer_count from. Same privilege idiom as kpis:
-- owner-select through the run, writes service-role only, and `revoke all`
-- first so pg_default_acl's open grants never survive (architecture.md).

create type public.maturity_label as enum (
  'pathological', 'reactive', 'calculative', 'proactive', 'generative'
);

create table public.benchmarks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique references public.analysis_runs(id) on delete cascade,
  -- What the peer set ranks on; null when nothing is comparable.
  rate_metric text check (rate_metric in ('TRIR', 'LTIFR')),
  peer_count integer not null default 0,
  rank integer,
  verdict text,
  maturity_label public.maturity_label,
  maturity_rationale text,
  -- { schema_version, rate_metric, company, peers[], references, industry, notes }
  per_metric_comparison jsonb not null,
  parallel_run_id text,
  created_at timestamptz not null default now()
);

alter table public.benchmarks enable row level security;

revoke all on public.benchmarks from public, anon, authenticated;
grant select on public.benchmarks to authenticated;
grant select, insert, update, delete on public.benchmarks to service_role;

create policy "owner reads benchmark of own runs"
  on public.benchmarks for select
  to authenticated
  using (
    exists (
      select 1 from public.analysis_runs r
      where r.id = benchmarks.run_id and r.user_id = (select auth.uid())
    )
  );
