-- Super admin role, in-app notifications, landing-page showcase and the
-- report signature. Idempotent: safe to run more than once.

------------------------------------------------------------------------------
-- super_admin role (above admin)
------------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('founder', 'viewer', 'support', 'admin', 'super_admin'));

create or replace function private.set_user_role(p_email text, p_role text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if p_role not in ('founder', 'viewer', 'support', 'admin', 'super_admin') then
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
-- notifications: messages from staff to one founder or to everyone
------------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  -- null = sent to everyone
  user_id uuid references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 2000),
  -- optional link inside the app, e.g. /app/billing
  link text check (link is null or (link like '/%' and link not like '//%')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notifications_user_id_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_created_at_idx on public.notifications (created_at desc);

create table if not exists public.notification_reads (
  notification_id uuid not null references public.notifications (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);
create index if not exists notification_reads_user_id_idx on public.notification_reads (user_id);

alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;
revoke all on public.notifications, public.notification_reads from anon, authenticated;
grant all on public.notifications, public.notification_reads to service_role;
grant select on public.notifications, public.notification_reads to authenticated;

drop policy if exists "notifications: recipients can read" on public.notifications;
create policy "notifications: recipients can read"
  on public.notifications for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));

drop policy if exists "notification_reads: owner can read" on public.notification_reads;
create policy "notification_reads: owner can read"
  on public.notification_reads for select to authenticated
  using (user_id = (select auth.uid()));

drop trigger if exists set_updated_at on public.notifications;
create trigger set_updated_at before update on public.notifications
  for each row execute function private.set_updated_at();

------------------------------------------------------------------------------
-- showcase: startup logos, testimonials and partners on the public site
------------------------------------------------------------------------------
create table if not exists public.showcase_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('logo', 'testimonial', 'partner')),
  name text not null check (char_length(name) between 1 and 120),
  quote text check (char_length(quote) <= 600),
  person_name text check (char_length(person_name) <= 120),
  person_title text check (char_length(person_title) <= 120),
  url text check (url is null or url like 'https://%'),
  image_path text,
  -- staff confirm the company/person agreed to be shown
  permission_confirmed boolean not null default false,
  published boolean not null default false check (not published or permission_confirmed),
  position integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists showcase_items_kind_idx on public.showcase_items (kind, position);

alter table public.showcase_items enable row level security;
revoke all on public.showcase_items from anon, authenticated;
grant all on public.showcase_items to service_role;
grant select on public.showcase_items to anon, authenticated;

drop policy if exists "showcase: anyone can read published items" on public.showcase_items;
create policy "showcase: anyone can read published items"
  on public.showcase_items for select to anon, authenticated
  using (published);

drop trigger if exists set_updated_at on public.showcase_items;
create trigger set_updated_at before update on public.showcase_items
  for each row execute function private.set_updated_at();

-- Public bucket: these images are shown on the public website.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('showcase', 'showcase', true, 2097152, array['image/png', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

------------------------------------------------------------------------------
-- report signature: one row, server-only
------------------------------------------------------------------------------
create table if not exists public.report_signature (
  id integer primary key default 1 check (id = 1),
  signer_name text check (char_length(signer_name) <= 120),
  signer_title text check (char_length(signer_title) <= 120),
  signature_path text,
  enabled boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.report_signature enable row level security;
revoke all on public.report_signature from anon, authenticated;
grant all on public.report_signature to service_role;

drop trigger if exists set_updated_at on public.report_signature;
create trigger set_updated_at before update on public.report_signature
  for each row execute function private.set_updated_at();
