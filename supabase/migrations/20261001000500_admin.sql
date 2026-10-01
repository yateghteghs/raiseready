-- Admin role seeding. Admin access is enforced server-side by checking
-- profiles.role; this function is the supported way to grant it.
-- Run from the Supabase SQL editor (as postgres):
--   select private.set_user_role('you@example.com', 'admin');
-- or with `npm run db:seed-admin -- you@example.com`.

create or replace function private.set_user_role(p_email text, p_role text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if p_role not in ('founder', 'admin') then
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
