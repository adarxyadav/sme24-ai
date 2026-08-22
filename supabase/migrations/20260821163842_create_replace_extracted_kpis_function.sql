-- Stage 2's single write (t-005-spec.md D2): replace a run's extracted KPI rows
-- in one transaction, never touching the client's. PostgREST has no client-side
-- transaction, so a delete that commits before an insert that fails would leave
-- a run with no web rows and no error -- the same gap create_analysis_run closes
-- for the client rows.
--
-- "Touches only non-client rows" is a property of this SQL, not of any caller:
-- the delete carries origin <> 'client' in its predicate, and the insert's
-- anti-join never attempts a metric the client already supplied, so the unique
-- (run_id, metric) constraint is never what saves the client value. Client rows
-- keep their id and created_at across any number of retries.
--
-- Not security definer, as with create_analysis_run: service_role already holds
-- delete and insert on kpis, so the function adds no authority.

create function public.replace_extracted_kpis(
  p_run_id uuid,
  p_kpis jsonb default '[]'::jsonb
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_inserted integer;
begin
  delete from public.kpis
  where run_id = p_run_id
    and origin <> 'client';

  insert into public.kpis
    (run_id, metric, value, unit, period, source_url, source_excerpt, confidence, origin)
  select
    p_run_id,
    kpi ->> 'metric',
    (kpi ->> 'value')::numeric,
    kpi ->> 'unit',
    kpi ->> 'period',
    kpi ->> 'source_url',
    kpi ->> 'source_excerpt',
    (kpi ->> 'confidence')::public.confidence_level,
    (kpi ->> 'origin')::public.kpi_origin
  from jsonb_array_elements(coalesce(p_kpis, '[]'::jsonb)) as kpi
  where (kpi ->> 'origin') <> 'client'
    and not exists (
      select 1 from public.kpis c
      where c.run_id = p_run_id
        and c.metric = kpi ->> 'metric'
    );

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.replace_extracted_kpis(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_extracted_kpis(uuid, jsonb)
  to service_role;
