-- Profiles and roles. Contract: context/product/auth.md (Profiles and roles).
-- A row per auth user, created by trigger; role and expert_status are set only
-- through the service role. Locked in the same migration so there is never a
-- window in which a user can promote themselves.

create type public.user_role as enum ('client', 'expert', 'admin');
create type public.expert_status as enum ('none', 'pending', 'approved', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'client',
  expert_status public.expert_status not null default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;
alter function public.handle_new_user() owner to postgres;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Lock ------------------------------------------------------------------------
-- New tables are not auto-exposed to the Data API roles, so grants are explicit.
-- authenticated: select own row only. No insert/delete. No update either: every
-- current column is privileged or system-managed, so the "non-privileged
-- columns" column grant from auth.md is empty today — add a column grant plus an
-- update policy when the first user-editable column lands.

alter table public.profiles enable row level security;

revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to service_role;

create policy "user reads own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);
