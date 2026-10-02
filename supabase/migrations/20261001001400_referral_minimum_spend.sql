-- Referral credits unlock only once the inviter has spent a minimum amount.
-- Credits earned before then are kept as "locked" and released automatically.
-- Idempotent: safe to run more than once.

alter table public.referral_settings
  add column if not exists min_spend_ngn bigint not null default 3750000 check (min_spend_ngn >= 0); -- kobo: ₦37,500
alter table public.referral_settings
  add column if not exists min_spend_usd bigint not null default 2500 check (min_spend_usd >= 0);    -- cents: $25

alter table public.referral_rewards add column if not exists status text not null default 'released';
alter table public.referral_rewards drop constraint if exists referral_rewards_status_check;
alter table public.referral_rewards
  add constraint referral_rewards_status_check check (status in ('locked', 'released'));
alter table public.referral_rewards add column if not exists released_at timestamptz;
create index if not exists referral_rewards_locked_idx on public.referral_rewards (referrer_id) where status = 'locked';
