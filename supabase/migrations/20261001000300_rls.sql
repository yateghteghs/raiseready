-- Row Level Security (spec section 8).
--
-- Access model:
--   * Founders (role `authenticated`) can only see rows they own.
--   * Founders may directly write only what they author: their profile's
--     editable fields, their startups, and their document records.
--   * Everything derived by the app (extractions, scores, simulations,
--     reports), all billing state, AI usage and audit logs are written only by
--     server code using the service role, which bypasses RLS.
--   * Admin views read through the service role on the server; there are no
--     admin RLS policies, so an `admin` profile gets no extra access from the
--     browser.
--   * `anon` has no table access at all.

------------------------------------------------------------------------------
-- Ownership helpers. SECURITY DEFINER so policies on child tables do not
-- recurse through the startups policy; each checks auth.uid() explicitly.
------------------------------------------------------------------------------
create or replace function private.owns_startup(p_startup_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.startups s
    where s.id = p_startup_id and s.owner_id = (select auth.uid())
  );
$$;

create or replace function private.owns_simulation(p_simulation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.simulations sim
    join public.startups s on s.id = sim.startup_id
    where sim.id = p_simulation_id and s.owner_id = (select auth.uid())
  );
$$;

revoke all on function private.owns_startup(uuid) from public;
revoke all on function private.owns_simulation(uuid) from public;
grant execute on function private.owns_startup(uuid) to authenticated;
grant execute on function private.owns_simulation(uuid) to authenticated;
revoke all on function private.set_updated_at() from public;
revoke all on function private.handle_new_user() from public;

------------------------------------------------------------------------------
-- Enable RLS everywhere and reset privileges to least privilege.
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
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end;
$$;

------------------------------------------------------------------------------
-- profiles: read own; update only non-privileged columns.
-- role, plan and credits can never be changed from the browser.
------------------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (full_name, country, onboarding_complete) on public.profiles to authenticated;

drop policy if exists "profiles: owner can read" on public.profiles;
create policy "profiles: owner can read"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "profiles: owner can update" on public.profiles;
create policy "profiles: owner can update"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

------------------------------------------------------------------------------
-- startups: full CRUD on own rows.
------------------------------------------------------------------------------
grant select, insert, update, delete on public.startups to authenticated;

drop policy if exists "startups: owner can read" on public.startups;
create policy "startups: owner can read"
  on public.startups for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "startups: owner can insert" on public.startups;
create policy "startups: owner can insert"
  on public.startups for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "startups: owner can update" on public.startups;
create policy "startups: owner can update"
  on public.startups for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "startups: owner can delete" on public.startups;
create policy "startups: owner can delete"
  on public.startups for delete to authenticated
  using (owner_id = (select auth.uid()));

------------------------------------------------------------------------------
-- documents: read and delete own. Inserts and status updates happen on the
-- server after the file's content type has been validated.
------------------------------------------------------------------------------
grant select, delete on public.documents to authenticated;

drop policy if exists "documents: owner can read" on public.documents;
create policy "documents: owner can read"
  on public.documents for select to authenticated
  using ((select private.owns_startup(startup_id)));

drop policy if exists "documents: owner can delete" on public.documents;
create policy "documents: owner can delete"
  on public.documents for delete to authenticated
  using ((select private.owns_startup(startup_id)));

------------------------------------------------------------------------------
-- Derived, startup-scoped data: read-only for the owner.
------------------------------------------------------------------------------
grant select on public.knowledge_profiles, public.assessments,
  public.simulations, public.reports to authenticated;

drop policy if exists "knowledge_profiles: owner can read" on public.knowledge_profiles;
create policy "knowledge_profiles: owner can read"
  on public.knowledge_profiles for select to authenticated
  using ((select private.owns_startup(startup_id)));

drop policy if exists "assessments: owner can read" on public.assessments;
create policy "assessments: owner can read"
  on public.assessments for select to authenticated
  using ((select private.owns_startup(startup_id)));

drop policy if exists "simulations: owner can read" on public.simulations;
create policy "simulations: owner can read"
  on public.simulations for select to authenticated
  using ((select private.owns_startup(startup_id)));

drop policy if exists "reports: owner can read" on public.reports;
create policy "reports: owner can read"
  on public.reports for select to authenticated
  using ((select private.owns_startup(startup_id)));

grant select on public.simulation_turns, public.red_flags to authenticated;

drop policy if exists "simulation_turns: owner can read" on public.simulation_turns;
create policy "simulation_turns: owner can read"
  on public.simulation_turns for select to authenticated
  using ((select private.owns_simulation(simulation_id)));

drop policy if exists "red_flags: owner can read" on public.red_flags;
create policy "red_flags: owner can read"
  on public.red_flags for select to authenticated
  using ((select private.owns_simulation(simulation_id)));

------------------------------------------------------------------------------
-- Billing: read own history; written only by the server (Paystack webhook).
------------------------------------------------------------------------------
grant select on public.payments, public.subscriptions to authenticated;

drop policy if exists "payments: owner can read" on public.payments;
create policy "payments: owner can read"
  on public.payments for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "subscriptions: owner can read" on public.subscriptions;
create policy "subscriptions: owner can read"
  on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

-- ai_calls and audit_logs: no policies => no access except service role.
