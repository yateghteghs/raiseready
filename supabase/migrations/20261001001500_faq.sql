-- FAQ entries, edited by super admins, per language. English is the
-- fallback when a language has none. Public read for published entries.
-- Idempotent: safe to run more than once (seeded entries are added once and
-- never overwritten, so edits made in the admin area are kept).

create table if not exists public.faq_items (
  id uuid primary key default gen_random_uuid(),
  -- stable key for seeded entries, so re-running setup.sql doesn't duplicate them
  slug text check (slug ~ '^[a-z0-9-]{1,60}$'),
  locale text not null default 'en' check (locale in ('en', 'fr', 'pt', 'sw', 'ar', 'ha', 'yo', 'ig')),
  category text not null default 'General' check (char_length(category) between 1 and 60),
  question text not null check (char_length(question) between 1 and 300),
  answer text not null check (char_length(answer) between 1 and 4000),
  position integer not null default 0,
  published boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug, locale)
);
create index if not exists faq_items_locale_idx on public.faq_items (locale, position);

alter table public.faq_items enable row level security;
revoke all on public.faq_items from anon, authenticated;
grant all on public.faq_items to service_role;
grant select on public.faq_items to anon, authenticated;

drop policy if exists "faq: anyone can read published entries" on public.faq_items;
create policy "faq: anyone can read published entries"
  on public.faq_items for select to anon, authenticated
  using (published);

drop trigger if exists set_updated_at on public.faq_items;
create trigger set_updated_at before update on public.faq_items
  for each row execute function private.set_updated_at();

insert into public.faq_items (slug, locale, category, question, answer, position, published) values
  ('what-is-raiseready', 'en', 'Getting started', 'What is RaiseReady?', 'RaiseReady helps African startup founders prepare for investor meetings. Upload your pitch deck, get a readiness assessment that shows what investors will look for, then practise with an AI investor who asks real questions, follows up on weak answers and points out where your answers don''t match your documents.', 0, true),
  ('who-is-it-for', 'en', 'Getting started', 'Who is RaiseReady for?', 'Founders preparing to raise money: from angels, seed VCs, accelerators or grant programmes. It is built for startups in Africa, with questions about local markets, currencies and regulation, not just a Silicon Valley checklist.', 10, true),
  ('what-do-i-need', 'en', 'Getting started', 'What do I need to get started?', 'An account and your pitch deck as a PDF. You can also add a financial model (Excel) and a business plan (Word or PDF) for a fuller picture. Files can be up to 20 MB, and decks up to 40 pages.', 20, true),
  ('how-score-works', 'en', 'Assessment and practice', 'How is my readiness score worked out?', 'We check what your documents say against what investors look for in 10 areas, such as problem, market, traction, team and financials. The AI only rates each checklist item; the score itself is calculated by fixed rules, so the same information always gives the same score and you can see exactly why it moved.', 30, true),
  ('investor-room', 'en', 'Assessment and practice', 'What happens in the Investor Room?', 'You choose who you''re pitching to (for example an angel investor or a seed VC) and how hard they should push. The AI investor then runs a meeting of about 10 to 20 questions in rounds, follows up when an answer is vague, and flags red flags such as contradictions with your own documents. At the end you get a score and feedback on every answer.', 40, true),
  ('is-it-advice', 'en', 'Assessment and practice', 'Is the feedback investment advice?', 'No. RaiseReady is a practice tool. Its assessments and feedback are AI-assisted and can be wrong. They are not investment, legal or financial advice, and a good score is not a promise of funding.', 50, true),
  ('practise-again', 'en', 'Assessment and practice', 'Can I practise a question again?', 'Yes. On your results you can retry any question as a short drill, so you can improve a weak answer without redoing the whole meeting.', 60, true),
  ('share-report', 'en', 'Assessment and practice', 'Can I share my report with investors?', 'Yes. On any report you can create a read-only link that works for 7, 30 or 90 days. Anyone with the link can read the report, including risks and red flags, so share it with care. You can turn a link off at any time and see how many times it was opened.', 70, true),
  ('free-plan', 'en', 'Pricing and payments', 'What does the free plan include?', 'One readiness assessment and one Investor Room session with an angel investor or seed VC, on friendly or analytical difficulty. No card is needed.', 80, true),
  ('pro-plan', 'en', 'Pricing and payments', 'What do I get with Pro?', 'Unlimited assessments, up to 30 practice sessions a month, every investor type and difficulty, downloadable PDF reports and progress tracking over time. Current prices are on the Pricing page.', 90, true),
  ('credits', 'en', 'Pricing and payments', 'How do simulation credits work?', 'Each credit pays for one Investor Room session with any investor and difficulty. Credits come in packs, are a one-off payment, and don''t need a subscription.', 100, true),
  ('how-to-pay', 'en', 'Pricing and payments', 'How do I pay?', 'Payments are handled by Paystack. You can pay with a Nigerian or foreign card. RaiseReady never sees or stores your card details.', 110, true),
  ('cancel-pro', 'en', 'Pricing and payments', 'Can I cancel Pro?', 'Yes, from the Billing page. You keep Pro until the end of the month you''ve paid for, then return to the free plan.', 120, true),
  ('discounts-invites', 'en', 'Pricing and payments', 'How do discount codes and invites work?', 'Enter a discount code on the Billing page to see the new price before you pay. Every founder also has an invite link on the Billing page: founders who join with it can get a discount on their first purchase, and you can earn free credits, which become usable once you''ve spent a minimum amount yourself. The current offer is shown on your Billing page.', 130, true),
  ('data-private', 'en', 'Your data', 'Who can see my documents?', 'Your documents are stored privately and shown only to you in the app. To analyse them, their content is sent to our AI provider. The privacy policy explains exactly what we store, who we share it with and for how long.', 140, true),
  ('delete-data', 'en', 'Your data', 'How do I delete my data?', 'You can delete individual documents on the Documents page, or your whole account under Settings. Deleting your account permanently removes your profile, startup, documents, assessments, practice sessions and reports, and cancels any Pro subscription.', 150, true),
  ('languages', 'en', 'Account and help', 'Can I use RaiseReady in my language?', 'Choose your language from the language menu at the top of the page. More of the app is being translated, and we''re working on practice sessions in more languages. Some pages, such as the legal pages, are only in English for now.', 160, true),
  ('something-wrong', 'en', 'Account and help', 'Something went wrong. What should I do?', 'Try again first. If it keeps happening, note the Reference shown on the error screen and send it to us, so we can see exactly what failed.', 170, true)
on conflict (slug, locale) do nothing;
