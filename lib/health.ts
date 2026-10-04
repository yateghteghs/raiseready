import { createClient } from "@supabase/supabase-js";

import { DEFAULT_MODEL } from "@/lib/ai/client";

/**
 * Configuration checks for the /status page. Reports whether each setting is
 * present and plausible, never the values themselves.
 */

export type CheckResult = { name: string; ok: boolean; detail: string };

type KeyKind = "publishable" | "secret" | "anon-jwt" | "service-jwt" | "unknown";

/** Identifies a Supabase API key's type from its format. */
export function supabaseKeyKind(key: string | undefined): KeyKind {
  if (!key) return "unknown";
  if (key.startsWith("sb_publishable_")) return "publishable";
  if (key.startsWith("sb_secret_")) return "secret";
  const parts = key.split(".");
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
      if (payload.role === "anon") return "anon-jwt";
      if (payload.role === "service_role") return "service-jwt";
    } catch {
      return "unknown";
    }
  }
  return "unknown";
}

export function checkSupabaseUrl(url: string | undefined): CheckResult {
  const name = "NEXT_PUBLIC_SUPABASE_URL";
  if (!url) return { name, ok: false, detail: "Not set." };
  if (url !== url.trim()) return { name, ok: false, detail: "Has spaces before or after it. Remove them." };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { name, ok: false, detail: "Not a valid web address. It should look like https://abcd.supabase.co" };
  }
  if (parsed.protocol !== "https:") {
    return { name, ok: false, detail: "Must start with https://" };
  }
  if (parsed.hostname.endsWith("supabase.com")) {
    return {
      name,
      ok: false,
      detail: "This is a dashboard link. Use the Project URL instead (looks like https://abcd.supabase.co).",
    };
  }
  if (parsed.pathname !== "/" && parsed.pathname !== "") {
    return { name, ok: false, detail: "Should end at .supabase.co, with nothing after it." };
  }
  return { name, ok: true, detail: `Set (${parsed.hostname}).` };
}

export function checkPublicKey(key: string | undefined): CheckResult {
  const name = "NEXT_PUBLIC_SUPABASE_ANON_KEY";
  const kind = supabaseKeyKind(key?.trim());
  if (!key) return { name, ok: false, detail: "Not set." };
  if (kind === "secret" || kind === "service-jwt") {
    return {
      name,
      ok: false,
      detail:
        "This is the SECRET key, which must never be public. Replace it with the publishable (or anon) key, then rotate the secret key in Supabase.",
    };
  }
  if (kind === "unknown") {
    return { name, ok: false, detail: "Doesn't look like a Supabase publishable or anon key." };
  }
  return { name, ok: true, detail: `Set (${kind === "publishable" ? "publishable" : "anon"} key).` };
}

export function checkServiceKey(key: string | undefined): CheckResult {
  const name = "SUPABASE_SERVICE_ROLE_KEY";
  const kind = supabaseKeyKind(key?.trim());
  if (!key) return { name, ok: false, detail: "Not set." };
  if (kind === "publishable" || kind === "anon-jwt") {
    return { name, ok: false, detail: "This is the public key. Use the secret (or service_role) key here." };
  }
  if (kind === "unknown") {
    return { name, ok: false, detail: "Doesn't look like a Supabase secret or service_role key." };
  }
  return { name, ok: true, detail: "Set (secret key)." };
}

export function checkAppUrl(url: string | undefined): CheckResult {
  const name = "APP_URL";
  if (!url) return { name, ok: false, detail: "Not set. Email links will use this site's address instead." };
  try {
    const parsed = new URL(url.trim());
    if (parsed.pathname !== "/" || url.trim().endsWith("/")) {
      return { name, ok: false, detail: "Remove anything after the domain, including a trailing /." };
    }
    return { name, ok: true, detail: `Set (${parsed.origin}).` };
  } catch {
    return { name, ok: false, detail: "Not a valid web address." };
  }
}

/** Calls Supabase Auth to confirm the URL and key match and email sign-up is on. */
export async function checkAuthService(url: string, key: string): Promise<CheckResult> {
  const name = "Supabase sign-in service";
  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}/auth/v1/settings`, {
      headers: { apikey: key },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 401 || res.status === 403) {
      return { name, ok: false, detail: "Reached Supabase, but the key was rejected. Check the key belongs to this project." };
    }
    if (!res.ok) return { name, ok: false, detail: `Supabase answered with an error (HTTP ${res.status}).` };
    const settings = (await res.json()) as {
      disable_signup?: boolean;
      mailer_autoconfirm?: boolean;
      external?: { email?: boolean };
    };
    if (settings.disable_signup) return { name, ok: false, detail: "Reachable, but new sign-ups are turned off in Supabase." };
    if (settings.external?.email === false) {
      return { name, ok: false, detail: "Reachable, but the Email sign-in provider is turned off in Supabase." };
    }
    return {
      name,
      ok: true,
      detail: settings.mailer_autoconfirm
        ? "Reachable. Email confirmation is OFF (users are signed in immediately)."
        : "Reachable. Email confirmation is ON.",
    };
  } catch {
    return { name, ok: false, detail: "Couldn't reach Supabase at this address." };
  }
}

/** Confirms the database schema exists, using the server-only key. */
export async function checkDatabase(url: string, serviceKey: string): Promise<CheckResult> {
  const name = "Database tables";
  try {
    const supabase = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    // A full GET, not a HEAD request: supabase-js reports a HEAD 404 as success.
    const { error } = await supabase.from("profiles").select("id").limit(1);
    if (!error) return { name, ok: true, detail: "Found. The database setup script has been run." };
    if (error.code === "42P01" || error.code === "PGRST205") {
      return {
        name,
        ok: false,
        detail: `The app's API can't see the tables (code ${error.code}). If the setup script has run, restart the project in Supabase (Project Settings → General) so the API reloads.`,
      };
    }
    return { name, ok: false, detail: `Database error (code ${error.code || "unknown"}).` };
  } catch {
    return { name, ok: false, detail: "Couldn't reach the database." };
  }
}

/**
 * Confirms the tables are visible to the app's public API and locked down:
 * an anonymous request must be refused (permission denied), not succeed.
 */
export async function checkAccessRules(url: string, publicKey: string): Promise<CheckResult> {
  const name = "Database access rules";
  try {
    const supabase = createClient(url, publicKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await supabase.from("profiles").select("id").limit(1);
    if (error?.code === "42501") return { name, ok: true, detail: "In place. Anonymous visitors can't read account data." };
    if (!error) {
      return { name, ok: false, detail: "Anonymous visitors can read the profiles table. Re-run the database setup script." };
    }
    if (error.code === "PGRST205" || error.code === "42P01") {
      return {
        name,
        ok: false,
        detail: `The app can't see the tables (code ${error.code}). Check the setup script ran, and that the "public" schema is exposed under Project Settings → Data API.`,
      };
    }
    return { name, ok: false, detail: `Unexpected database response (code ${error.code || "unknown"}).` };
  } catch {
    return { name, ok: false, detail: "Couldn't reach the database API." };
  }
}

/** Confirms the private file buckets exist. */
export async function checkStorage(url: string, serviceKey: string): Promise<CheckResult> {
  const name = "File storage";
  try {
    const supabase = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await supabase.storage.listBuckets();
    if (error) return { name, ok: false, detail: "Couldn't list storage buckets." };
    const PRIVATE = ["documents", "reports", "images"];
    const missing = [...PRIVATE, "showcase"].filter((id) => !data.some((b) => b.id === id));
    if (missing.length) {
      return { name, ok: false, detail: `Missing bucket(s): ${missing.join(", ")}. Re-run the database setup script.` };
    }
    const pub = data.filter((b) => PRIVATE.includes(b.id) && b.public);
    if (pub.length) return { name, ok: false, detail: `Bucket(s) ${pub.map((b) => b.id).join(", ")} are public. They must be private.` };
    return { name, ok: true, detail: "Private buckets for documents, reports and images exist, plus the public showcase bucket." };
  } catch {
    return { name, ok: false, detail: "Couldn't reach storage." };
  }
}

/**
 * The newest thing each migration adds, newest first. The first one found
 * missing names the migration to run (and every newer one after it).
 */
export const MIGRATION_MARKERS: { file: string; table: string; column?: string }[] = [
  { file: "20261001002300_email_log.sql", table: "email_log" },
  { file: "20261001002200_email_events.sql", table: "email_events" },
  { file: "20261001002100_welcome_email.sql", table: "profiles", column: "welcome_email_sent_at" },
  { file: "20261001001900_plan_settings_fx.sql", table: "fx_rates" },
  { file: "20261001001800_prices_notification_switch.sql", table: "price_settings" },
  { file: "20261001001700_pro_plus_teams.sql", table: "teams" },
  { file: "20261001001600_pitch_decks.sql", table: "pitch_decks" },
  { file: "20261001001500_faq.sql", table: "faq_items" },
];

/** Finds database migrations that haven't been run yet. */
export async function checkMigrations(url: string, serviceKey: string): Promise<CheckResult> {
  const name = "Database up to date";
  try {
    const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const results = await Promise.all(
      MIGRATION_MARKERS.map(async (m) => {
        const { error } = await supabase.from(m.table as "profiles").select(m.column ?? "*").limit(1);
        return { ...m, missing: Boolean(error) && ["PGRST205", "42P01", "42703", "PGRST204"].includes(error!.code) };
      }),
    );
    const missing = results.filter((r) => r.missing).map((r) => r.file).reverse();
    if (!missing.length) return { name, ok: true, detail: "All database updates have been run." };
    return {
      name,
      ok: false,
      detail: `Not run yet: ${missing.join(", ")}. Run them in this order in Supabase → SQL Editor (from supabase/migrations), or re-run supabase/setup.sql.`,
    };
  } catch {
    return { name, ok: false, detail: "Couldn't check the database." };
  }
}

/** Email settings: Mailtrap for everything RaiseReady sends, and the Supabase hook for sign-up emails. */
export function checkEmail(env: Record<string, string | undefined>): CheckResult[] {
  const token = env.MAILTRAP_API_TOKEN?.trim();
  const secret = env.SEND_EMAIL_HOOK_SECRET?.trim();
  return [
    token
      ? { name: "MAILTRAP_API_TOKEN", ok: true, detail: "Set. Use Admin → Overview → Send me a test email to confirm Mailtrap accepts it." }
      : { name: "MAILTRAP_API_TOKEN", ok: false, detail: "Not set: receipts, welcome and other emails won't be sent. Add it in Vercel, then redeploy." },
    !secret
      ? {
          name: "SEND_EMAIL_HOOK_SECRET",
          ok: false,
          detail: "Not set: sign-up and password emails can only go through Supabase's own sender. Copy the secret from Supabase → Authentication → Hooks.",
        }
      : secret.startsWith("v1,whsec_")
        ? { name: "SEND_EMAIL_HOOK_SECRET", ok: true, detail: "Set. It must match the secret on Supabase's Send Email hook." }
        : { name: "SEND_EMAIL_HOOK_SECRET", ok: false, detail: 'Doesn\'t look right: copy the whole secret, starting with "v1,whsec_".' },
  ];
}

/** Confirms the Anthropic key works and the configured model exists (no tokens used). */
export async function checkAnthropic(apiKey: string | undefined, model: string | undefined): Promise<CheckResult[]> {
  const keyName = "ANTHROPIC_API_KEY";
  const modelName = "ANTHROPIC_MODEL";
  const where = "Add it in Vercel → Settings → Environment Variables with Production ticked, then redeploy.";
  if (!apiKey) return [{ name: keyName, ok: false, detail: `Not set. ${where}` }];
  const usingDefault = !model?.trim();
  const effective = usingDefault ? DEFAULT_MODEL : model!.trim();
  try {
    const res = await fetch(`https://api.anthropic.com/v1/models/${encodeURIComponent(effective)}`, {
      headers: { "x-api-key": apiKey.trim(), "anthropic-version": "2023-06-01" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 401 || res.status === 403) {
      return [{ name: keyName, ok: false, detail: "Anthropic rejected this key. Check it was copied correctly." }];
    }
    if (res.status === 404) {
      return [
        { name: keyName, ok: true, detail: "Set and accepted." },
        { name: modelName, ok: false, detail: `"${effective}" isn't a model this key can use. Use "${DEFAULT_MODEL}".` },
      ];
    }
    if (!res.ok) return [{ name: keyName, ok: false, detail: `Anthropic answered with an error (HTTP ${res.status}).` }];
    return [
      { name: keyName, ok: true, detail: "Set and accepted." },
      {
        name: modelName,
        ok: true,
        detail: usingDefault ? `Not set, so the default (${DEFAULT_MODEL}) is used.` : `Set (${effective}).`,
      },
    ];
  } catch {
    return [{ name: keyName, ok: false, detail: "Couldn't reach Anthropic." }];
  }
}

/** Confirms the Paystack secret key works and reports test or live mode (no charge made). */
export async function checkPaystack(secret: string | undefined): Promise<CheckResult> {
  const name = "PAYSTACK_SECRET_KEY";
  if (!secret) return { name, ok: false, detail: "Not set. Payments won't work until it is. Add it in Vercel → Settings → Environment Variables, then redeploy." };
  const key = secret.trim();
  if (key.startsWith("pk_")) return { name, ok: false, detail: "This is the public key. Use the secret key (starts with sk_test_ or sk_live_)." };
  if (!key.startsWith("sk_")) return { name, ok: false, detail: "Doesn't look like a Paystack secret key." };
  try {
    const res = await fetch("https://api.paystack.co/plan?perPage=1", {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 401) return { name, ok: false, detail: "Paystack rejected this key. Check it was copied correctly." };
    if (!res.ok) return { name, ok: false, detail: `Paystack answered with an error (HTTP ${res.status}).` };
    return { name, ok: true, detail: key.startsWith("sk_test_") ? "Set and accepted (test mode: no real money moves)." : "Set and accepted (LIVE mode: real payments)." };
  } catch {
    return { name, ok: false, detail: "Couldn't reach Paystack." };
  }
}

export async function runHealthChecks(env: Record<string, string | undefined> = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  const urlCheck = checkSupabaseUrl(url);
  const publicKeyCheck = checkPublicKey(publicKey);
  const serviceKeyCheck = checkServiceKey(serviceKey);
  const results: CheckResult[] = [urlCheck, publicKeyCheck, serviceKeyCheck, checkAppUrl(env.APP_URL)];

  if (urlCheck.ok && publicKeyCheck.ok) results.push(await checkAuthService(url!.trim(), publicKey!.trim()));
  if (urlCheck.ok && publicKeyCheck.ok) results.push(await checkAccessRules(url!.trim(), publicKey!.trim()));
  if (urlCheck.ok && serviceKeyCheck.ok) {
    results.push(await checkDatabase(url!.trim(), serviceKey!.trim()));
    results.push(await checkMigrations(url!.trim(), serviceKey!.trim()));
    results.push(await checkStorage(url!.trim(), serviceKey!.trim()));
  }
  results.push(...checkEmail(env));
  results.push(...(await checkAnthropic(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL)));
  results.push(await checkPaystack(env.PAYSTACK_SECRET_KEY));
  return results;
}
