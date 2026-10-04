-- Every email RaiseReady hands to Mailtrap, and whether Mailtrap accepted it,
-- so staff can see what happened when someone says an email never arrived.
-- Server-only; kept 90 days with the other activity records.
create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  to_email text not null check (char_length(to_email) <= 320),
  category text not null check (char_length(category) <= 80),
  sender text not null check (char_length(sender) <= 320),
  accepted boolean not null,
  -- Mailtrap's message id when accepted, its reason when not.
  message_id text check (char_length(message_id) <= 200),
  reason text check (char_length(reason) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists email_log_created_idx on public.email_log (created_at desc);
create index if not exists email_log_to_idx on public.email_log (lower(to_email), created_at desc);

alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;

create or replace function private.prune_activity()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.sign_in_events where created_at < now() - interval '90 days';
  delete from public.user_activity_days where day < (now() - interval '90 days')::date;
  delete from public.app_errors where created_at < now() - interval '90 days';
  delete from public.email_log where created_at < now() - interval '90 days';
$$;
revoke all on function private.prune_activity() from public;

notify pgrst, 'reload schema';
