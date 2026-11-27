-- Schéma utilisé par l'application Lentilles avec Supabase Auth.
-- La clé publishable/anon peut être dans le navigateur ; JAMAIS la service_role.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_-]{3,24}$'),
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.daily_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

alter table public.profiles enable row level security;
alter table public.daily_entries enable row level security;

create or replace function private.is_admin()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

drop policy if exists "Profiles visible to owner and admins" on public.profiles;
create policy "Profiles visible to owner and admins"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "Users read own entries and admins read all" on public.daily_entries;
create policy "Users read own entries and admins read all"
on public.daily_entries for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "Users insert own entries" on public.daily_entries;
create policy "Users insert own entries"
on public.daily_entries for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Users update own entries" on public.daily_entries;
create policy "Users update own entries"
on public.daily_entries for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Users delete own entries" on public.daily_entries;
create policy "Users delete own entries"
on public.daily_entries for delete to authenticated
using (user_id = (select auth.uid()));

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare requested_username text;
begin
  requested_username := lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)));
  if requested_username !~ '^[a-z0-9_-]{3,24}$' then
    raise exception 'INVALID_USERNAME';
  end if;
  insert into public.profiles (id, username, role)
  values (new.id, requested_username, 'user');
  return new;
end;
$$;
revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.daily_entries to authenticated;
revoke all on public.profiles from anon;
revoke all on public.daily_entries from anon;

-- Après inscription du compte admin, retrouver son UUID dans Authentication > Users,
-- puis exécuter dans le SQL Editor :
-- update public.profiles set role = 'admin' where id = 'UUID_DU_COMPTE_ADMIN';
