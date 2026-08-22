-- Escalation (pipeline-rules.md; t-021-spec.md): `processor: 'base'` exists
-- only by explicit override, and the route's one write must carry it, so
-- create_analysis_run takes the tier. Dropped and recreated: one signature.

drop function public.create_analysis_run(uuid, text, text, text, jsonb, text);

create function public.create_analysis_run(
  p_user_id uuid,
  p_company_name text,
  p_company_domain text,
  p_cache_key text,
  p_kpis jsonb default '[]'::jsonb,
  p_uploaded_report_path text default null,
  p_processor public.processor_tier default 'ultra'
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_run_id uuid;
begin
  insert into public.analysis_runs
    (user_id, company_name, company_domain, cache_key, uploaded_report_path, processor)
  values (p_user_id, p_company_name, p_company_domain, p_cache_key, p_uploaded_report_path, p_processor)
  returning id into v_run_id;

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

revoke all on function public.create_analysis_run(uuid, text, text, text, jsonb, text, public.processor_tier)
  from public, anon, authenticated;
grant execute on function public.create_analysis_run(uuid, text, text, text, jsonb, text, public.processor_tier)
  to service_role;
