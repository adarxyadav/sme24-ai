-- Expert data model (t-017-spec.md; auth.md Profiles and roles). One row per
-- user who applied; `profiles.role = 'expert'` + `expert_status = 'approved'`
-- is what admits the row to matching and to the expert surface, and only the
-- service role writes those (auth.md). Applying and editing go through
-- apply_as_expert(): a security definer function keyed on auth.uid(), so a
-- client-role Server Action never needs the service role and the status flip
-- and the profile upsert are one transaction. Same grant idiom as every table
-- here: revoke all, grant back only select.

create type public.expert_availability as enum ('available', 'limited', 'unavailable');

create table public.experts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  headline text not null check (char_length(headline) between 1 and 160),
  bio text check (char_length(bio) <= 2000),
  -- Keys from lib/experts/catalogue.ts; validated in the action, bounded here.
  competencies text[] not null check (cardinality(competencies) between 1 and 20),
  sectors text[] not null default '{}' check (cardinality(sectors) <= 25),
  languages text[] not null check (cardinality(languages) between 1 and 4),
  regions text[] not null default '{}' check (cardinality(regions) <= 4),
  years_experience integer check (years_experience between 0 and 60),
  availability public.expert_availability not null default 'available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger experts_set_updated_at
  before update on public.experts
  for each row execute function public.set_updated_at();

alter table public.experts enable row level security;

revoke all on public.experts from public, anon, authenticated;
grant select on public.experts to authenticated;
grant select, insert, update, delete on public.experts to service_role;

create policy "expert reads own row"
  on public.experts for select
  to authenticated
  using ((select auth.uid()) = user_id);

create function public.apply_as_expert(p_profile jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  insert into public.experts
    (user_id, full_name, headline, bio, competencies, sectors, languages, regions,
     years_experience, availability)
  values (
    v_uid,
    p_profile ->> 'full_name',
    p_profile ->> 'headline',
    nullif(p_profile ->> 'bio', ''),
    array(select jsonb_array_elements_text(coalesce(p_profile -> 'competencies', '[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(p_profile -> 'sectors', '[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(p_profile -> 'languages', '[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(p_profile -> 'regions', '[]'::jsonb))),
    (p_profile ->> 'years_experience')::integer,
    coalesce((p_profile ->> 'availability')::public.expert_availability, 'available')
  )
  on conflict (user_id) do update set
    full_name = excluded.full_name,
    headline = excluded.headline,
    bio = excluded.bio,
    competencies = excluded.competencies,
    sectors = excluded.sectors,
    languages = excluded.languages,
    regions = excluded.regions,
    years_experience = excluded.years_experience,
    availability = excluded.availability
  returning id into v_id;

  -- Applying moves a fresh profile to pending; approved and rejected are the
  -- admin's decisions and are never touched here.
  update public.profiles
  set expert_status = 'pending'
  where id = v_uid and expert_status = 'none';

  return v_id;
end;
$$;
alter function public.apply_as_expert(jsonb) owner to postgres;
revoke execute on function public.apply_as_expert(jsonb) from public, anon;
grant execute on function public.apply_as_expert(jsonb) to authenticated;
