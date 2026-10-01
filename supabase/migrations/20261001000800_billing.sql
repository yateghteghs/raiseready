-- Billing support (spec section 7).

-- Links a profile to its Paystack customer, so subscription events (which
-- carry only the customer) can be matched to the right account.
alter table public.profiles add column if not exists paystack_customer_code text;
create unique index if not exists profiles_paystack_customer_code_key
  on public.profiles (paystack_customer_code) where paystack_customer_code is not null;

-- What paid for each simulation, so plan allowances can be counted.
alter table public.simulations add column if not exists funded_by text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'simulations_funded_by_check') then
    alter table public.simulations add constraint simulations_funded_by_check
      check (funded_by is null or funded_by in ('free', 'pro', 'credit'));
  end if;
end;
$$;

-- Atomic credit changes. Only the server (service role) may call these.
create or replace function public.add_credits(p_user_id uuid, p_amount integer)
returns integer
language sql
security definer
set search_path = ''
as $$
  update public.profiles
  set credits = credits + p_amount
  where id = p_user_id and p_amount > 0
  returning credits;
$$;

-- Spends one credit if the user has any. Returns the new balance, or null if none was available.
create or replace function public.consume_credit(p_user_id uuid)
returns integer
language sql
security definer
set search_path = ''
as $$
  update public.profiles
  set credits = credits - 1
  where id = p_user_id and credits > 0
  returning credits;
$$;

revoke all on function public.add_credits(uuid, integer) from public, anon, authenticated;
revoke all on function public.consume_credit(uuid) from public, anon, authenticated;
grant execute on function public.add_credits(uuid, integer) to service_role;
grant execute on function public.consume_credit(uuid) to service_role;

notify pgrst, 'reload schema';
