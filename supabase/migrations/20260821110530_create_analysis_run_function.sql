-- The trigger route's single write (t-003-spec.md D9). PostgREST has no
-- client-side transaction, so two .insert() calls can fail between the run row
-- and the client KPI rows -- leaving a queued run whose client figures are gone.
-- Stage 1 would then research it as though the client supplied nothing, and the
-- client's own numbers, which always win conflicts, would vanish from the
-- report. One function makes both writes or neither.
--
-- Not security definer: service_role already holds insert on both tables
-- (20260821090607_revoke_anon_select_on_analysis_tables.sql), so the caller's
-- own privileges suffice and the function adds no new authority.

create function public.create_analysis_run(
  p_user_id uuid,
  p_company_name text,
  p_company_domain text,
  p_cache_key text,
  p_kpis jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_run_id uuid;
begin
  insert into public.analysis_runs (user_id, company_name, company_domain, cache_key)
  values (p_user_id, p_company_name, p_company_domain, p_cache_key)
  returning id into v_run_id;

  -- Client-supplied intake: origin 'client' and confidence 'high' are what make
  -- these rows win every later conflict (kpi-contract.md, Ask set). period is a
  -- qualifier on all seven, so it arrives once and lands on every row.
  insert into public.kpis (run_id, metric, value, period, confidence, origin)
  select
    v_run_id,
    kpi ->> 'metric',
    (kpi ->> 'value')::numeric,
    nullif(kpi ->> 'period', ''),
    'high'::public.confidence_level,
    'client'::public.kpi_origin
  from jsonb_array_elements(coalesce(p_kpis, '[]'::jsonb)) as kpi;

  return v_run_id;
end;
$$;

-- pg_default_acl grants execute on new functions to public, so the lock starts
-- by revoking all of it and grants back only the trigger route's caller.
revoke all on function public.create_analysis_run(uuid, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_analysis_run(uuid, text, text, text, jsonb)
  to service_role;
