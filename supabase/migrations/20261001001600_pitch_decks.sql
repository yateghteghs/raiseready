-- Pitch deck builder: decks written by the AI from the founder's startup
-- profile and assessment, and the "deck_builder" one-off purchase.

-- The one-off product, alongside Pro and the credit packs.
alter table public.payments drop constraint if exists payments_product_check;
alter table public.payments
  add constraint payments_product_check
  check (product in ('pro_monthly', 'credits_3', 'credits_10', 'deck_builder')) not valid;

alter table public.discount_codes drop constraint if exists discount_codes_products_check;
alter table public.discount_codes
  add constraint discount_codes_products_check
  check (products <@ array['pro_monthly', 'credits_3', 'credits_10', 'deck_builder'] and cardinality(products) > 0) not valid;

-- Decks bought one at a time and not yet used. Written only by the server.
alter table public.profiles add column if not exists deck_credits integer not null default 0;
alter table public.profiles drop constraint if exists profiles_deck_credits_check;
alter table public.profiles add constraint profiles_deck_credits_check check (deck_credits >= 0);

create table if not exists public.pitch_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  startup_id uuid not null references public.startups (id) on delete cascade,
  status text not null default 'generating' check (status in ('generating', 'ready', 'failed')),
  -- How the deck was paid for. 'preview' decks show only their first slides
  -- until unlocked with Pro or a deck purchase.
  access text not null check (access in ('preview', 'pro', 'credit')),
  title text,
  content jsonb,
  rewrites_used integer not null default 0 check (rewrites_used >= 0),
  -- When it was unlocked, so Pro's monthly allowance can be counted.
  unlocked_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pitch_decks_startup_id_idx on public.pitch_decks (startup_id);
create index if not exists pitch_decks_user_id_idx on public.pitch_decks (user_id, unlocked_at);

drop trigger if exists set_updated_at on public.pitch_decks;
create trigger set_updated_at before update on public.pitch_decks
  for each row execute function private.set_updated_at();

alter table public.pitch_decks enable row level security;
revoke all on public.pitch_decks from anon, authenticated;
grant select on public.pitch_decks to authenticated;

drop policy if exists "pitch_decks: owner can read" on public.pitch_decks;
create policy "pitch_decks: owner can read"
  on public.pitch_decks for select to authenticated
  using ((select private.owns_startup(startup_id)));

-- Atomic deck credit changes. Only the server (service role) may call these.
create or replace function public.add_deck_credits(p_user_id uuid, p_amount integer)
returns integer
language sql
security definer
set search_path = ''
as $$
  update public.profiles
  set deck_credits = deck_credits + p_amount
  where id = p_user_id and p_amount > 0
  returning deck_credits;
$$;

-- Spends one deck credit if the user has any. Returns the new balance, or null if none was available.
create or replace function public.consume_deck_credit(p_user_id uuid)
returns integer
language sql
security definer
set search_path = ''
as $$
  update public.profiles
  set deck_credits = deck_credits - 1
  where id = p_user_id and deck_credits > 0
  returning deck_credits;
$$;

revoke all on function public.add_deck_credits(uuid, integer) from public, anon, authenticated;
revoke all on function public.consume_deck_credit(uuid) from public, anon, authenticated;
grant execute on function public.add_deck_credits(uuid, integer) to service_role;
grant execute on function public.consume_deck_credit(uuid) to service_role;

-- An FAQ entry about the deck builder. Admin edits are kept on re-runs.
insert into public.faq_items (slug, locale, category, question, answer, position, published) values
  ('pitch-deck', 'en', 'Assessment and practice', 'Can RaiseReady write my pitch deck?',
   'Yes. Under Pitch deck, RaiseReady writes an investor deck from your startup profile, your documents and your readiness assessment, with speaker notes. It never makes up numbers: anything it needs from you is marked [Add: ...]. Your first deck is a free preview of the first slides. Pro includes 3 full decks a month, or you can buy a single deck. Full decks download as PowerPoint and PDF, and you can edit every slide.', 75, true)
on conflict (slug, locale) do nothing;

notify pgrst, 'reload schema';
