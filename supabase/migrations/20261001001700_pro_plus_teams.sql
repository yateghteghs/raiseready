-- Pro Plus (a higher monthly plan) and Teams (accelerators and hubs, set up
-- by super admins; members get Pro Plus while the team is active).

-- Plans and products.
alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles
  add constraint profiles_plan_check check (plan in ('free', 'pro', 'pro_plus')) not valid;

alter table public.payments drop constraint if exists payments_product_check;
alter table public.payments
  add constraint payments_product_check
  check (product in ('pro_monthly', 'pro_plus_monthly', 'credits_3', 'credits_10', 'deck_builder')) not valid;

alter table public.discount_codes drop constraint if exists discount_codes_products_check;
alter table public.discount_codes
  add constraint discount_codes_products_check
  check (
    products <@ array['pro_monthly', 'pro_plus_monthly', 'credits_3', 'credits_10', 'deck_builder']
    and cardinality(products) > 0
  ) not valid;

-- Which plan each subscription is for, so an upgrade from Pro to Pro Plus can
-- end the old subscription without ending the new plan.
alter table public.subscriptions add column if not exists plan text not null default 'pro';
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check check (plan in ('pro', 'pro_plus'));

-- Teams. All written and read by server code only.
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  seats integer not null check (seats between 1 and 1000),
  ends_at timestamptz not null,
  -- The accelerator's own account, which sees the cohort's progress.
  owner_id uuid references public.profiles (id) on delete set null,
  -- SHA-256 of the join link's token; null when the link is turned off.
  join_token_hash text unique,
  notes text check (notes is null or char_length(notes) <= 1000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.teams;
create trigger set_updated_at before update on public.teams
  for each row execute function private.set_updated_at();

create table if not exists public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  -- A founder belongs to at most one team.
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

-- "Contact us" requests from the Teams page.
create table if not exists public.team_enquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  organisation text not null check (char_length(organisation) between 1 and 150),
  email text not null check (char_length(email) between 3 and 254),
  cohort_size integer check (cohort_size between 1 and 10000),
  message text check (message is null or char_length(message) <= 2000),
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);
create index if not exists team_enquiries_created_at_idx on public.team_enquiries (created_at desc);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_enquiries enable row level security;
revoke all on public.teams, public.team_members, public.team_enquiries from anon, authenticated;

-- FAQ entries for the new plans. Admin edits are kept on re-runs.
insert into public.faq_items (slug, locale, category, question, answer, position, published) values
  ('pro-plus', 'en', 'Pricing and payments', 'What is Pro Plus?',
   'Pro Plus is for founders in active investor meetings. It includes everything in Pro with higher limits (more practice sessions, decks and AI rewrites each month), and new premium features such as voice practice as soon as they launch, at no extra cost. You can upgrade from Pro on the Billing page.', 105, true),
  ('teams', 'en', 'Pricing and payments', 'Do you offer plans for accelerators and hubs?',
   'Yes. With Teams, an accelerator, hub or programme gets Pro Plus for every founder in its cohort, with one agreement and one invoice, and a view of each founder''s progress. Tell us about your programme on the Teams page and we''ll be in touch.', 135, true)
on conflict (slug, locale) do nothing;

notify pgrst, 'reload schema';
