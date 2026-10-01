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

   The Anthropic and Paystack variables are added in later milestones.
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
