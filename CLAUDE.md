@AGENTS.md

# RaiseReady

The product spec is `docs/SPEC.md` and is the source of truth. Build one
milestone at a time (spec section 11) and stop for review after each.

## Commands
- `npm run lint`, `npm run typecheck`, `npm test` (Vitest), `npm run test:db` (SQL RLS tests)
- `npx playwright test --project=public --project=mobile` (E2E, no keys needed);
  `--project=core-loop` needs `E2E_BASE_URL`, `E2E_SUPABASE_URL`,
  `E2E_SUPABASE_SERVICE_ROLE_KEY` and makes real AI calls.
- `npm run test:db` spins up a throwaway Postgres with a Supabase shim when
  `DATABASE_URL` is unset; with `DATABASE_URL` it runs against that database.

## Conventions
- Business logic lives in `/lib`; components and route handlers stay thin.
- Supabase clients: `lib/supabase/server.ts` (user session, RLS applies),
  `lib/supabase/client.ts` (browser), `lib/supabase/admin.ts` (service role,
  server only, always scope queries to an already-verified user).
- Founders may only write their profile's editable fields, their startups and
  delete their documents. All derived data, billing, AI usage and audit logs
  are written by server code with the service role.
- Schema changes: add a new migration in `supabase/migrations`, update
  `lib/supabase/database.types.ts`, and extend `supabase/tests/rls.test.sql`.
- Ask before adding dependencies not listed in spec section 3.
- AI: all model calls go through `lib/ai/structured.ts` (Zod-validated JSON,
  one retry, every attempt logged to `ai_calls`). Prompts live in
  `lib/ai/prompts/` as versioned files; founder content is wrapped in
  `<founder_document>` tags. Model comes from `ANTHROPIC_MODEL`.
- Spreadsheets are read by `lib/documents/xlsx.ts`, not SheetJS: the npm
  release of SheetJS (0.18.5) has known vulnerabilities when parsing untrusted
  files, and the fixed release is only on SheetJS's own CDN.
- Uploads go browser → Supabase Storage via a signed upload URL (Vercel caps
  request bodies at ~4.5 MB); the server then validates the stored file's
  content before recording it.
- Investor Room: `lib/simulation/state.ts` is the round state machine (the
  model only picks among `allowedActions`); turns stream from
  `app/api/simulations/[id]/turn` as NDJSON. Route handlers that mutate must
  call `isSameOrigin` (Server Actions get Next's built-in origin check).
- Billing: plan rules are pure functions in `lib/billing/entitlements.ts` and
  are checked server-side before every AI operation. Paystack's webhook
  (`app/api/paystack/webhook`, HMAC-verified) is the source of truth;
  `applyChargeSuccess` is idempotent so the return-page verification and the
  webhook can both run. Credits change only via the `add_credits` /
  `consume_credit` SQL functions.
- Prices: defaults and discount maths in `lib/billing/prices.ts`; the live
  prices come from `getPrices()` (`lib/billing/price-settings.ts`, table
  `price_settings`, edited by super admins under Admin → Prices). Always pass
  them in (`priceOf(product, currency, prices)`); never read the defaults
  for a real price. Paystack plans are found by name and amount, so a new
  price makes a new plan and existing subscribers keep theirs. Referral
  programme values are super-admin settings (`referral_settings`, read via
  `getReferralSettings`, defaults in `DEFAULT_REFERRAL`). Inviter credits stay
  `locked` until the inviter's own spend reaches the minimum (`unlockProgress`);
  `releaseLockedRewards` runs after every successful payment.
  USD only when `PAYSTACK_USD_ENABLED=true`. `payments.amount_kobo` is in the
  currency's smallest unit; revenue is always totalled per currency. Discounted
  Pro is a one-off first month, then `createSubscription` starts the plan.
- Currency display (`lib/currency`): prices are shown in US dollars
  (`ctx.shown`) unless the `rr_currency` cookie picks naira; the charge
  currency (`ctx.currency`) is naira in Nigeria or while
  `PAYSTACK_USD_ENABLED` is off, else dollars. `displayPrice` adds "Paid in
  naira" when they differ. `getPriceContext` decides from the profile country
  or `x-vercel-ip-country`. Local estimates use super-admin rates (`fx_rates`,
  per US dollar) and are display only; charges are always NGN or USD.
- Report share links (`lib/reports/shares.ts`): random token in the URL, only
  its SHA-256 stored; public page `/shared/[token]`.
- Tests that touch Supabase use `test/fake-supabase.ts`.
- Staff: roles founder/viewer/support/admin/super_admin; permissions are pure rules in
  `lib/admin/permissions.ts`. Admin pages call `requireStaff(action)`; user
  actions go through `applyUserAction` (`lib/admin/users.ts`), which checks
  permissions and audit-logs. Staff sign in at `/admin/login`. Staff are
  created by invite (`lib/admin/staff.ts`, Admin → Users → Staff), never via
  founder sign-up; invite links land on `/admin/welcome`. Staff skip founder
  onboarding and are sent to `/admin`.
- Account status (active/suspended/terminated) is enforced in `getSession`
  (`lib/auth/session.ts`) on every request, plus a Supabase Auth ban.
- Notifications: `lib/notifications` (staff → one founder or everyone; RLS
  lets founders read only theirs and broadcasts, and only `active` ones;
  staff can turn a message off; read receipts are written by the server). Links must stay inside `/app`.
- Website showcase (`lib/showcase`, public `showcase` bucket) and report
  signature (`lib/reports/signature.ts`) are super-admin content; editing
  revalidates the public pages.
- Activity (`lib/activity`): sign-in events, active days and the error log
  (server errors via `instrumentation.ts`, browser-only errors via
  `ErrorPanel`). All best-effort (never block the user), server-only tables,
  kept 90 days by `prune_activity`. Admin lists page with `PAGE_SIZE`; CSV
  exports (`lib/admin/export.ts`) escape formulas and are audit-logged.
- Profile pictures and logos: private `images` bucket, PNG/JPEG ≤ 2 MB,
  checked by content (`lib/images`). Only server code writes `avatar_path` /
  `logo_path`; viewing uses short-lived signed links.
- Languages (`lib/i18n`): the `rr_locale` cookie picks one of `LOCALES`; the
  root layout sets `<html lang dir>` (Arabic is right to left). Server
  components read text with `getMessages()`; client components get their text
  as props. Dictionaries live in `lib/i18n/messages/<locale>.ts` and must match
  `en.ts` key for key (tests check this). Server messages (form errors) stay in
  English in code and are translated by `localiseState`, matched against
  `en.text` templates. Untranslated areas (the app, admin, legal pages) are
  wrapped in `lang="en" dir="ltr"`. Use logical CSS (`ms-`, `ps-`, `end-`) so
  layouts flip correctly for right-to-left languages.
- FAQ (`lib/faq`, table `faq_items`): super-admin content per language,
  linked across languages by `slug`, English fallback; edits clear the cache
  tag. Public reads are cached for five minutes and time out after three
  seconds.
- Company: RaiseReady is a product of Index Prima (`SITE.company` in
  `lib/site.ts`); the footer, legal pages, billing page and PDF reports name it.
- Plans: free / pro / pro_plus, plus Teams. What each plan includes is a
  `PlanRule` (`lib/billing/plan-rules.ts`, defaults `DEFAULT_PLAN_RULES`),
  edited by super admins under Admin → Plans (table `plan_settings`, read via
  `getPlanRules()`; `getUsage` returns them as `usage.rules`). Entitlements
  read the rules, never hard-coded numbers, and pricing cards are generated
  from them by `planFeatures`. `tierOf` decides
  the founder's level (an active team gives pro_plus); `getUsage` returns
  `tier` and `team`. Each subscription row records its `plan`; upgrading
  Pro → Pro Plus ends the Pro subscription (`endSubscription`) and only the
  current subscription ending downgrades the plan. Teams (`lib/teams`) are
  set up by super admins (`manage_teams`); join links store only a SHA-256
  of the token; the team owner sees `cohort()` (scores and activity, never
  documents, answers or reports). Team tables are server-only.
- Pitch decks (`lib/decks`, table `pitch_decks`): written by one AI call
  (`lib/ai/prompts/deck.v1.ts`); `checkDeck` rejects numbers not found in the
  founder's material and missing facts become `[Add: ...]`. Access rules
  (`deckBuildAccess`, `deckUnlockAccess`, `rewriteAccess`) are in
  `lib/billing/entitlements.ts`; bought decks are `profiles.deck_credits`,
  changed only via `add_deck_credits` / `consume_deck_credit`. Preview decks
  never send locked slides to the browser. PowerPoint (`pptxgenjs`) and PDF
  files are built on request by `/app/decks/[id]/download`.
- Email: Supabase sends auth emails (its SMTP settings). Everything the app
  sends itself goes through `sendEmail` (`lib/email/mailtrap.ts`, Mailtrap's
  Email API, `MAILTRAP_API_TOKEN`), which never throws; templates in
  `lib/email/templates.ts` escape all user text; the sender is `SITE.email`.
  Without a token nothing is emailed, so callers must still work (e.g. staff
  invite links are also shown on screen). Supabase's Send Email hook
  (`app/api/auth/send-email`, Standard Webhooks signature with
  `SEND_EMAIL_HOOK_SECRET`, `lib/email/auth-hook.ts`) lets auth emails go
  through the same API instead of SMTP; their links use `token_hash`.
- Security headers and the CSP live in `lib/security/headers.ts`. If the
  browser needs a new third-party origin, add it there.
- `supabase/setup.sql` is generated by `npm run db:bundle`; regenerate it after
  adding a migration.
