-- What each plan includes (set by super admins, defaults in code) and the
-- exchange rates used to show approximate prices in local currencies.

create table if not exists public.plan_settings (
  plan text primary key check (plan in ('free', 'pro', 'pro_plus')),
  -- Validated by the server against the plan rules schema before saving.
  config jsonb not null,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.fx_rates (
  -- ISO 4217 code, e.g. KES. NGN is included so naira prices can be converted too.
  currency text primary key check (currency ~ '^[A-Z]{3}$' and currency <> 'USD'),
  -- How much of this currency one US dollar buys.
  per_usd numeric(14, 4) not null check (per_usd > 0),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.plan_settings enable row level security;
alter table public.fx_rates enable row level security;
revoke all on public.plan_settings, public.fx_rates from anon, authenticated;

notify pgrst, 'reload schema';
