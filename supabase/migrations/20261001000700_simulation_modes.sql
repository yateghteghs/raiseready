-- "Practise this question again" (spec 2.8): a drill is a one-question
-- simulation that re-asks a question from an earlier session.
alter table public.simulations
  add column if not exists mode text not null default 'full',
  add column if not exists source_turn_id uuid references public.simulation_turns (id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'simulations_mode_check') then
    alter table public.simulations add constraint simulations_mode_check check (mode in ('full', 'drill'));
  end if;
end;
$$;

create index if not exists simulations_source_turn_id_idx on public.simulations (source_turn_id);

notify pgrst, 'reload schema';
