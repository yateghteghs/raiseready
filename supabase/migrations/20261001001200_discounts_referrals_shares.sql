-- Discount codes, referrals, shareable report links and dollar payments.
-- Everything here is written by server code; founders can read only their
-- own share links. Idempotent: safe to run more than once.

------------------------------------------------------------------------------
-- payments: currency and discount details
------------------------------------------------------------------------------
-- amount_kobo holds the amount in the currency's smallest unit (kobo for NGN,
-- cents for USD), which is what Paystack uses.
alter table public.payments drop constraint if exists payments_currency_check;
alter table public.payments
  add constraint payments_currency_check check (currency in ('NGN', 'USD')) not valid;
alter table public.payments add column if not exists list_amount_kobo bigint check (list_amount_kobo >= 0);
alter table public.payments add column if not exists discount_code_id uuid;
alter table public.payments add column if not exists referral_discount boolean not null default false;

------------------------------------------------------------------------------
-- discount_codes: created by super admins
------------------------------------------------------------------------------
create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'),
  description text check (char_length(description) <= 200),
  percent_off integer not null check (percent_off between 1 and 100),
  -- which products it applies to
  products text[] not null default array['pro_monthly', 'credits_3', 'credits_10']
    check (products <@ array['pro_monthly', 'credits_3', 'credits_10'] and cardinality(products) > 0),
  max_redemptions integer check (max_redemptions > 0),
  expires_at timestamptz,
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payments drop constraint if exists payments_discount_code_id_fkey;
alter table public.payments
  add constraint payments_discount_code_id_fkey foreign key (discount_code_id) references public.discount_codes (id) on delete set null;

-- One use per founder per code; recorded when the payment succeeds.
create table if not exists public.discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.discount_codes (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  payment_reference text,
  created_at timestamptz not null default now(),
  unique (code_id, user_id)
);
create index if not exists discount_redemptions_code_idx on public.discount_redemptions (code_id);

------------------------------------------------------------------------------
-- referrals
------------------------------------------------------------------------------
alter table public.profiles add column if not exists referral_code text;
alter table public.profiles drop constraint if exists profiles_referral_code_key;
alter table public.profiles add constraint profiles_referral_code_key unique (referral_code);
alter table public.profiles add column if not exists referred_by uuid;
alter table public.profiles drop constraint if exists profiles_referred_by_fkey;
alter table public.profiles
  add constraint profiles_referred_by_fkey foreign key (referred_by) references public.profiles (id) on delete set null;
alter table public.profiles drop constraint if exists profiles_not_self_referred;
alter table public.profiles add constraint profiles_not_self_referred check (referred_by is null or referred_by <> id);

-- One reward per referred founder, given on their first successful payment.
create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid references public.profiles (id) on delete set null,
  referred_id uuid references public.profiles (id) on delete set null,
  credits integer not null check (credits > 0),
  payment_reference text,
  created_at timestamptz not null default now()
);
create unique index if not exists referral_rewards_referred_idx on public.referral_rewards (referred_id);
create index if not exists referral_rewards_referrer_idx on public.referral_rewards (referrer_id);

------------------------------------------------------------------------------
-- report_shares: read-only links founders send to investors
------------------------------------------------------------------------------
create table if not exists public.report_shares (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  -- sha-256 of the secret in the link; the secret itself is never stored
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  views integer not null default 0,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists report_shares_report_idx on public.report_shares (report_id);

------------------------------------------------------------------------------
-- Access: server-only, except founders reading their own share links
------------------------------------------------------------------------------
alter table public.discount_codes enable row level security;
alter table public.discount_redemptions enable row level security;
alter table public.referral_rewards enable row level security;
alter table public.report_shares enable row level security;
revoke all on public.discount_codes, public.discount_redemptions, public.referral_rewards, public.report_shares
  from anon, authenticated;
grant all on public.discount_codes, public.discount_redemptions, public.referral_rewards, public.report_shares
  to service_role;
grant select on public.report_shares to authenticated;

drop policy if exists "report_shares: creator can read" on public.report_shares;
create policy "report_shares: creator can read"
  on public.report_shares for select to authenticated
  using (created_by = (select auth.uid()));

do $$
declare
  t text;
begin
  foreach t in array array['discount_codes', 'report_shares'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function private.set_updated_at()', t);
  end loop;
end;
$$;
