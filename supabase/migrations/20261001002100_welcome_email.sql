-- When the welcome email from Mhenuter was sent, so each founder gets it once.
-- Written only by server code (founders have no update grant on it).
alter table public.profiles add column if not exists welcome_email_sent_at timestamptz;

-- Accounts that existed before this email was introduced don't get it.
update public.profiles set welcome_email_sent_at = created_at where welcome_email_sent_at is null;

notify pgrst, 'reload schema';
