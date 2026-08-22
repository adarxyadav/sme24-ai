-- T-011: the Trigger.dev run currently responsible for moving the row. Written
-- inside the same conditional update that moves a run into a working status
-- (stage 1 with `researching`, stage 2 with `extracting`), so a working row
-- with a null handle means no task ever claimed it — the stalled sweeper treats
-- that as dead by construction (t-011-spec.md D1/D2).
alter table public.analysis_runs add column trigger_run_id text;

-- The stalled sweeper scans every working-status row each tick. Partial on
-- the working statuses, same idiom as analysis_runs_queued_idx (T-010).
create index analysis_runs_working_idx on public.analysis_runs (created_at)
  where status in ('researching', 'extracting', 'benchmarking', 'matching', 'generating');
