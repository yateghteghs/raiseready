import { createClient } from "@supabase/supabase-js";

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
    const { error } = await supabase.from("profiles").select("id", { count: "exact", head: true });
    if (!error) return { name, ok: true, detail: "Found. The database setup script has been run." };
    if (error.code === "42P01" || error.code === "PGRST205") {
      return { name, ok: false, detail: "Tables not found. Run the database setup script in the Supabase SQL Editor." };
    }
    return { name, ok: false, detail: `Database error (code ${error.code || "unknown"}).` };
  } catch {
    return { name, ok: false, detail: "Couldn't reach the database." };
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
  if (urlCheck.ok && serviceKeyCheck.ok) results.push(await checkDatabase(url!.trim(), serviceKey!.trim()));
  return results;
}
