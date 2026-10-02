-- RLS and privilege tests (spec section 8: user A cannot read user B's
-- startups, documents, simulations or reports).
--
-- Plain SQL, no extensions required. Runs inside one transaction that is
-- rolled back, so it is safe against a local Supabase database too.
-- Any failed assertion raises an exception and aborts the run.

\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

begin;

------------------------------------------------------------------------------
-- Assertion helpers
------------------------------------------------------------------------------
create schema rls_test;
grant usage on schema rls_test to anon, authenticated, service_role;

create function rls_test.ok(cond boolean, description text)
returns void language plpgsql as $$
begin
  if cond is distinct from true then
    raise exception 'FAIL: %', description;
  end if;
  raise notice 'ok - %', description;
end;
$$;

-- Asserts that running `stmt` fails with SQLSTATE `expected_state`.
create function rls_test.throws(stmt text, expected_state text, description text)
returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlstate = expected_state then
      raise notice 'ok - %', description;
      return;
    end if;
    raise exception 'FAIL: % (got % "%", expected %)', description, sqlstate, sqlerrm, expected_state;
  end;
  raise exception 'FAIL: % (statement succeeded, expected %)', description, expected_state;
end;
$$;

-- Runs a DML statement and returns the number of rows it affected.
create function rls_test.affected(stmt text)
returns integer language plpgsql as $$
declare
  n integer;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on all functions in schema rls_test to anon, authenticated, service_role;

------------------------------------------------------------------------------
-- Fixtures (inserted as the database owner, i.e. like the server would)
------------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a@example.com', '{"full_name":"Ada Founder"}'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'b@example.com', '{}');

select rls_test.ok(
  (select count(*) from public.profiles) = 2,
  'sign-up trigger creates a profile per auth user');
select rls_test.ok(
  (select full_name from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001') = 'Ada Founder',
  'profile full_name copied from sign-up metadata');
select rls_test.ok(
  (select role = 'founder' and plan = 'free' and credits = 0 and not onboarding_complete
   from public.profiles where id = 'bbbbbbbb-0000-4000-8000-000000000002'),
  'new profiles default to founder / free / 0 credits / not onboarded');
select rls_test.ok(
  (select status = 'active' and avatar_path is null and status_reason is null
   from public.profiles where id = 'bbbbbbbb-0000-4000-8000-000000000002'),
  'new profiles are active with no picture');
select rls_test.throws(
  $$update public.profiles set role = 'owner' where id = 'bbbbbbbb-0000-4000-8000-000000000002'$$,
  '23514', 'role must be founder, viewer, support or admin');
select rls_test.throws(
  $$update public.profiles set status = 'banned' where id = 'bbbbbbbb-0000-4000-8000-000000000002'$$,
  '23514', 'status must be active, suspended or terminated');

insert into public.startups (id, owner_id, name) values
  ('aaaaaaaa-1111-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'A Startup'),
  ('bbbbbbbb-1111-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002', 'B Startup');

insert into public.documents (id, startup_id, kind, storage_path, mime_type, size_bytes) values
  ('aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000001', 'pitch_deck',
   'aaaaaaaa-0000-4000-8000-000000000001/aaaaaaaa-1111-4000-8000-000000000001/deck.pdf', 'application/pdf', 1000),
  ('bbbbbbbb-2222-4000-8000-000000000002', 'bbbbbbbb-1111-4000-8000-000000000002', 'pitch_deck',
   'bbbbbbbb-0000-4000-8000-000000000002/bbbbbbbb-1111-4000-8000-000000000002/deck.pdf', 'application/pdf', 1000);

insert into public.knowledge_profiles (id, startup_id, version, data) values
  ('aaaaaaaa-3333-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000001', 1, '{}'),
  ('bbbbbbbb-3333-4000-8000-000000000002', 'bbbbbbbb-1111-4000-8000-000000000002', 1, '{}');

insert into public.assessments (id, startup_id, knowledge_profile_id, overall_score, band, dimension_scores, rubric_version) values
  ('aaaaaaaa-4444-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000001', 'aaaaaaaa-3333-4000-8000-000000000001', 55, 'getting_there', '{}', 'v1'),
  ('bbbbbbbb-4444-4000-8000-000000000002', 'bbbbbbbb-1111-4000-8000-000000000002', 'bbbbbbbb-3333-4000-8000-000000000002', 72, 'nearly_ready', '{}', 'v1');

insert into public.simulations (id, startup_id, persona, difficulty) values
  ('aaaaaaaa-5555-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000001', 'angel', 'friendly'),
  ('bbbbbbbb-5555-4000-8000-000000000002', 'bbbbbbbb-1111-4000-8000-000000000002', 'seed_vc', 'tough');

insert into public.simulation_turns (id, simulation_id, turn_index, round, role, content) values
  ('aaaaaaaa-6666-4000-8000-000000000001', 'aaaaaaaa-5555-4000-8000-000000000001', 0, 1, 'investor', 'Tell me about A.'),
  ('bbbbbbbb-6666-4000-8000-000000000002', 'bbbbbbbb-5555-4000-8000-000000000002', 0, 1, 'investor', 'Tell me about B.');

insert into public.red_flags (simulation_id, turn_id, type, severity, description) values
  ('aaaaaaaa-5555-4000-8000-000000000001', 'aaaaaaaa-6666-4000-8000-000000000001', 'weak_answer', 'low', 'A flag'),
  ('bbbbbbbb-5555-4000-8000-000000000002', 'bbbbbbbb-6666-4000-8000-000000000002', 'contradiction', 'high', 'B flag');

insert into public.reports (startup_id, assessment_id, simulation_id, content) values
  ('aaaaaaaa-1111-4000-8000-000000000001', 'aaaaaaaa-4444-4000-8000-000000000001', 'aaaaaaaa-5555-4000-8000-000000000001', '{}'),
  ('bbbbbbbb-1111-4000-8000-000000000002', 'bbbbbbbb-4444-4000-8000-000000000002', 'bbbbbbbb-5555-4000-8000-000000000002', '{}');

insert into public.pitch_decks (user_id, startup_id, status, access, title, content) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000001', 'ready', 'preview', 'A deck', '{}'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bbbbbbbb-1111-4000-8000-000000000002', 'ready', 'pro', 'B deck', '{}');
select rls_test.throws(
  $$insert into public.pitch_decks (user_id, startup_id, access) values ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000001', 'free')$$,
  '23514', 'decks record how they were paid for');
select rls_test.throws(
  $$insert into public.payments (user_id, reference, amount_kobo, product) values ('aaaaaaaa-0000-4000-8000-000000000001', 'ref-x', 1, 'mystery')$$,
  '23514', 'payments are for known products only');

insert into public.payments (user_id, reference, amount_kobo, product) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'ref-deck', 750000, 'deck_builder'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'ref-plus', 3500000, 'pro_plus_monthly');
select rls_test.ok(rls_test.affected($$delete from public.payments where reference = 'ref-plus'$$) = 1,
  'Pro Plus is a payable product');
select rls_test.throws(
  $$update public.profiles set plan = 'platinum' where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '23514', 'plans are free, pro or pro_plus only');

insert into public.teams (id, name, seats, ends_at, owner_id) values
  ('cccccccc-7777-4000-8000-000000000001', 'Lagos Accelerator', 20, now() + interval '90 days', 'bbbbbbbb-0000-4000-8000-000000000002');
insert into public.team_members (team_id, user_id) values
  ('cccccccc-7777-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001');
select rls_test.throws(
  $$insert into public.team_members (team_id, user_id) values ('cccccccc-7777-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001')$$,
  '23505', 'a founder joins a team only once');
insert into public.team_enquiries (name, organisation, email, cohort_size) values ('Ada', 'Hub', 'ada@hub.example', 25);
select rls_test.ok(rls_test.affected($$delete from public.payments where reference = 'ref-deck'$$) = 1,
  'the deck builder is a payable product');

insert into public.payments (user_id, reference, amount_kobo, product, status) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'ref-a', 500000, 'credits_3', 'success'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'ref-b', 1500000, 'pro_monthly', 'success');

insert into public.subscriptions (user_id, provider_subscription_code, status) values
  ('bbbbbbbb-0000-4000-8000-000000000002', 'SUB_b', 'active');

insert into public.ai_calls (user_id, purpose, model, success) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'extraction', 'test-model', true),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'extraction', 'test-model', true);

insert into public.audit_logs (actor_id, action) values
  ('bbbbbbbb-0000-4000-8000-000000000002', 'test.action');

insert into public.notifications (id, user_id, title, body) values
  ('aaaaaaaa-5555-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'For A', 'Hello A'),
  ('bbbbbbbb-5555-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002', 'For B', 'Hello B'),
  ('cccccccc-5555-4000-8000-000000000003', null, 'For everyone', 'Hello all');
insert into public.notifications (user_id, title, body, active) values
  (null, 'Turned off', 'Withdrawn', false);
insert into public.price_settings (product, currency, amount) values ('pro_monthly', 'NGN', 2000000);
insert into public.fx_rates (currency, per_usd) values ('KES', 129.5);
select rls_test.throws($$insert into public.fx_rates (currency, per_usd) values ('USD', 1)$$, '23514', 'exchange rates are against the dollar, not for it');
select rls_test.throws($$insert into public.plan_settings (plan, config) values ('platinum', '{}')$$, '23514', 'plan settings exist only for real plans');
select rls_test.throws(
  $$insert into public.price_settings (product, currency, amount) values ('pro_monthly', 'EUR', 1000)$$,
  '23514', 'prices are in naira or dollars only');
insert into public.notification_reads (notification_id, user_id) values
  ('bbbbbbbb-5555-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002');

insert into public.showcase_items (kind, name, permission_confirmed, published) values
  ('logo', 'Published Co', true, true),
  ('testimonial', 'Draft Co', true, false);
select rls_test.throws(
  $$insert into public.showcase_items (kind, name, permission_confirmed, published) values ('logo', 'No Permission', false, true)$$,
  '23514', 'showcase items cannot be published without confirmed permission');
select rls_test.throws(
  $$insert into public.notifications (title, body, link) values ('x', 'y', 'https://evil.example')$$,
  '23514', 'notification links must stay inside the app');

insert into public.report_signature (id, signer_name, enabled) values (1, 'Signer', true);

insert into public.discount_codes (code, percent_off) values ('LAUNCH20', 20);
insert into public.faq_items (locale, question, answer, published) values ('fr', 'Brouillon ?', 'Pas encore.', false);
select rls_test.throws($$insert into public.faq_items (locale, question, answer) values ('de', 'Q', 'A')$$, '23514', 'FAQ entries use a supported language');
select rls_test.ok(
  (select enabled and friend_percent_off = 10 and referrer_credits = 2 from public.referral_settings where id = 1),
  'referral programme starts on, at 10% off and 2 credits');
select rls_test.ok(
  (select min_spend_ngn = 3750000 and min_spend_usd = 2500 from public.referral_settings where id = 1),
  'referral credits unlock after ₦37,500 or $25 by default');
select rls_test.throws(
  $$insert into public.referral_rewards (credits, status) values (2, 'pending')$$,
  '23514', 'referral rewards are locked or released');
select rls_test.throws($$update public.referral_settings set friend_percent_off = 150$$, '23514', 'referral discount is 0-100%');
select rls_test.throws($$insert into public.referral_settings (id) values (2)$$, '23514', 'there is only one referral settings row');
select rls_test.throws($$insert into public.discount_codes (code, percent_off) values ('bad code!', 10)$$, '23514', 'discount codes are letters, digits, - and _');
select rls_test.throws($$insert into public.discount_codes (code, percent_off) values ('FREE', 0)$$, '23514', 'discounts are 1-100%');
select rls_test.throws(
  $$insert into public.discount_codes (code, percent_off, products) values ('ODD', 10, array['pro_yearly'])$$,
  '23514', 'discounts only apply to real products');
select rls_test.throws(
  $$insert into public.payments (user_id, reference, amount_kobo, currency, product) values ('aaaaaaaa-0000-4000-8000-000000000001', 'eur-1', 100, 'EUR', 'credits_3')$$,
  '23514', 'payments are in NGN or USD');
select rls_test.throws(
  $$update public.profiles set referred_by = id where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '23514', 'founders cannot refer themselves');
insert into public.report_shares (report_id, created_by, token_hash, expires_at)
  select id, 'aaaaaaaa-0000-4000-8000-000000000001', 'share-a', now() + interval '30 days'
  from public.reports where startup_id = 'aaaaaaaa-1111-4000-8000-000000000001';
insert into public.report_shares (report_id, created_by, token_hash, expires_at)
  select id, 'bbbbbbbb-0000-4000-8000-000000000002', 'share-b', now() + interval '30 days'
  from public.reports where startup_id = 'bbbbbbbb-1111-4000-8000-000000000002';

insert into public.sign_in_events (user_id, email_hash, succeeded, surface) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'hash-a', true, 'app'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'hash-b', true, 'app'),
  (null, 'hash-a', false, 'admin');
insert into public.sign_in_events (user_id, email_hash, succeeded, surface, created_at) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'hash-a', true, 'app', now() - interval '91 days');
insert into public.user_activity_days (user_id, day) values
  ('aaaaaaaa-0000-4000-8000-000000000001', current_date),
  ('aaaaaaaa-0000-4000-8000-000000000001', current_date - 100);
insert into public.app_errors (source, digest, message) values ('server', '123', 'boom');
select rls_test.throws(
  $$insert into public.sign_in_events (email_hash, succeeded, surface) values ('x', true, 'elsewhere')$$,
  '23514', 'sign-in surface must be app or admin');
select public.prune_activity();
select rls_test.ok(
  (select count(*) from public.sign_in_events) = 3 and (select count(*) from public.user_activity_days) = 1,
  'prune_activity deletes records older than 90 days');

insert into storage.objects (bucket_id, name) values
  ('documents', 'aaaaaaaa-0000-4000-8000-000000000001/aaaaaaaa-1111-4000-8000-000000000001/deck.pdf'),
  ('documents', 'bbbbbbbb-0000-4000-8000-000000000002/bbbbbbbb-1111-4000-8000-000000000002/deck.pdf'),
  ('reports', 'bbbbbbbb-0000-4000-8000-000000000002/bbbbbbbb-1111-4000-8000-000000000002/report.pdf');

------------------------------------------------------------------------------
-- Every public table has RLS enabled
------------------------------------------------------------------------------
select rls_test.ok(
  not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  ),
  'RLS is enabled on every table in public');

select rls_test.ok(
  (select not public from storage.buckets where id = 'documents')
  and (select not public from storage.buckets where id = 'reports'),
  'storage buckets are private');

------------------------------------------------------------------------------
-- Anonymous visitors
------------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select rls_test.throws('select * from public.startups', '42501', 'anon cannot read startups');
select rls_test.throws('select * from public.profiles', '42501', 'anon cannot read profiles');
select rls_test.throws('select * from public.reports', '42501', 'anon cannot read reports');
select rls_test.throws('select * from public.pitch_decks', '42501', 'anon cannot read pitch decks');
select rls_test.throws('select * from public.teams', '42501', 'anon cannot read teams');
select rls_test.throws('select * from public.team_enquiries', '42501', 'anon cannot read team enquiries');
select rls_test.throws($$insert into public.team_enquiries (name, organisation, email) values ('x', 'y', 'z@z.z')$$, '42501', 'anon cannot write enquiries directly');
select rls_test.ok((select count(*) from storage.objects) = 0, 'anon sees no storage objects');
select rls_test.ok(
  (select array_agg(name) from public.showcase_items) = array['Published Co'],
  'anon sees only published showcase items');
select rls_test.throws('select * from public.notifications', '42501', 'anon cannot read notifications');
select rls_test.throws('select * from public.report_signature', '42501', 'anon cannot read the report signature');
select rls_test.throws('select * from public.sign_in_events', '42501', 'anon cannot read sign-in history');
select rls_test.throws('select * from public.app_errors', '42501', 'anon cannot read the error log');
select rls_test.throws('select public.prune_activity()', '42501', 'anon cannot prune activity');
select rls_test.throws('select * from public.discount_codes', '42501', 'anon cannot read discount codes');
select rls_test.ok((select count(*) from public.faq_items where locale = 'en') >= 10, 'anon can read the seeded FAQ');
select rls_test.ok((select count(*) from public.faq_items where locale = 'fr') = 0, 'anon cannot see unpublished FAQ drafts');
select rls_test.throws($$insert into public.faq_items (question, answer) values ('Spam?', 'Yes')$$, '42501', 'anon cannot add FAQ entries');
select rls_test.throws('select * from public.report_shares', '42501', 'anon cannot read share links (the server checks them)');
select rls_test.throws(
  $$insert into public.showcase_items (kind, name) values ('logo', 'Spam')$$,
  '42501', 'anon cannot add showcase items');

reset role;

------------------------------------------------------------------------------
-- User A
------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);

-- profiles
select rls_test.ok(
  (select array_agg(id) from public.profiles) = array['aaaaaaaa-0000-4000-8000-000000000001'::uuid],
  'A reads only own profile');
select rls_test.ok(
  rls_test.affected($$update public.profiles set full_name = 'Ada L.' where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$) = 1,
  'A can update own full_name');
select rls_test.ok(
  rls_test.affected($$update public.profiles set full_name = 'hacked' where id = 'bbbbbbbb-0000-4000-8000-000000000002'$$) = 0,
  'A cannot update B''s profile');
select rls_test.throws(
  $$update public.profiles set plan = 'pro' where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '42501', 'A cannot change own plan');
select rls_test.throws(
  $$update public.profiles set credits = 999 where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '42501', 'A cannot change own credits');
select rls_test.throws(
  $$update public.profiles set deck_credits = 9 where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '42501', 'A cannot change own deck credits');
select rls_test.throws(
  $$update public.profiles set role = 'admin' where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '42501', 'A cannot make themself admin');
select rls_test.throws(
  $$insert into public.profiles (id) values (gen_random_uuid())$$,
  '42501', 'A cannot insert profiles');
select rls_test.throws(
  $$delete from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '42501', 'A cannot delete profiles directly');
select rls_test.throws(
  $$update public.profiles set role = 'viewer' where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '42501', 'A cannot give themself a staff role');
select rls_test.throws(
  $$update public.profiles set status = 'active', status_reason = null where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '42501', 'A cannot change own account status (e.g. lift a suspension)');
select rls_test.throws(
  $$update public.profiles set avatar_path = 'bbbbbbbb-0000-4000-8000-000000000002/avatar.png' where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '42501', 'A cannot set own picture path (server validates images)');

-- startups
select rls_test.ok(
  (select array_agg(name) from public.startups) = array['A Startup'],
  'A reads only own startups');
select rls_test.ok(
  (select count(*) from public.startups where id = 'bbbbbbbb-1111-4000-8000-000000000002') = 0,
  'A cannot read B''s startup by id');
select rls_test.ok(
  rls_test.affected($$insert into public.startups (owner_id, name) values ('aaaaaaaa-0000-4000-8000-000000000001', 'A Second')$$) = 1,
  'A can create own startup');
select rls_test.throws(
  $$insert into public.startups (owner_id, name) values ('bbbbbbbb-0000-4000-8000-000000000002', 'Planted')$$,
  '42501', 'A cannot create a startup owned by B');
select rls_test.ok(
  rls_test.affected($$update public.startups set name = 'A Renamed' where id = 'aaaaaaaa-1111-4000-8000-000000000001'$$) = 1,
  'A can update own startup');
select rls_test.ok(
  rls_test.affected($$update public.startups set name = 'hacked' where id = 'bbbbbbbb-1111-4000-8000-000000000002'$$) = 0,
  'A cannot update B''s startup');
select rls_test.throws(
  $$update public.startups set owner_id = 'bbbbbbbb-0000-4000-8000-000000000002' where id = 'aaaaaaaa-1111-4000-8000-000000000001'$$,
  '42501', 'A cannot hand a startup to B');
select rls_test.throws(
  $$update public.startups set logo_path = 'bbbbbbbb-0000-4000-8000-000000000002/logo.png' where id = 'aaaaaaaa-1111-4000-8000-000000000001'$$,
  '42501', 'A cannot point their logo at another file (server sets logo_path)');
select rls_test.throws(
  $$insert into public.startups (owner_id, name, logo_path) values ('aaaaaaaa-0000-4000-8000-000000000001', 'Logo', 'x.png')$$,
  '42501', 'A cannot create a startup with a logo path');
select rls_test.ok(
  rls_test.affected($$delete from public.startups where id = 'bbbbbbbb-1111-4000-8000-000000000002'$$) = 0,
  'A cannot delete B''s startup');
select rls_test.ok(
  rls_test.affected($$delete from public.startups where name = 'A Second'$$) = 1,
  'A can delete own startup');

-- documents
select rls_test.ok(
  (select array_agg(id) from public.documents) = array['aaaaaaaa-2222-4000-8000-000000000001'::uuid],
  'A reads only own documents');
select rls_test.throws(
  $$insert into public.documents (startup_id, kind, storage_path, mime_type, size_bytes)
    values ('aaaaaaaa-1111-4000-8000-000000000001', 'other', 'x/y/z.pdf', 'application/pdf', 1)$$,
  '42501', 'A cannot insert document rows directly (server validates uploads)');
select rls_test.throws(
  $$update public.documents set status = 'ready' where id = 'aaaaaaaa-2222-4000-8000-000000000001'$$,
  '42501', 'A cannot change document status');
select rls_test.ok(
  rls_test.affected($$delete from public.documents where id = 'bbbbbbbb-2222-4000-8000-000000000002'$$) = 0,
  'A cannot delete B''s document');

-- derived, startup-scoped data
select rls_test.ok((select count(*) from public.knowledge_profiles) = 1
  and (select startup_id from public.knowledge_profiles) = 'aaaaaaaa-1111-4000-8000-000000000001',
  'A reads only own knowledge profiles');
select rls_test.ok((select array_agg(overall_score) from public.assessments) = array[55],
  'A reads only own assessments');
select rls_test.ok((select array_agg(id) from public.simulations) = array['aaaaaaaa-5555-4000-8000-000000000001'::uuid],
  'A reads only own simulations');
select rls_test.ok((select array_agg(content) from public.simulation_turns) = array['Tell me about A.'],
  'A reads only own simulation turns');
select rls_test.ok((select array_agg(description) from public.red_flags) = array['A flag'],
  'A reads only own red flags');
select rls_test.ok((select count(*) from public.reports) = 1
  and (select startup_id from public.reports) = 'aaaaaaaa-1111-4000-8000-000000000001',
  'A reads only own reports');
select rls_test.ok((select array_agg(title) from public.pitch_decks) = array['A deck'],
  'A reads only own pitch decks');
select rls_test.throws('select * from public.teams', '42501', 'A cannot read teams directly');
select rls_test.throws('select * from public.team_members', '42501', 'A cannot read team members directly');
select rls_test.throws(
  $$insert into public.team_members (team_id, user_id) values ('cccccccc-7777-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001')$$,
  '42501', 'A cannot join a team without the server');
select rls_test.throws(
  $$update public.pitch_decks set access = 'pro'$$,
  '42501', 'A cannot unlock a deck without paying');
select rls_test.throws(
  $$insert into public.pitch_decks (user_id, startup_id, access) values ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000001', 'pro')$$,
  '42501', 'A cannot create decks directly (usage limits)');

select rls_test.throws(
  $$insert into public.assessments (startup_id, overall_score, band, dimension_scores, rubric_version)
    values ('aaaaaaaa-1111-4000-8000-000000000001', 100, 'investor_ready', '{}', 'v1')$$,
  '42501', 'A cannot write own assessment scores');
select rls_test.throws(
  $$update public.assessments set overall_score = 100$$,
  '42501', 'A cannot edit assessment scores');
select rls_test.throws(
  $$insert into public.simulations (startup_id, persona, difficulty)
    values ('aaaaaaaa-1111-4000-8000-000000000001', 'angel', 'friendly')$$,
  '42501', 'A cannot start a simulation without the server (usage limits)');
select rls_test.throws(
  $$insert into public.simulation_turns (simulation_id, turn_index, round, role, content)
    values ('aaaaaaaa-5555-4000-8000-000000000001', 1, 1, 'founder', 'x')$$,
  '42501', 'A cannot write simulation turns directly');
select rls_test.throws(
  $$delete from public.red_flags$$,
  '42501', 'A cannot delete red flags');
select rls_test.throws(
  $$insert into public.reports (startup_id, content) values ('aaaaaaaa-1111-4000-8000-000000000001', '{}')$$,
  '42501', 'A cannot write reports directly');
select rls_test.throws(
  $$insert into public.knowledge_profiles (startup_id, version, data) values ('aaaaaaaa-1111-4000-8000-000000000001', 2, '{}')$$,
  '42501', 'A cannot write knowledge profiles directly');

-- billing
select rls_test.ok((select array_agg(reference) from public.payments) = array['ref-a'],
  'A reads only own payments');
select rls_test.ok((select count(*) from public.subscriptions) = 0,
  'A cannot read B''s subscription');
select rls_test.throws(
  $$insert into public.payments (user_id, reference, amount_kobo, product, status)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'fake', 0, 'pro_monthly', 'success')$$,
  '42501', 'A cannot record a payment');
select rls_test.throws(
  $$insert into public.subscriptions (user_id, status) values ('aaaaaaaa-0000-4000-8000-000000000001', 'active')$$,
  '42501', 'A cannot create a subscription');

-- internal tables
select rls_test.throws('select * from public.ai_calls', '42501', 'A cannot read ai_calls');
select rls_test.throws('select * from public.audit_logs', '42501', 'A cannot read audit_logs');
select rls_test.throws(
  $$insert into public.audit_logs (action) values ('forged')$$,
  '42501', 'A cannot write audit_logs');

-- private helper functions
select rls_test.ok(
  private.owns_startup('aaaaaaaa-1111-4000-8000-000000000001')
  and not private.owns_startup('bbbbbbbb-1111-4000-8000-000000000002'),
  'owns_startup reflects the caller');
select rls_test.throws(
  $$select private.set_user_role('a@example.com', 'admin')$$,
  '42501', 'A cannot call set_user_role');

-- notifications, showcase, signature
select rls_test.ok(
  (select array_agg(title order by title) from public.notifications) = array['For A', 'For everyone'],
  'A reads own and broadcast notifications, not B''s or turned-off ones');
select rls_test.throws('select * from public.price_settings', '42501', 'A cannot read price settings directly');
select rls_test.throws('select * from public.plan_settings', '42501', 'A cannot read plan settings directly');
select rls_test.throws($$insert into public.fx_rates (currency, per_usd) values ('KES', 1)$$, '42501', 'A cannot set exchange rates');
select rls_test.throws(
  $$update public.price_settings set amount = 100$$,
  '42501', 'A cannot change prices');
select rls_test.ok((select count(*) from public.notification_reads) = 0, 'A cannot see B''s read receipts');
select rls_test.throws(
  $$insert into public.notifications (user_id, title, body) values ('bbbbbbbb-0000-4000-8000-000000000002', 'Phish', 'Click')$$,
  '42501', 'A cannot send notifications');
select rls_test.throws(
  $$insert into public.notification_reads (notification_id, user_id) values ('aaaaaaaa-5555-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001')$$,
  '42501', 'A cannot write read receipts directly (server does)');
select rls_test.ok(
  (select array_agg(name) from public.showcase_items) = array['Published Co'],
  'A sees only published showcase items');
select rls_test.throws(
  $$update public.showcase_items set published = true$$,
  '42501', 'A cannot edit the showcase');
select rls_test.throws('select * from public.report_signature', '42501', 'A cannot read the report signature');
select rls_test.throws('select * from public.sign_in_events', '42501', 'A cannot read sign-in history, even their own');
select rls_test.throws('select * from public.user_activity_days', '42501', 'A cannot read activity records');
select rls_test.throws(
  $$insert into public.user_activity_days (user_id, day) values ('aaaaaaaa-0000-4000-8000-000000000001', current_date + 1)$$,
  '42501', 'A cannot write activity records');
select rls_test.throws('select * from public.app_errors', '42501', 'A cannot read the error log');
select rls_test.throws('select * from public.discount_codes', '42501', 'A cannot list discount codes');
select rls_test.throws($$update public.faq_items set answer = 'hacked'$$, '42501', 'A cannot edit the FAQ');
select rls_test.throws($$update public.referral_settings set friend_percent_off = 100$$, '42501', 'A cannot change the referral programme');
select rls_test.throws('select * from public.referral_rewards', '42501', 'A cannot read referral rewards directly');
select rls_test.ok(
  (select array_agg(token_hash) from public.report_shares) = array['share-a'],
  'A reads only own share links');
select rls_test.throws(
  $$insert into public.report_shares (report_id, created_by, token_hash, expires_at)
    select id, 'aaaaaaaa-0000-4000-8000-000000000001', 'forged', now() + interval '1 year' from public.reports limit 1$$,
  '42501', 'A cannot create share links directly (server does)');
select rls_test.throws(
  $$update public.profiles set referred_by = 'bbbbbbbb-0000-4000-8000-000000000002' where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '42501', 'A cannot set who referred them');
select rls_test.throws(
  $$update public.profiles set referral_code = 'MINE' where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '42501', 'A cannot choose their referral code');
select rls_test.throws(
  $$update public.profiles set last_seen_at = now() where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '42501', 'A cannot set last_seen_at (server does)');

-- storage
select rls_test.ok(
  (select array_agg(name) from storage.objects)
    = array['aaaaaaaa-0000-4000-8000-000000000001/aaaaaaaa-1111-4000-8000-000000000001/deck.pdf'],
  'A sees only own storage objects');
select rls_test.throws(
  $$insert into storage.objects (bucket_id, name)
    values ('documents', 'aaaaaaaa-0000-4000-8000-000000000001/aaaaaaaa-1111-4000-8000-000000000001/x.pdf')$$,
  '42501', 'A cannot upload directly to storage (server validates content)');
select rls_test.throws(
  $$insert into storage.objects (bucket_id, name)
    values ('images', 'aaaaaaaa-0000-4000-8000-000000000001/avatar.png')$$,
  '42501', 'A cannot upload images directly to storage');
select rls_test.ok(
  rls_test.affected($$delete from storage.objects where bucket_id = 'documents'$$) = 0,
  'A cannot delete storage objects directly');

reset role;

------------------------------------------------------------------------------
-- Billing: credits change only through the server's atomic functions
------------------------------------------------------------------------------
select rls_test.ok(public.add_credits('aaaaaaaa-0000-4000-8000-000000000001', 3) = 3, 'add_credits adds credits');
select rls_test.ok(public.consume_credit('aaaaaaaa-0000-4000-8000-000000000001') = 2, 'consume_credit spends one');
select rls_test.ok(public.consume_credit('bbbbbbbb-0000-4000-8000-000000000002') is null, 'consume_credit refuses at zero');
select rls_test.ok(public.add_credits('aaaaaaaa-0000-4000-8000-000000000001', -5) is null, 'add_credits ignores non-positive amounts');
select rls_test.ok(public.add_deck_credits('aaaaaaaa-0000-4000-8000-000000000001', 1) = 1, 'add_deck_credits adds a deck');
select rls_test.ok(public.consume_deck_credit('aaaaaaaa-0000-4000-8000-000000000001') = 0, 'consume_deck_credit spends one');
select rls_test.ok(public.consume_deck_credit('aaaaaaaa-0000-4000-8000-000000000001') is null, 'consume_deck_credit refuses at zero');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
select rls_test.throws(
  $$select public.add_credits('aaaaaaaa-0000-4000-8000-000000000001', 100)$$,
  '42501', 'A cannot grant themself credits');
select rls_test.throws(
  $$select public.consume_credit('bbbbbbbb-0000-4000-8000-000000000002')$$,
  '42501', 'A cannot spend credits directly');
select rls_test.throws(
  $$select public.add_deck_credits('aaaaaaaa-0000-4000-8000-000000000001', 5)$$,
  '42501', 'A cannot grant themself deck credits');
select rls_test.throws(
  $$update public.profiles set paystack_customer_code = 'CUS_x' where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '42501', 'A cannot change their Paystack customer link');
reset role;

------------------------------------------------------------------------------
-- Drills (one-question practice) follow the same isolation rules
------------------------------------------------------------------------------
insert into public.simulations (id, startup_id, persona, difficulty, mode, source_turn_id) values
  ('bbbbbbbb-7777-4000-8000-000000000002', 'bbbbbbbb-1111-4000-8000-000000000002', 'seed_vc', 'tough', 'drill', 'bbbbbbbb-6666-4000-8000-000000000002');

select rls_test.ok(
  (select mode from public.simulations where id = 'aaaaaaaa-5555-4000-8000-000000000001') = 'full',
  'simulations default to full mode');
select rls_test.throws(
  $$insert into public.simulations (startup_id, persona, difficulty, mode) values ('aaaaaaaa-1111-4000-8000-000000000001', 'angel', 'friendly', 'speedrun')$$,
  '23514', 'unknown simulation modes are rejected');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
select rls_test.ok(
  (select count(*) from public.simulations where mode = 'drill') = 0,
  'A cannot see B''s drills');
reset role;

------------------------------------------------------------------------------
-- An admin profile gets no extra access from the browser
------------------------------------------------------------------------------
select private.set_user_role('A@example.com', 'admin');
select rls_test.ok(
  (select role from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001') = 'admin',
  'set_user_role promotes by email (case-insensitive)');
select rls_test.ok(
  (select count(*) from public.audit_logs where action = 'profile.role_changed') = 1,
  'role change is audit-logged');
select rls_test.throws(
  $$select private.set_user_role('nobody@example.com', 'admin')$$,
  'P0001', 'set_user_role rejects unknown emails');
select private.set_user_role('b@example.com', 'support');
select rls_test.ok(
  (select role from public.profiles where id = 'bbbbbbbb-0000-4000-8000-000000000002') = 'support',
  'set_user_role accepts the support role');
select private.set_user_role('b@example.com', 'super_admin');
select rls_test.ok(
  (select role from public.profiles where id = 'bbbbbbbb-0000-4000-8000-000000000002') = 'super_admin',
  'set_user_role accepts the super_admin role');
select private.set_user_role('b@example.com', 'founder');
select rls_test.throws(
  $$select private.set_user_role('b@example.com', 'owner')$$,
  'P0001', 'set_user_role rejects unknown roles');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
select rls_test.ok((select count(*) from public.startups) = 1,
  'admin role does not widen RLS (admin reads go through the service role)');
reset role;

------------------------------------------------------------------------------
-- User B sees their own data and none of A's
------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}', true);

select rls_test.ok((select array_agg(name) from public.startups) = array['B Startup'],
  'B reads only own startups');
select rls_test.ok((select count(*) from public.documents where startup_id = 'aaaaaaaa-1111-4000-8000-000000000001') = 0,
  'B cannot read A''s documents');
select rls_test.ok((select count(*) from public.simulations where id = 'aaaaaaaa-5555-4000-8000-000000000001') = 0,
  'B cannot read A''s simulation');
select rls_test.ok((select count(*) from public.reports where startup_id = 'aaaaaaaa-1111-4000-8000-000000000001') = 0,
  'B cannot read A''s reports');
select rls_test.ok((select count(*) from storage.objects) = 2,
  'B sees own document and report objects');
select rls_test.ok((select count(*) from public.subscriptions) = 1,
  'B reads own subscription');

reset role;

------------------------------------------------------------------------------
-- Service role (server only) reads everything
------------------------------------------------------------------------------
set local role service_role;
select rls_test.ok((select count(*) from public.startups) = 2, 'service role reads all startups');
select rls_test.ok((select count(*) from public.ai_calls) = 2, 'service role reads ai_calls');
reset role;

------------------------------------------------------------------------------
-- Account deletion hard-deletes the user's data
------------------------------------------------------------------------------
delete from auth.users where id = 'bbbbbbbb-0000-4000-8000-000000000002';

select rls_test.ok(
  (select count(*) from public.profiles where id = 'bbbbbbbb-0000-4000-8000-000000000002') = 0
  and (select count(*) from public.startups where owner_id = 'bbbbbbbb-0000-4000-8000-000000000002') = 0
  and (select count(*) from public.documents where startup_id = 'bbbbbbbb-1111-4000-8000-000000000002') = 0
  and (select count(*) from public.knowledge_profiles where startup_id = 'bbbbbbbb-1111-4000-8000-000000000002') = 0
  and (select count(*) from public.assessments where startup_id = 'bbbbbbbb-1111-4000-8000-000000000002') = 0
  and (select count(*) from public.simulations where startup_id = 'bbbbbbbb-1111-4000-8000-000000000002') = 0
  and (select count(*) from public.simulation_turns where simulation_id = 'bbbbbbbb-5555-4000-8000-000000000002') = 0
  and (select count(*) from public.red_flags where simulation_id = 'bbbbbbbb-5555-4000-8000-000000000002') = 0
  and (select count(*) from public.reports where startup_id = 'bbbbbbbb-1111-4000-8000-000000000002') = 0
  and (select count(*) from public.payments where user_id = 'bbbbbbbb-0000-4000-8000-000000000002') = 0
  and (select count(*) from public.subscriptions where user_id = 'bbbbbbbb-0000-4000-8000-000000000002') = 0,
  'deleting an auth user cascades to all of their rows');
select rls_test.ok(
  (select count(*) from public.ai_calls where user_id is null) = 1,
  'ai_calls are kept for cost totals but unlinked from the deleted user');
select rls_test.ok(
  (select count(*) from public.audit_logs where action = 'test.action' and actor_id is null) = 1,
  'audit_logs survive actor deletion with actor unlinked');
select rls_test.ok(
  (select count(*) from public.startups) = 1,
  'other users'' data is untouched by the deletion');

\echo 'All RLS tests passed.'
rollback;
