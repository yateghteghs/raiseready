import { after } from "next/server";

import { planLabel, productLabel } from "@/lib/admin/labels";
import { emailConfigured, sendEmail, type EmailMessage } from "@/lib/email/mailtrap";
import {
  accountDeletedEmail,
  accountStatusEmail,
  outOfPracticeEmail,
  passwordChangedEmail,
  planEndedEmail,
  receiptEmail,
  renewalFailedEmail,
} from "@/lib/email/templates";
import { formatMoney } from "@/lib/format";
import { getSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Emails triggered by things that happen on the site (payments, limits,
 * account changes). All best-effort: they never throw and never hold up the
 * action that caused them. With no Mailtrap token they do nothing at all.
 */

/** Runs `task` after the response is sent when inside a request, otherwise straight away. */
export function runLater(task: () => Promise<unknown>): void {
  try {
    after(task);
  } catch {
    void task().catch(() => {});
  }
}

async function appUrl(): Promise<string> {
  return process.env.APP_URL || (await getSiteUrl().catch(() => ""));
}

/** The founder's email and name, or null when the account has no email. */
async function contact(userId: string): Promise<{ email: string; name?: string } | null> {
  const admin = createAdminClient();
  const [{ data: auth }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
  ]);
  const email = auth.user?.email;
  if (!email) return null;
  return { email, name: profile?.full_name ?? undefined };
}

/**
 * Sends an email at most once per `key` (e.g. "receipt:<reference>"): the key
 * is recorded first, so a second call for the same event does nothing, and
 * removed again if Mailtrap doesn't accept the email.
 */
export async function sendOnce(
  key: string,
  kind: string,
  userId: string,
  build: (to: { email: string; name?: string }, app: string) => Omit<EmailMessage, "to">,
): Promise<"sent" | "skipped" | "failed"> {
  if (!emailConfigured()) return "skipped";
  try {
    const admin = createAdminClient();
    // Claim the event: only the first call gets the row back.
    const { data: claimed, error: claimError } = await admin
      .from("email_events")
      .upsert({ key, user_id: userId, kind }, { onConflict: "key", ignoreDuplicates: true })
      .select("key");
    if (claimError || !claimed?.length) return "skipped"; // already sent (or being sent) for this event
    const to = await contact(userId);
    if (!to) return "skipped";
    const result = await sendEmail({ to: [to], ...build(to, await appUrl()) });
    if (result.ok) return "sent";
    await admin.from("email_events").delete().eq("key", key);
    return "failed";
  } catch (error) {
    console.error(`[email] ${kind} email failed: ${error instanceof Error ? error.message : error}`);
    return "failed";
  }
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** Receipt for a successful payment; once per payment reference. */
export function notifyReceipt(input: { userId: string; reference: string; product: string; amountMinor: number; currency: string; paidAt?: string | null; renewal: boolean }) {
  if (input.amountMinor <= 0) return; // free with a 100% code: nothing was paid
  runLater(() =>
    sendOnce(`receipt:${input.reference}`, "receipt", input.userId, (to, app) => ({
      ...receiptEmail({
        name: to.name,
        item: productLabel(input.product),
        amount: formatMoney(input.amountMinor / 100, input.currency),
        date: dateFormat.format(input.paidAt ? new Date(input.paidAt) : new Date()),
        reference: input.reference,
        renewal: input.renewal,
        appUrl: app,
      }),
      category: "Receipt",
    })),
  );
}

/** A renewal charge failed; at most once per subscription per month. */
export function notifyRenewalFailed(userId: string, subscriptionCode: string, plan: string) {
  const month = new Date().toISOString().slice(0, 7);
  runLater(() =>
    sendOnce(`renewal_failed:${subscriptionCode}:${month}`, "renewal_failed", userId, (to, app) => ({
      ...renewalFailedEmail({ name: to.name, plan: planLabel(plan), appUrl: app }),
      category: "Renewal failed",
    })),
  );
}

/** The founder's plan ended and they're back on Free; once per subscription. */
export function notifyPlanEnded(userId: string, subscriptionCode: string, plan: string) {
  runLater(() =>
    sendOnce(`plan_ended:${subscriptionCode}`, "plan_ended", userId, (to, app) => ({
      ...planEndedEmail({ name: to.name, plan: planLabel(plan), appUrl: app }),
      category: "Plan ended",
    })),
  );
}

/** The founder just used their last practice session: once a month on a paid plan, once ever on Free. */
export function notifyOutOfPractice(userId: string, plan: "free" | "pro" | "pro_plus") {
  const paid = plan !== "free";
  const key = paid ? `out_of_practice:${userId}:${new Date().toISOString().slice(0, 7)}` : `out_of_practice:${userId}:free`;
  runLater(() =>
    sendOnce(key, "out_of_practice", userId, (to, app) => ({
      ...outOfPracticeEmail({ name: to.name, paid, plan: planLabel(plan), appUrl: app }),
      category: "Out of practice sessions",
      sender: "personal",
    })),
  );
}

/** Security notice; sent every time the password changes. */
export function notifyPasswordChanged(userId: string) {
  runLater(() =>
    sendOnce(`password_changed:${userId}:${Date.now()}`, "password_changed", userId, (to, app) => ({
      ...passwordChangedEmail({ name: to.name, appUrl: app }),
      category: "Password changed",
    })),
  );
}

/** Staff suspended, reactivated or closed the account. */
export function notifyAccountStatus(userId: string, status: "suspended" | "reactivated" | "terminated", reason?: string | null) {
  runLater(() =>
    sendOnce(`account_${status}:${userId}:${Date.now()}`, `account_${status}`, userId, (to, app) => ({
      ...accountStatusEmail({ name: to.name, status, reason, appUrl: app }),
      category: "Account status",
    })),
  );
}

/** Fetches who to tell before an account is deleted; the email itself goes after. */
export async function deletedAccountContact(userId: string) {
  if (!emailConfigured()) return null;
  return contact(userId).catch(() => null);
}

/** Confirmation that the account is gone (sent to the address it had). */
export function notifyAccountDeleted(to: { email: string; name?: string } | null) {
  if (!to) return;
  runLater(() => sendEmail({ to: [to], ...accountDeletedEmail({ name: to.name }), category: "Account deleted" }));
}
