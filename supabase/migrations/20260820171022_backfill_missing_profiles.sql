-- Users created before the handle_new_user trigger existed have no profile.
-- auth.md: a missing profile is a bug, so close the gap once here.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
