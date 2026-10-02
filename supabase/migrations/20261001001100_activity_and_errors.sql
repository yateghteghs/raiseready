-- Sign-in history, daily activity and an error log for the admin area.
-- All three are written only by server code and kept for 90 days
-- (private.prune_activity). Idempotent: safe to run more than once.

------------------------------------------------------------------------------
-- profiles.last_seen_at
------------------------------------------------------------------------------
alter table public.profiles add column if not exists last_seen_at timestamptz;

------------------------------------------------------------------------------
-- sign_in_events: one row per sign-in attempt
------------------------------------------------------------------------------
create table if not exists public.sign_in_events (
  id uuid primary key default gen_random_uuid(),
  -- null for failed attempts on an unknown email
  user_id uuid references public.profiles (id) on delete cascade,
  -- sha-256 of the lower-cased email, so failed attempts can be counted per
  -- account without storing the address itself
  email_hash text not null,
  succeeded boolean not null,
  -- where they signed in: the founder login or the admin login
  surface text not null check (surface in ('app', 'admin')),
  failure_code text check (char_length(failure_code) <= 60),
  -- browser and device family only, e.g. "Chrome on Android"
  device text check (char_length(device) <= 80),
  created_at timestamptz not null default now()
);
create index if not exists sign_in_events_user_idx on public.sign_in_events (user_id, created_at desc);
create index if not exists sign_in_events_email_idx on public.sign_in_events (email_hash, created_at desc);
create index if not exists sign_in_events_created_idx on public.sign_in_events (created_at);

------------------------------------------------------------------------------
-- user_activity_days: which days each founder used the app
------------------------------------------------------------------------------
create table if not exists public.user_activity_days (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);
create index if not exists user_activity_days_day_idx on public.user_activity_days (day);

------------------------------------------------------------------------------
-- app_errors: server and browser errors, for the admin Errors page
------------------------------------------------------------------------------
create table if not exists public.app_errors (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('server', 'browser')),
  -- the "Reference" shown to the user on the error page
  digest text check (char_length(digest) <= 100),
  message text not null check (char_length(message) <= 2000),
  path text check (char_length(path) <= 500),
  route_type text check (char_length(route_type) <= 40),
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists app_errors_created_idx on public.app_errors (created_at desc);
create index if not exists app_errors_digest_idx on public.app_errors (digest);

------------------------------------------------------------------------------
-- Server-only: no browser access at all
------------------------------------------------------------------------------
alter table public.sign_in_events enable row level security;
alter table public.user_activity_days enable row level security;
alter table public.app_errors enable row level security;
revoke all on public.sign_in_events, public.user_activity_days, public.app_errors from anon, authenticated;
grant all on public.sign_in_events, public.user_activity_days, public.app_errors to service_role;

------------------------------------------------------------------------------
-- 90-day retention
------------------------------------------------------------------------------
create or replace function private.prune_activity()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.sign_in_events where created_at < now() - interval '90 days';
  delete from public.user_activity_days where day < (now() - interval '90 days')::date;
  delete from public.app_errors where created_at < now() - interval '90 days';
$$;
revoke all on function private.prune_activity() from public;

-- Callable by the server (service role) through the API.
create or replace function public.prune_activity()
returns void
language sql
security definer
set search_path = ''
as $$ select private.prune_activity(); $$;
revoke all on function public.prune_activity() from public, anon, authenticated;
grant execute on function public.prune_activity() to service_role;
