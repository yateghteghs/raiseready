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
select rls_test.ok((select count(*) from storage.objects) = 0, 'anon sees no storage objects');

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
  $$update public.profiles set role = 'admin' where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '42501', 'A cannot make themself admin');
select rls_test.throws(
  $$insert into public.profiles (id) values (gen_random_uuid())$$,
  '42501', 'A cannot insert profiles');
select rls_test.throws(
  $$delete from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '42501', 'A cannot delete profiles directly');

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

-- storage
select rls_test.ok(
  (select array_agg(name) from storage.objects)
    = array['aaaaaaaa-0000-4000-8000-000000000001/aaaaaaaa-1111-4000-8000-000000000001/deck.pdf'],
  'A sees only own storage objects');
select rls_test.throws(
  $$insert into storage.objects (bucket_id, name)
    values ('documents', 'aaaaaaaa-0000-4000-8000-000000000001/aaaaaaaa-1111-4000-8000-000000000001/x.pdf')$$,
  '42501', 'A cannot upload directly to storage (server validates content)');
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
