-- Create profiles for any auth users that signed up before the profiles table
-- and its sign-up trigger existed. Safe to run more than once.
insert into public.profiles (id, full_name)
select u.id, nullif(u.raw_user_meta_data ->> 'full_name', '')
from auth.users u
on conflict (id) do nothing;

-- Ask the Supabase Data API to pick up the new tables immediately.
notify pgrst, 'reload schema';
