-- First slice of the funnel spine: analysis_runs, kpis, agent_logs.
-- Contract: context/product/pipeline-rules.md (run state machine, KPI row shape).
-- Access model: RLS is the boundary. Owners read their run + kpis; nobody but the
-- service role (trigger/ tasks, webhooks) writes anything or reads agent_logs.

create type public.run_status as enum (
  'queued', 'researching', 'extracting', 'benchmarking', 'matching', 'generating',
  'completed', 'failed', 'no_data'
);
create type public.processor_tier as enum ('base', 'ultra');
create type public.kpi_origin as enum ('web', 'upload', 'client');
create type public.confidence_level as enum ('low', 'medium', 'high');
create type public.log_level as enum ('info', 'warn', 'error');

create table public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_name text not null check (length(btrim(company_name)) > 0),
  company_domain text,
  status public.run_status not null default 'queued',
  processor public.processor_tier not null default 'ultra',
  cache_key text not null check (length(cache_key) > 0),
  uploaded_report_path text,
  research jsonb,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index analysis_runs_user_id_idx on public.analysis_runs (user_id, created_at desc);
create index analysis_runs_cache_key_idx on public.analysis_runs (cache_key, created_at desc)
  where status = 'completed';

create table public.kpis (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.analysis_runs (id) on delete cascade,
  metric text not null,
  value numeric,
  unit text,
  period text,
  source_url text,
  source_excerpt text,
  confidence public.confidence_level not null,
  origin public.kpi_origin not null,
  created_at timestamptz not null default now(),
  -- one row per metric per run; client rows win conflicts at write time (stage 2)
  unique (run_id, metric)
);
create index kpis_run_id_idx on public.kpis (run_id);

create table public.agent_logs (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.analysis_runs (id) on delete cascade,
  stage text not null,
  level public.log_level not null default 'info',
  message text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index agent_logs_run_id_idx on public.agent_logs (run_id, created_at);

-- RLS ------------------------------------------------------------------------

alter table public.analysis_runs enable row level security;
alter table public.kpis enable row level security;
alter table public.agent_logs enable row level security;

-- Writes are service-role only: no write policies, and the grant is removed too,
-- so a future policy mistake cannot reopen writes by accident.
revoke insert, update, delete, truncate, references, trigger
  on public.analysis_runs, public.kpis, public.agent_logs
  from anon, authenticated;
revoke all on public.agent_logs from anon, authenticated;

create policy "owner reads own runs"
  on public.analysis_runs for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "owner reads kpis of own runs"
  on public.kpis for select
  to authenticated
  using (
    exists (
      select 1 from public.analysis_runs r
      where r.id = kpis.run_id and r.user_id = (select auth.uid())
    )
  );

-- agent_logs: no policies — pipeline internals never reach a client.
