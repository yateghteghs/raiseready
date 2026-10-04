-- One row per event-driven email (receipt, renewal failed, plan ended, out of
-- practice sessions), keyed so the same email is never sent twice even when
-- Paystack's webhook and the return page both report a payment.
-- Server-only: written and read with the service role.
create table if not exists public.email_events (
  key text primary key,
  user_id uuid references public.profiles (id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now()
);

create index if not exists email_events_user_idx on public.email_events (user_id);

alter table public.email_events enable row level security;
revoke all on public.email_events from anon, authenticated;

notify pgrst, 'reload schema';
