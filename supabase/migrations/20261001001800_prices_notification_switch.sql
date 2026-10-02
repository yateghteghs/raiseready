-- Prices that super admins set (falling back to the defaults in code), and a
-- switch to turn sent notifications off without deleting them.

create table if not exists public.price_settings (
  product text not null check (product in ('pro_monthly', 'pro_plus_monthly', 'credits_3', 'credits_10', 'deck_builder')),
  currency text not null check (currency in ('NGN', 'USD')),
  -- In the currency's smallest unit (kobo, cents), as Paystack expects.
  amount integer not null check (amount between 100 and 1000000000),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (product, currency)
);
alter table public.price_settings enable row level security;
revoke all on public.price_settings from anon, authenticated;

alter table public.notifications add column if not exists active boolean not null default true;

drop policy if exists "notifications: recipients can read" on public.notifications;
create policy "notifications: recipients can read"
  on public.notifications for select to authenticated
  using (active and (user_id is null or user_id = (select auth.uid())));

notify pgrst, 'reload schema';
