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

**Going live.** RaiseReady is a product of **Index Prima** (business name,
CAC BN 9430651), so payments go to Index Prima's Paystack business and appear
on customers' statements as Index Prima. Before going live:
- In Paystack, update Index Prima's business description and category to
  cover software / online business tools, and add the RaiseReady address
  (e.g. `https://raiseready.indexprima.com`) as a website.
- Email Paystack support to confirm in writing that Index Prima can take
  payments for RaiseReady.
- Check that Index Prima's registered nature of business at CAC covers
  technology or software services; CAC can update it if not.

After Paystack approves:
1. Replace both keys in Vercel with the live ones (`sk_live_…`, `pk_live_…`).
2. Set the **Live Webhook URL** to the same address.
3. Redeploy.

The billing page shows a "test mode" notice while test keys are in use.

**Prices in US dollars (optional).** Founders outside Nigeria can already pay
in naira with a foreign card. To also offer dollar prices:
1. Ask Paystack to enable USD for your business. Dollar payouts need a Zenith
   Bank USD domiciliary account.
2. Check the dollar prices under **Admin → Prices** (the starting values are
   placeholders: Pro $10/month, Pro Plus $25/month, 3 simulations $4, 10
   simulations $7, one pitch deck $5) and change them if needed.
3. In Vercel, add `PAYSTACK_USD_ENABLED` = `true`, then redeploy. The Billing
   page then offers "Pay in ₦ Naira / $ US dollars". The dollar Pro plan is
   created in Paystack automatically.

**Which currency visitors see.** The website shows prices in US dollars to
everyone. Founders are charged in naira when they are in Nigeria (by profile
country, or the country Vercel detects) or while dollar payments are off, and
then each price has a small "Paid in naira: ₦15,000" line underneath. Once
dollar payments are on, founders outside Nigeria are charged in dollars.
Anyone can switch the display with "Show prices in naira / US dollars"
(remembered in a cookie). To show a rough amount in a visitor's own currency
("≈ KES 1,300") where the display and charge are the same, add exchange rates
under **Admin → Prices → Exchange rates** (how much of that currency one US
dollar buys, e.g. KES 129). Estimates are rounded and only for guidance.
Update the rates now and then.

**Plans.** Free, Pro (₦15,000 / $10 a month), Pro Plus (₦35,000 / $25 a
month) and Teams. Pro Plus has its own Paystack plan, created automatically
the first time someone subscribes, and higher monthly allowances: 100
practice sessions, 10 pitch decks and 100 AI rewrites per deck (Pro: 30, 3
and 30). New premium features such as voice practice will be part of Pro
Plus. A Pro subscriber who upgrades pays for Pro Plus straight away and
their Pro subscription stops (unused Pro days aren't refunded). To move from
Pro Plus to Pro, they cancel Pro Plus and subscribe to Pro after it ends.


**What each plan includes** is set by super admins under **Admin → Plans**:
monthly simulations, pitch decks and AI rewrites, which investors and
difficulties are included, PDF reports, progress tracking, the free deck
preview, the short description and up to four extra selling points. The
plan limits and the pricing cards both follow these settings, so the
website never promises more than a plan gives. The built-in description is
translated into every language; a description or extra line you type is
shown as written. Changes apply straight away, including to current
subscribers, so tell them before taking anything away. Teams members get
whatever Pro Plus includes. The starting values are in
`lib/billing/plan-rules.ts`. FAQ answers are written separately, so update
any that quote allowances under **Admin → FAQ**.

**Prices.** Super admins change any price, in naira and dollars, under
**Admin → Prices**. New prices show on the website and Billing page straight
away and apply to new purchases. Changing Pro or Pro Plus creates a new plan
in Paystack for new subscribers; existing subscribers keep the price they
signed up for until they cancel. Every change is recorded in the audit log.
The starting values are in `lib/billing/prices.ts`.

**Teams** (accelerators, hubs, programmes) are sold directly: enquiries from
the public `/teams` page appear under **Admin → Teams**. Agree the price,
invoice the programme yourself (outside Paystack), then in **Admin → Teams**:
1. Create the team: name, seats, the last day of access, and optionally the
   programme contact's email (they must have signed up). The contact gets a
   **Team** page in the app showing each member's score, practice meetings
   and last activity.
2. Click **Create join link** and send the link to the programme. Founders
   who open it and sign in join the team and get Pro Plus until the end date.
   The link is shown only once; creating a new one turns off the old one.
3. Change seats or dates, remove members or turn the link off any time.

**Pitch deck builder.** Founders build investor decks under **Pitch deck**.
Each founder's first deck is a free preview (outline plus the first 3
slides). Pro includes 3 full decks a month; anyone can buy a single deck
(₦7,500, or $5 placeholder when dollars are on). A preview unlocks as it is,
without being written again. Full decks download as PowerPoint (with speaker
notes) and PDF. Founders can edit slides freely; AI rewrites of a slide are
limited to 2 per bought deck and 30 per Pro deck. Change these numbers in
`lib/billing/plans.ts` (`DECK_BUILDER`); the price is under Admin → Prices. A deck costs roughly $1–3 in AI fees.

**Discount codes and referrals.**
- Super admins create codes under **Admin → Discounts**: percent off, which
  purchases, total uses, last day. Each founder can use a code once.
- A code on Pro discounts the first month only. That month is charged once;
  then the normal monthly plan starts on the same card a month later. If the
  card can't be reused (some bank cards), Pro simply ends after that month
  and the founder can subscribe again.
- A 100% code grants the purchase without going to Paystack.
- Every founder has an invite link on their Billing page. Founders who join
  with it get a discount off their first purchase (10% to start); the inviter
  gets free simulation credits (2 to start) when that founder first pays.
  The inviter can only use those credits once they've spent a minimum
  themselves (₦37,500 or $25 to start; a mix of both counts proportionally).
  Credits earned before that wait as "locked" and unlock automatically.
  Super admins change all of this, or turn the programme off, under
  **Admin → Discounts → Referral programme**. Changes apply to new checkouts
  and rewards; payments already started keep their price.

## 5. Admins and staff

Sign up on the site with your own email, then make yourself the first
super admin in **Supabase → SQL Editor**:

```sql
select private.set_user_role('you@example.com', 'super_admin');
```

After that, add staff from **Admin → Users → Staff → Invite a staff member**
(name, email, role). Staff don't sign up on the website: the invite creates
their account and gives you a one-time link to send them (by email or
WhatsApp). They choose a password on the admin welcome page and land in the
admin area, with no founder onboarding. Links expire after an hour by
default (Supabase → Authentication → Emails → "Email OTP expiration" sets
this); a super admin can make a new one with **New sign-in link** on the
Staff tab. Admins can invite viewers and support; only super admins can
invite admins and super admins.

Staff sign in at **`/admin/login`** with their RaiseReady email and password.
Founder accounts are turned away there. Signed-in staff also see an **Admin**
link in the app header.

From then on, staff manage everyone from **Admin → Users**. Open a user to
see what you can do to their account; each change is recorded in the user's
history.

| Role | Can |
|---|---|
| Founder | Use the app. No admin access. |
| Viewer | See the admin dashboard. |
| Support | Also suspend and reactivate founders. |
| Admin | Also terminate and delete users, send notifications, and give roles up to Support. |
| Super admin | Everything: send password reset emails, add free credits, manage admins and teams, edit the website's logos/testimonials/partners and the FAQ, and set the report signature. |

| Action | What happens |
|---|---|
| Suspend | Signed out and blocked from signing in until reactivated. Data kept. |
| Reactivate | Lifts a suspension. |
| Terminate | Permanently blocked; data kept for records; Pro cancelled; staff role removed. The email can't sign up again. |
| Delete | Account, data and files erased, Pro cancelled (as when founders delete themselves). |
| Send password reset | Emails a link to choose a new password. Staff never see or set passwords. |
| Add free credits | Adds simulation credits at no charge (1–100 at a time). |

Other admin pages:
- **Analytics** (all staff): active founders per day, week and month, sign-ins, where founders drop off between signing up and paying, and which features they use.
- **Errors** (all staff): what went wrong on the live site. When a founder sends you the "Reference" from an error screen, search for it here.
- Each user's page shows their recent sign-ins (with failed attempts), when they were last seen and how many days they were active.
- **Export CSV** (admin and super admin): download the Users, Simulations or Payments list. Exports contain personal data, so each download is logged; store the files securely and delete them when done.
- **Notifications** (admin and super admin): message one founder or everyone. Messages appear under the bell in the app header. **Turn off** hides a sent message from founders without deleting it (turn it on again any time); **Delete** removes it for good.
- **Plans** (super admin): what each plan includes, with a preview of the pricing card.
- **Prices** (super admin): what each plan and pack costs, in naira and dollars, and the exchange rates for local estimates.
- **Teams** (super admin): create teams, share join links, manage members and see enquiries from the Teams page.
- **Discounts** (super admin): the referral programme settings, and discount codes (create, turn off, see how often each was used).
- **Website** (super admin): startup logos, testimonials and partners shown on the home page, `/testimonials` and `/partners`. Tick the permission box only when the company or person has agreed to appear.
- **FAQ** (super admin): the questions and answers on `/faq` (the most useful pricing ones also appear on the Pricing page). Pick a language at the top. Add, edit, hide or delete entries, and set their order. On another language's tab, **Not yet in …** lists the English questions without a translation; **Translate** shows the English original next to the form. A language with no published entries shows the English FAQ, with a note saying so. Once a language has any published entries, only those are shown, so translate them all before publishing.
- **Report signature** (super admin): the name, title and signature image printed as "Issued by RaiseReady" at the end of new PDF reports. Founders' company logos are added to their reports automatically.

Nobody can change their own account from the admin area, so keep at least
two super admins. The SQL command above is the way back in if you ever lose
admin access.

Protect admin accounts with strong, unique passwords, and turn on
two-factor authentication for your Supabase, Vercel, GitHub and Paystack
accounts.

## 6. Languages

Visitors choose a language from the menu in the header or footer: English,
French, Portuguese, Swahili, Arabic (right to left), Hausa, Yoruba or Igbo.
The choice is remembered on their device.

Translated so far: the header and footer, home, pricing, FAQ, sign-up, log-in
and password pages, including their error messages. Everything else,
including the app itself and the AI investor, is still in English.

Before launch:
- [ ] Ask a native speaker to check the Hausa, Yoruba and Igbo text, and
      ideally the others too. The text is in `lib/i18n/messages/` (one file
      per language). Send me corrections, or edit the files directly; the
      tests check that no entry is missing.
- [ ] The privacy policy and terms stay in English (the footer says so).
      Translate them only once a lawyer has approved the English versions,
      and have the translations checked too.

## 7. Automated tests in GitHub

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

## 8. Before launch

- [ ] `/privacy` and `/terms` are published as final. A lawyer's check is
      still worthwhile, in particular:
      - whether payment records must be kept longer than account deletion
        currently allows
      - whether Index Prima must register with the Nigeria Data Protection
        Commission, and with regulators in countries where you market
        actively (e.g. Kenya's ODPC, South Africa's Information Regulator)
- [ ] Supabase's built-in email sender allows only a few emails an hour, which
      also limits the admin "Send password reset" button. A custom SMTP
      sender (below) removes this limit.
- [ ] Add Index Prima's registered address and a contact email: both are
      in `lib/site.ts` (`SITE.company.address`, `SITE.contactEmail`). The
      legal pages show placeholders until then.
- [ ] Custom email sender: Supabase's built-in one is rate-limited and meant
      for testing. Add your own SMTP provider under **Authentication → Emails
      → SMTP Settings**.
- [ ] Paystack live keys and live webhook (section 4).
- [ ] Anthropic monthly spend limit (section 3).
- [ ] Supabase backups: the free plan doesn't include backups you can
      restore. A paid plan adds daily backups, plus optional point-in-time
      recovery, once you have real users.
- [ ] Domain `raiseready.indexprima.com`: in **Vercel → Settings → Domains**
      add it; Vercel shows a CNAME record to add where indexprima.com's DNS
      is managed. Then update `APP_URL`, the Supabase Site URL and Redirect
      URLs (section 1), and the Paystack webhook URL (section 4), and redeploy.
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
