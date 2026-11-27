-- Schéma initial Supabase pour la partie comptes et administration.
-- À exécuter dans le SQL Editor d'un projet Supabase après vérification.
-- Ne jamais placer la clé service_role dans le navigateur ou dans GitHub.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.daily_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  created_at timestamptz not null default now(),
  unique(user_id, entry_date)
);

create table if not exists public.app_settings (
  id integer primary key default 1 check (id = 1),
  max_users integer not null default 1000 check (max_users between 2 and 100000),
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id, max_users)
values (1, 1000)
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.daily_entries enable row level security;
alter table public.app_settings enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create policy "Users read own profile" on public.profiles
for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "Users update own display name" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "Users manage own daily entries" on public.daily_entries
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Authenticated users read capacity" on public.app_settings
for select to authenticated using (true);
create policy "Admins update capacity" on public.app_settings
for update to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.create_profile_for_new_user();

-- Limite de comptes : vérification transactionnelle avant chaque inscription.
create or replace function public.enforce_user_capacity()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  configured_limit integer;
  current_count bigint;
begin
  select max_users into configured_limit
  from public.app_settings where id = 1 for update;

  select count(*) into current_count from auth.users;

  if configured_limit is not null and current_count >= configured_limit then
    raise exception 'USER_LIMIT_REACHED';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_auth_user_capacity on auth.users;
create trigger enforce_auth_user_capacity
before insert on auth.users
for each row execute procedure public.enforce_user_capacity();

-- IMPORTANT : promouvoir le compte administrateur manuellement, depuis le SQL Editor,
-- après avoir créé ce compte et vérifié son UUID :
-- update public.profiles set role = 'admin' where id = 'UUID_DU_COMPTE_ADMIN';

-- Le tableau de bord admin et l'authentification ne sont pas encore reliés à l'interface web.
-- Le schéma ci-dessus constitue la base backend à configurer et tester avant production.
