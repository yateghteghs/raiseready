-- Staff roles, account status and profile images.
--
-- Roles: founder (default), viewer (read-only admin), support (can also
-- suspend and reactivate), admin (everything). Permissions are enforced in
-- server code (lib/admin/permissions.ts); the database only stores the role.
--
-- Status: active, suspended (blocked until reactivated, data kept) or
-- terminated (permanently blocked, data kept, email can't be reused because
-- the auth user still exists). Sign-in is also blocked with a Supabase Auth
-- ban, set by server code.
--
-- Images: profile pictures and company logos live in the private `images`
-- bucket at `{owner_id}/...`. Only server code writes the paths, after
-- checking the file's content.
-- Idempotent: safe to run more than once.

------------------------------------------------------------------------------
-- profiles: roles, status, avatar
------------------------------------------------------------------------------
-- super_admin is added by a later migration; it is listed here too so that
-- re-running setup.sql on a database that already has a super admin works.
alter table public.profiles drop constraint if exists profiles_role_check;
-- Tidy role spelling first, so the check below never trips over "Admin" or
-- " admin". NOT VALID: existing rows aren't re-checked (so re-running
-- setup.sql can't fail on live data); every new or changed role is.
update public.profiles set role = lower(trim(role)) where role <> lower(trim(role));
alter table public.profiles
  add constraint profiles_role_check check (role in ('founder', 'viewer', 'support', 'admin', 'super_admin')) not valid;

alter table public.profiles add column if not exists status text not null default 'active';
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles
  add constraint profiles_status_check check (status in ('active', 'suspended', 'terminated'));
alter table public.profiles add column if not exists status_reason text;
alter table public.profiles drop constraint if exists profiles_status_reason_check;
alter table public.profiles
  add constraint profiles_status_reason_check check (char_length(status_reason) <= 500);
alter table public.profiles add column if not exists status_changed_at timestamptz;
alter table public.profiles add column if not exists avatar_path text;

-- Founders still update only their name, country and onboarding flag.

------------------------------------------------------------------------------
-- startups: logo, written only by server code
------------------------------------------------------------------------------
alter table public.startups add column if not exists logo_path text;

-- Replace the table-wide insert/update grants with column lists that leave
-- out logo_path, so a founder can't point their logo at someone else's file.
revoke insert, update on public.startups from authenticated;
grant insert (
  owner_id, name, website, industry, country, stage, founding_year,
  business_model, revenue_monthly, revenue_currency, customers_count,
  growth_notes, raising, amount_seeking, seeking_currency, funding_type,
  previously_raised, use_of_funds
) on public.startups to authenticated;
grant update (
  name, website, industry, country, stage, founding_year,
  business_model, revenue_monthly, revenue_currency, customers_count,
  growth_notes, raising, amount_seeking, seeking_currency, funding_type,
  previously_raised, use_of_funds
) on public.startups to authenticated;

------------------------------------------------------------------------------
-- set_user_role: accept the new roles
------------------------------------------------------------------------------
create or replace function private.set_user_role(p_email text, p_role text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if p_role not in ('founder', 'viewer', 'support', 'admin') then
    raise exception 'invalid role: %', p_role;
  end if;

  select u.id into v_user_id
  from auth.users u
  where lower(u.email) = lower(p_email);

  if v_user_id is null then
    raise exception 'no user with email %', p_email;
  end if;

  update public.profiles set role = p_role where id = v_user_id;

  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (null, 'profile.role_changed', 'profile', v_user_id, jsonb_build_object('role', p_role));

  return v_user_id;
end;
$$;

revoke all on function private.set_user_role(text, text) from public;

------------------------------------------------------------------------------
-- images bucket
------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', false, 2097152, array['image/png', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "images bucket: owner can read" on storage.objects;
create policy "images bucket: owner can read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
