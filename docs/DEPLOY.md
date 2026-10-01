# Deploying RaiseReady

RaiseReady runs on four services:

| Service | What it does | Where to sign up |
|---|---|---|
| **Vercel** | Hosts the website and server code | https://vercel.com |
| **Supabase** | Database, sign-in and private file storage | https://supabase.com |
| **Anthropic** | The AI model behind analysis, scoring and the Investor Room | https://console.anthropic.com |
| **Paystack** | Payments in naira | https://paystack.com |

Keys and passwords go **only** into Vercel's environment variables (and, for
the optional live tests, GitHub's secrets). Never paste them into chat, email
or code, and cover them up in any screenshot.

Vercel deploys the production branch automatically on every push. Each step
below says where to click. After any change to environment variables, redeploy
(see [Changing a variable](#changing-a-variable-later)).

---

## 1. Supabase

1. Create a project at https://supabase.com. Pick the region closest to your
   users (e.g. *West EU* or *South Africa*) and save the database password in
   a password manager.
2. **Create the database.** Open **SQL Editor → New query**, paste the whole
   of [`supabase/setup.sql`](../supabase/setup.sql) and click **Run**. The
   last result row should say `SETUP COMPLETE`. The script is safe to run
   again. Re-run it whenever a new version adds database changes.
3. **Data API.** Under **Project Settings → Data API**, make sure the
   `public` schema is exposed.
4. **Sign-in links.** Under **Authentication → URL Configuration**:
   - **Site URL**: your site address, e.g. `https://raiseready-one.vercel.app`
   - **Redirect URLs**: add `https://<your-site>/**`
5. **Email templates** (so confirmation links work on any device). Under
   **Authentication → Emails**, change the link in:
   - **Confirm signup** to
     `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/app/onboarding`
   - **Reset password** to
     `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
6. **Keys for Vercel.** Under **Project Settings → API Keys**, you will need
   the Project URL, the publishable (anon) key and the secret (service_role)
   key in step 2.

## 2. Vercel

1. Sign in with GitHub, choose **Add New → Project**, and import `raiseready`.
   If it isn't listed, click **Adjust GitHub App Permissions**.
2. Under **Settings → Git**, set the **Production Branch** to the branch you
   deploy from.
3. Under **Settings → Environment Variables**, add:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable (anon) key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret (service_role) key |
   | `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
   | `ANTHROPIC_MODEL` | `claude-opus-5-5` |
   | `PAYSTACK_SECRET_KEY` | Paystack secret key (`sk_test_…` until launch) |
   | `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Paystack public key (`pk_test_…` until launch) |
   | `APP_URL` | Your site address, no trailing slash |

4. Deploy, then open `https://<your-site>/status`. Every line should show a
   green tick. Each problem it reports says how to fix it.

Assessments, document analysis and Investor Room replies can take up to five
minutes. Vercel allows this on current plans with Fluid compute, which is on
by default. If they time out, check **Settings → Functions**.

## 3. Anthropic

1. At https://console.anthropic.com, add billing details and create an API
   key for Vercel.
2. Set a **monthly spend limit** under **Billing → Limits** so a bug or abuse
   can't run up an unexpected bill.
3. The admin dashboard's **AI usage** page shows estimated cost by feature and
   by user.

## 4. Paystack

Use **test mode** until launch. Test cards are listed at
https://paystack.com/docs/payments/test-payments.

1. In the Paystack dashboard, open **Settings → API Keys & Webhooks**.
2. Copy the test keys into Vercel (step 2).
3. Set the **Test Webhook URL** to `https://<your-site>/api/paystack/webhook`.
   The webhook is how payments are confirmed, so it must be set.
4. The Pro plan is created in Paystack automatically the first time someone
   upgrades.

**Going live.** Use a Paystack business registered for RaiseReady, not one
belonging to another company. After Paystack approves the business:
1. Replace both keys in Vercel with the live ones (`sk_live_…`, `pk_live_…`).
2. Set the **Live Webhook URL** to the same address.
3. Redeploy.

The billing page shows a "test mode" notice while test keys are in use.

## 5. Make yourself an admin

Sign up on the site with your own email, then in **Supabase → SQL Editor**:

```sql
select private.set_user_role('you@example.com', 'admin');
```

Reload the app and an **Admin** link appears in the header. There is no
separate admin password: the admin area is protected by your account login
and your Supabase dashboard login, so turn on two-factor authentication for
your Supabase, Vercel, GitHub and Paystack accounts.

## 6. Automated tests in GitHub

Every push runs, in GitHub Actions (**Actions** tab), the same checks used
during development:
- lint, type checks and unit tests
- database access-rule tests
- browser tests of the public site on desktop and mobile

**Optional: the full core-loop test against the live site.** This test signs
up a throwaway founder, then:
1. uploads a fictional pitch deck
2. runs an assessment
3. holds a full Investor Room meeting
4. checks the results
5. deletes the account

It makes real AI calls, roughly the cost of one founder's session. To enable
it, add these in GitHub under **Settings → Secrets and variables → Actions**:

| Kind | Name | Value |
|---|---|---|
| Variable | `E2E_BASE_URL` | Your site address |
| Variable | `E2E_SUPABASE_URL` | Supabase Project URL |
| Secret | `E2E_SUPABASE_SERVICE_ROLE_KEY` | Supabase secret (service_role) key |

It runs only for commits whose message contains `[e2e]`. It waits for Vercel
to deploy that commit, then runs the test. Test accounts use addresses ending
in `@raiseready-e2e.test` and are deleted at the end, even when the test
fails. Each run leaves one `account.deleted` row in the audit log.

To run it from your own computer instead:

```bash
E2E_BASE_URL=https://<your-site> E2E_SUPABASE_URL=… E2E_SUPABASE_SERVICE_ROLE_KEY=… \
  npx playwright test --project=core-loop
```

## 7. Before launch

- [ ] Legal review of `/privacy` and `/terms`, then remove the
      "DRAFT: requires legal review" notices. Ask the reviewer:
      - whether payment records must be kept longer than account deletion
        currently allows
      - whether you need to register with the Nigeria Data Protection
        Commission
- [ ] Add a contact email to the privacy and terms pages (they currently say
      "[contact email to be added]").
- [ ] Custom email sender: Supabase's built-in one is rate-limited and meant
      for testing. Add your own SMTP provider under **Authentication → Emails
      → SMTP Settings**.
- [ ] Paystack live keys and live webhook (section 4).
- [ ] Anthropic monthly spend limit (section 3).
- [ ] Supabase backups: the free plan doesn't include backups you can
      restore. A paid plan adds daily backups, plus optional point-in-time
      recovery, once you have real users.
- [ ] Optional: a custom domain under **Vercel → Settings → Domains**. Then
      update `APP_URL`, the Supabase Site URL and Redirect URLs, and the
      Paystack webhook URL.
- [ ] Two-factor authentication on Supabase, Vercel, GitHub, Paystack and
      Anthropic.
- [ ] `/status` shows all green on the production site.

## Changing a variable later

Environment variable changes only apply to new deployments. After editing one
in Vercel, go to **Deployments → ⋯ (latest) → Redeploy**.

## Troubleshooting

| Symptom | Fix |
|---|---|
| A page shows "We couldn't load your account" with an error code | Open `/status`; it explains the code. `PGRST205` means the setup script hasn't run (section 1, step 2). |
| Sign-up email link says it's invalid or expired | Check the Redirect URLs and email templates (section 1, steps 4–5). |
| Payment went through but the plan didn't change | Check the Paystack webhook URL (section 4, step 3). Paystack's dashboard shows each webhook delivery and its response. |
| "Something went wrong" with a reference | Search for the reference in **Vercel → Logs**. |
