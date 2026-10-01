# Deploying RaiseReady to Vercel

The repository's default branch is the production branch: every push to it
redeploys the site automatically.

## First deploy

1. Sign in at https://vercel.com with your GitHub account.
2. **Add New → Project**, find `raiseready` and click **Import**.
   If it is not listed, click **Adjust GitHub App Permissions** and give
   Vercel access to the repository.
3. Leave the framework (Next.js) and build settings as detected.
4. Open **Environment Variables** and add:

   | Name | Value (from Supabase → Project Settings → API Keys) |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key (legacy: anon) |
   | `SUPABASE_SERVICE_ROLE_KEY` | Secret key (legacy: service_role) |

   For document analysis (from Milestone 4), also add:

   | Name | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | From console.anthropic.com → API Keys |
   | `ANTHROPIC_MODEL` | `claude-opus-5-5` |

   For payments (from Milestone 8), also add:

   | Name | Value (Paystack dashboard → Settings → API Keys & Webhooks) |
   |---|---|
   | `PAYSTACK_SECRET_KEY` | Test secret key (`sk_test_…`) |
   | `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Test public key (`pk_test_…`) |

   and in the same Paystack settings page set the **Test Webhook URL** to
   `https://<your-site>/api/paystack/webhook`.
5. Click **Deploy** and wait for the build to finish. Note the site address,
   e.g. `https://raiseready-xxxx.vercel.app`.

## After the first deploy

1. In Vercel: **Settings → Environment Variables**, add `APP_URL` set to the
   site address (no trailing slash), then **Deployments → ⋯ → Redeploy**.
2. In Supabase: **Authentication → URL Configuration**
   - **Site URL**: the site address.
   - **Redirect URLs**: add `https://<your-site>/**` (keep
     `http://localhost:3000/**` if you also run the app locally).

## Changing a variable later

Environment variable changes only apply to new deployments. After editing one,
redeploy from **Deployments → ⋯ → Redeploy**.

## Sign-up emails

Supabase sends the confirmation and password-reset emails. Their links land on
`/auth/callback`, which signs the user in and forwards them on.

With Supabase's default email templates, a link works only in the browser
where the person signed up. To let links work on any device (e.g. sign up on a
laptop, confirm on a phone), edit the templates in Supabase under
**Authentication → Emails**:

- **Confirm signup**: link to
  `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/app/onboarding`
- **Reset password**: link to
  `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`

Supabase's built-in email sender is rate-limited and meant for testing. Before
launch, add your own SMTP provider under **Authentication → Emails → SMTP
Settings**.
