-- Referral programme settings, edited by super admins. One row, server-only.
-- Idempotent: safe to run more than once.

create table if not exists public.referral_settings (
  id integer primary key default 1 check (id = 1),
  enabled boolean not null default true,
  -- off the invited founder's first purchase
  friend_percent_off integer not null default 10 check (friend_percent_off between 0 and 100),
  -- simulation credits for the inviter when that founder first pays
  referrer_credits integer not null default 2 check (referrer_credits between 0 and 50),
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.referral_settings (id) values (1) on conflict (id) do nothing;

alter table public.referral_settings enable row level security;
revoke all on public.referral_settings from anon, authenticated;
grant all on public.referral_settings to service_role;

drop trigger if exists set_updated_at on public.referral_settings;
create trigger set_updated_at before update on public.referral_settings
  for each row execute function private.set_updated_at();
