-- Shared helpers used by every table.

create extension if not exists pgcrypto with schema extensions;

-- Functions that RLS policies call live in a schema that is not exposed
-- through the PostgREST API.
create schema if not exists private;
grant usage on schema private to authenticated, service_role;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
