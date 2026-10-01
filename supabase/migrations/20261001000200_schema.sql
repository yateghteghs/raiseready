-- Core RaiseReady schema (spec section 5).
-- Enumerations are text + check constraints so they can be extended by later
-- migrations without enum-type rewrites.

------------------------------------------------------------------------------
-- profiles: one row per auth user, created automatically on sign-up.
------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  country text,
  role text not null default 'founder' check (role in ('founder', 'admin')),
  plan text not null default 'free' check (plan in ('free', 'pro')),
  credits integer not null default 0 check (credits >= 0),
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

------------------------------------------------------------------------------
-- startups
------------------------------------------------------------------------------
create table public.startups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  website text,
  industry text,
  country text,
  stage text check (stage in ('idea', 'pre_seed', 'seed', 'series_a', 'other')),
  founding_year integer check (founding_year between 1900 and 2100),
  business_model text,
  revenue_monthly numeric(18, 2) check (revenue_monthly >= 0),
  revenue_currency char(3) not null default 'NGN',
  customers_count integer check (customers_count >= 0),
  growth_notes text,
  raising boolean not null default false,
  amount_seeking numeric(18, 2) check (amount_seeking >= 0),
  seeking_currency char(3) not null default 'NGN',
  funding_type text check (funding_type in ('equity', 'safe', 'convertible_note', 'grant', 'debt', 'other')),
  previously_raised boolean,
  use_of_funds text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index startups_owner_id_idx on public.startups (owner_id);

------------------------------------------------------------------------------
-- documents
------------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups (id) on delete cascade,
  kind text not null check (kind in ('pitch_deck', 'financial_model', 'business_plan', 'other')),
  original_filename text,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 20 * 1024 * 1024),
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'ready', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index documents_startup_id_idx on public.documents (startup_id);

------------------------------------------------------------------------------
-- knowledge_profiles: versioned structured extraction (spec 6.1)
------------------------------------------------------------------------------
create table public.knowledge_profiles (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups (id) on delete cascade,
  version integer not null check (version > 0),
  data jsonb not null,
  source_document_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (startup_id, version)
);

------------------------------------------------------------------------------
-- assessments (spec 6.2)
------------------------------------------------------------------------------
create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups (id) on delete cascade,
  knowledge_profile_id uuid references public.knowledge_profiles (id) on delete set null,
  overall_score integer not null check (overall_score between 0 and 100),
  band text not null check (band in ('not_ready', 'getting_there', 'nearly_ready', 'investor_ready')),
  dimension_scores jsonb not null,
  strengths jsonb not null default '[]',
  weaknesses jsonb not null default '[]',
  recommended_actions jsonb not null default '[]',
  rubric_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assessments_startup_id_created_at_idx on public.assessments (startup_id, created_at desc);
create index assessments_knowledge_profile_id_idx on public.assessments (knowledge_profile_id);

------------------------------------------------------------------------------
-- simulations (spec 6.3)
------------------------------------------------------------------------------
create table public.simulations (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups (id) on delete cascade,
  persona text not null check (persona in ('seed_vc', 'angel', 'grant_evaluator')),
  difficulty text not null check (difficulty in ('friendly', 'analytical', 'tough')),
  funding_type text,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  current_round integer not null default 1 check (current_round between 1 and 10),
  overall_score integer check (overall_score between 0 and 100),
  investor_confidence text check (investor_confidence in ('low', 'medium', 'high')),
  final_evaluation jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index simulations_startup_id_created_at_idx on public.simulations (startup_id, created_at desc);

create table public.simulation_turns (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null references public.simulations (id) on delete cascade,
  turn_index integer not null check (turn_index >= 0),
  round integer not null check (round between 1 and 10),
  role text not null check (role in ('investor', 'founder', 'system')),
  content text not null,
  evaluation jsonb,
  red_flags jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (simulation_id, turn_index)
);

create table public.red_flags (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null references public.simulations (id) on delete cascade,
  turn_id uuid references public.simulation_turns (id) on delete cascade,
  type text not null check (type in ('contradiction', 'unsupported_claim', 'weak_answer', 'missing_info')),
  severity text not null check (severity in ('low', 'medium', 'high')),
  description text not null,
  evidence jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index red_flags_simulation_id_idx on public.red_flags (simulation_id);
create index red_flags_turn_id_idx on public.red_flags (turn_id);

------------------------------------------------------------------------------
-- reports (spec 6.4)
------------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups (id) on delete cascade,
  assessment_id uuid references public.assessments (id) on delete set null,
  simulation_id uuid references public.simulations (id) on delete set null,
  content jsonb not null,
  pdf_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reports_startup_id_idx on public.reports (startup_id);
create index reports_assessment_id_idx on public.reports (assessment_id);
create index reports_simulation_id_idx on public.reports (simulation_id);

------------------------------------------------------------------------------
-- payments & subscriptions (spec 7). Written only by the server.
------------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null default 'paystack' check (provider in ('paystack')),
  reference text not null unique,
  amount_kobo bigint not null check (amount_kobo >= 0),
  currency char(3) not null default 'NGN',
  product text not null check (product in ('pro_monthly', 'credits_3', 'credits_10')),
  status text not null default 'pending' check (status in ('pending', 'success', 'failed', 'abandoned', 'reversed')),
  raw_event jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_user_id_idx on public.payments (user_id);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider_subscription_code text unique,
  status text not null check (status in ('active', 'non_renewing', 'attention', 'cancelled', 'completed')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_user_id_idx on public.subscriptions (user_id);

------------------------------------------------------------------------------
-- ai_calls: cost tracking. user_id is nulled on account deletion so aggregate
-- cost history survives without being linked to a person. No founder content
-- is stored here.
------------------------------------------------------------------------------
create table public.ai_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  purpose text not null,
  model text not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  latency_ms integer check (latency_ms >= 0),
  success boolean not null,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_calls_user_id_created_at_idx on public.ai_calls (user_id, created_at desc);
create index ai_calls_created_at_idx on public.ai_calls (created_at desc);

------------------------------------------------------------------------------
-- audit_logs: survives actor deletion (actor_id is nulled).
------------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index audit_logs_actor_id_idx on public.audit_logs (actor_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);

------------------------------------------------------------------------------
-- updated_at triggers on every table
------------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'startups', 'documents', 'knowledge_profiles', 'assessments',
    'simulations', 'simulation_turns', 'red_flags', 'reports', 'payments',
    'subscriptions', 'ai_calls', 'audit_logs'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function private.set_updated_at()', t);
  end loop;
end;
$$;

------------------------------------------------------------------------------
-- Create a profile automatically when an auth user signs up.
------------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
