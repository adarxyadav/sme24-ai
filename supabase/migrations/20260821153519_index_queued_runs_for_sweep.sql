-- T-010: the sweeper scans for runs still `queued` past a staleness threshold,
-- every five minutes, forever. Partial on the status so the index holds only
-- runs actually awaiting a worker — a few rows in a healthy system, never the
-- completed history — and ordered by created_at, which is both the filter and
-- the sort the sweep uses.
--
-- Same idiom as analysis_runs_cache_key_idx, which is partial on
-- status = 'completed' for the cache lookup.
create index analysis_runs_queued_idx on public.analysis_runs (created_at)
  where status = 'queued';
