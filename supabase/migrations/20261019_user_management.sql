-- User management for Doji Print: access is granted by an administrator.
--
-- Anyone can sign in with Google, but only users with status 'active' in public.app_users can read or write
-- data. New sign-ins register themselves as 'pending' (register_login) and wait for an admin.
--
-- BEFORE RUNNING: set the admin email(s) in section 3 to the exact Google account you sign in with.
-- Run the whole file in the Supabase SQL editor (it is one transaction: if anything fails nothing is applied).
-- Replaces the earlier "allowed_users" proposal: do not run both.

begin;

-- 1) Users table. Never exposed directly: reads are admin-only, writes go through the functions below.
create table if not exists public.app_users (
  email         text primary key check (email = lower(email)),
  user_id       uuid,
  full_name     text,
  avatar_url    text,
  role          text not null default 'user'    check (role in ('admin', 'user')),
  status        text not null default 'pending' check (status in ('pending', 'active', 'blocked')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  last_login_at timestamptz
);

alter table public.app_users enable row level security;
revoke all on public.app_users from anon, authenticated;
grant select on public.app_users to authenticated;

-- 2) Helper functions (SECURITY DEFINER: they read app_users on behalf of the caller).
--    The provider check blocks accounts created with another login method that merely claim someone's email.
create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.app_users
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
      and status = 'active'
      and coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', '') = 'google'
  );
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.app_users
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
      and status = 'active'
      and role = 'admin'
      and coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', '') = 'google'
  );
$$;

-- Called by the app after every login: registers the account (as 'pending' if new) and returns its access.
create or replace function public.register_login(p_full_name text default null, p_avatar_url text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_result jsonb;
begin
  if v_email = '' or coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', '') <> 'google' then
    raise exception 'Se requiere una cuenta de Google' using errcode = '42501';
  end if;

  insert into public.app_users (email, user_id, full_name, avatar_url, last_login_at)
  values (v_email, auth.uid(), left(p_full_name, 200), left(p_avatar_url, 500), now())
  on conflict (email) do update
    set user_id       = excluded.user_id,
        full_name     = coalesce(excluded.full_name, public.app_users.full_name),
        avatar_url    = coalesce(excluded.avatar_url, public.app_users.avatar_url),
        last_login_at = now();

  select jsonb_build_object('status', u.status, 'role', u.role) into v_result
  from public.app_users u where u.email = v_email;
  return v_result;
end;
$$;

-- Admin: invite, approve, block, unblock or change the role of an account (creates it if it doesn't exist).
-- An admin cannot block or demote themselves, so at least one active admin always remains.
create or replace function public.admin_upsert_user(p_email text, p_role text, p_status text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_me    text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if not public.is_admin() then
    raise exception 'Solo los administradores pueden gestionar usuarios' using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'El email no es válido';
  end if;
  if p_role not in ('admin', 'user') or p_status not in ('pending', 'active', 'blocked') then
    raise exception 'Rol o estado inválido';
  end if;
  if v_email = v_me and (p_role <> 'admin' or p_status <> 'active') then
    raise exception 'No podés quitarte a vos mismo el acceso ni el rol de administrador';
  end if;

  insert into public.app_users (email, role, status)
  values (v_email, p_role, p_status)
  on conflict (email) do update
    set role = excluded.role, status = excluded.status, updated_at = now();
end;
$$;

-- Admin: remove an account from the list (it can sign in again and will be 'pending').
create or replace function public.admin_delete_user(p_email text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if not public.is_admin() then
    raise exception 'Solo los administradores pueden gestionar usuarios' using errcode = '42501';
  end if;
  if v_email = lower(coalesce(auth.jwt() ->> 'email', '')) then
    raise exception 'No podés eliminarte a vos mismo';
  end if;
  delete from public.app_users where email = v_email;
end;
$$;

revoke all on function public.is_active_user() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.register_login(text, text) from public, anon;
revoke all on function public.admin_upsert_user(text, text, text) from public, anon;
revoke all on function public.admin_delete_user(text) from public, anon;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.register_login(text, text) to authenticated;
grant execute on function public.admin_upsert_user(text, text, text) to authenticated;
grant execute on function public.admin_delete_user(text) to authenticated;

drop policy if exists "Admins can read users" on public.app_users;
create policy "Admins can read users" on public.app_users
  for select to authenticated using (public.is_admin());

-- 3) Initial data. EDIT THE ADMIN EMAIL(S) FIRST.
--    If you lock yourself out, fix it from the SQL editor (it bypasses RLS):
--      update public.app_users set role = 'admin', status = 'active' where email = 'you@example.com';
insert into public.app_users (email, role, status) values
  ('kelmnahuel@gmail.com', 'admin', 'active')
on conflict (email) do update set role = 'admin', status = 'active', updated_at = now();

-- Accounts that already signed in stay 'pending' until an admin approves them from the app.
insert into public.app_users (email, user_id, full_name, avatar_url, last_login_at, status)
select lower(u.email), u.id, u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'avatar_url',
       u.last_sign_in_at, 'pending'
from auth.users u
where u.email is not null
on conflict (email) do nothing;

-- 4) Data tables: only active users, and only the columns the app needs to change.
drop policy if exists "Printers readable by authenticated" on public.printers;
drop policy if exists "Printers updatable by authenticated" on public.printers;
drop policy if exists "Printers readable by active users" on public.printers;
drop policy if exists "Printers updatable by active users" on public.printers;
create policy "Printers readable by active users" on public.printers
  for select to authenticated using (public.is_active_user());
create policy "Printers updatable by active users" on public.printers
  for update to authenticated using (public.is_active_user()) with check (public.is_active_user());
-- Supabase grants ALL on new tables (including DELETE and TRUNCATE, which ignores RLS): keep only what the app uses.
revoke all on public.printers from anon, authenticated;
grant select on public.printers to authenticated;
grant update (filament_cost_per_kg, electricity_cost_kwh, printer_power, printer_lifespan,
              printer_cost, failure_rate_percent, updated_at) on public.printers to authenticated;

drop policy if exists "Quotations readable by authenticated" on public.quotations;
drop policy if exists "Quotations insertable by authenticated" on public.quotations;
drop policy if exists "Quotations updatable by authenticated" on public.quotations;
drop policy if exists "Quotations readable by active users" on public.quotations;
drop policy if exists "Quotations insertable by active users" on public.quotations;
drop policy if exists "Quotations updatable by active users" on public.quotations;
create policy "Quotations readable by active users" on public.quotations
  for select to authenticated using (public.is_active_user());
create policy "Quotations insertable by active users" on public.quotations
  for insert to authenticated with check (public.is_active_user() and auth.uid() = user_id);
create policy "Quotations updatable by active users" on public.quotations
  for update to authenticated using (public.is_active_user()) with check (public.is_active_user());
revoke all on public.quotations from anon, authenticated;
grant select, insert on public.quotations to authenticated;
grant update (status, updated_at) on public.quotations to authenticated;

commit;
