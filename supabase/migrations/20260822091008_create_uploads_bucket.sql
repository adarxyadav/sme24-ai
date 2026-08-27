-- Uploaded-report override (t-020-spec.md; stage 1 step 4 in pipeline-rules.md).
-- A private bucket for client PDFs: uploaded by the service role from
-- app/api/uploads after the session is verified, read only by the pipeline.
-- No storage policy of any kind for clients: the document is consumed by
-- stage 1 and surfaces in the report only as findings with origin 'upload'.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('uploads', 'uploads', false, 20971520, array['application/pdf']);

-- create_analysis_run learns the path, so the row and its client inputs are
-- still one write (t-003-spec.md D9). Dropped and recreated rather than
-- overloaded: one signature, one caller.
drop function public.create_analysis_run(uuid, text, text, text, jsonb);

create function public.create_analysis_run(
  p_user_id uuid,
  p_company_name text,
  p_company_domain text,
  p_cache_key text,
  p_kpis jsonb default '[]'::jsonb,
  p_uploaded_report_path text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_run_id uuid;
begin
  insert into public.analysis_runs
    (user_id, company_name, company_domain, cache_key, uploaded_report_path)
  values (p_user_id, p_company_name, p_company_domain, p_cache_key, p_uploaded_report_path)
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

revoke all on function public.create_analysis_run(uuid, text, text, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.create_analysis_run(uuid, text, text, text, jsonb, text)
  to service_role;
