# RaiseReady

AI-powered fundraising simulator for African startup founders.
*Don't practice on investors. Practice on AI first.*

The full product and technical spec is in [`docs/SPEC.md`](docs/SPEC.md).

## Stack

Next.js (App Router, TypeScript) · Tailwind CSS + shadcn/ui · Supabase (Postgres, Auth, Storage) · Anthropic API · Paystack · Vitest

## Getting started

1. Install dependencies (Node 20.9+):
   ```bash
   npm install
   ```
2. Create a Supabase project, then copy the env template and fill it in:
   ```bash
   cp .env.example .env.local
   ```
3. Apply the database migrations in `supabase/migrations`, either with the
   Supabase CLI:
   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
   or by running each file, in order, in the Supabase SQL editor.
4. Start the app:
   ```bash
   npm run dev
   ```

### Making yourself an admin

Sign up in the app first, then either run

```bash
npm run db:seed-admin -- you@example.com
```

or, in the Supabase SQL editor:

```sql
select private.set_user_role('you@example.com', 'admin');
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generates Next.js route types and runs `tsc` |
| `npm test` | Vitest unit tests |
| `npm run test:db` | Applies migrations to a throwaway Postgres and runs the RLS test suite |
| `npm run db:seed-admin -- <email>` | Grants the admin role to an existing user |

Deploying: see [`docs/DEPLOY.md`](docs/DEPLOY.md).

### Database tests

`npm run test:db` needs the PostgreSQL server binaries (`initdb`, `pg_ctl`,
`psql`). It starts a temporary cluster, loads a small shim of the Supabase
pieces the migrations depend on (`auth.users`, `auth.uid()`, the API roles and
storage tables), applies every migration and runs `supabase/tests/*.test.sql`.

To run the same tests against a full local Supabase stack instead:

```bash
npx supabase start
npx supabase db reset
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db
```

## Database access model

- Row Level Security is enabled on every table.
- Founders can read only their own rows. They can directly edit their
  profile's name/country/onboarding flag, manage their startups, and delete
  their document records.
- Plan, credits and role can never be changed from the browser.
- Uploads, extraction results, assessments, simulations, reports, payments,
  AI usage and audit logs are written by server code using the service role.
- Storage buckets (`documents`, `reports`) are private. Objects live at
  `{user_id}/{startup_id}/{file}` and are served via short-lived signed URLs.
- Deleting an auth user cascades to all of that user's rows. `ai_calls` and
  `audit_logs` are kept but unlinked from the deleted user.
