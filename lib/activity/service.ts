import { createHash } from "node:crypto";

import { deviceLabel } from "@/lib/activity/device";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Sign-in history, daily activity and the error log. Everything here is
 * best-effort: a logging failure never blocks a sign-in or a page.
 * Records are kept 90 days (public.prune_activity).
 */

export function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

/** "YYYY-MM-DD" in Lagos time, so a day matches the founder's day. */
export function lagosDay(at: number = Date.now()): string {
  return new Date(at + 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Roughly one write in fifty also clears records older than 90 days. */
async function maybePrune() {
  if (Math.random() < 0.02) await createAdminClient().rpc("prune_activity");
}

export async function recordSignIn(input: {
  email: string;
  userId: string | null;
  succeeded: boolean;
  surface: "app" | "admin";
  failureCode?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  try {
    const { error } = await createAdminClient()
      .from("sign_in_events")
      .insert({
        user_id: input.userId,
        email_hash: hashEmail(input.email),
        succeeded: input.succeeded,
        surface: input.surface,
        failure_code: input.failureCode?.slice(0, 60) ?? null,
        device: deviceLabel(input.userAgent)?.slice(0, 80) ?? null,
      });
    if (error) console.error(`Could not record sign-in: ${error.message}`);
    await maybePrune();
  } catch (error) {
    console.error("Could not record sign-in:", error);
  }
}

/** How stale last_seen_at may get before we write it again. */
const SEEN_EVERY_MS = 10 * 60 * 1000;

/** Marks a founder as active now (at most every 10 minutes) and records today as an active day. */
export async function touchActivity(userId: string, lastSeenAt: string | null): Promise<void> {
  if (lastSeenAt && Date.now() - Date.parse(lastSeenAt) < SEEN_EVERY_MS) return;
  try {
    const admin = createAdminClient();
    await Promise.all([
      admin.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", userId),
      admin.from("user_activity_days").upsert({ user_id: userId, day: lagosDay() }, { onConflict: "user_id,day", ignoreDuplicates: true }),
    ]);
  } catch (error) {
    console.error("Could not record activity:", error);
  }
}

/** Errors Next.js uses for redirects and 404s, which aren't failures. */
export function isControlFlowError(digest: string | null | undefined, message: string): boolean {
  return /^NEXT_(REDIRECT|NOT_FOUND|HTTP_ERROR_FALLBACK)/.test(digest ?? "") || /^NEXT_(REDIRECT|NOT_FOUND)/.test(message);
}

/** Most browser errors stored per minute, so a broken or hostile page can't flood the log. */
const BROWSER_ERRORS_PER_MINUTE = 60;

export async function recordError(input: {
  source: "server" | "browser";
  message: string;
  digest?: string | null;
  path?: string | null;
  routeType?: string | null;
  userId?: string | null;
}): Promise<void> {
  if (isControlFlowError(input.digest, input.message)) return;
  try {
    const admin = createAdminClient();
    if (input.source === "browser") {
      const { count } = await admin
        .from("app_errors")
        .select("id", { count: "exact", head: true })
        .eq("source", "browser")
        .gte("created_at", new Date(Date.now() - 60_000).toISOString());
      if ((count ?? 0) >= BROWSER_ERRORS_PER_MINUTE) return;
    }
    const { error } = await admin.from("app_errors").insert({
      source: input.source,
      message: input.message.slice(0, 2000) || "(no message)",
      digest: input.digest?.slice(0, 100) ?? null,
      path: input.path?.split("?")[0].slice(0, 500) ?? null,
      route_type: input.routeType?.slice(0, 40) ?? null,
      user_id: input.userId ?? null,
    });
    if (error) console.error(`Could not record error: ${error.message}`);
    await maybePrune();
  } catch (error) {
    console.error("Could not record error:", error);
  }
}
