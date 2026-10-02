import { disableSubscription } from "@/lib/billing/paystack";
import { DOCUMENTS_BUCKET } from "@/lib/documents/service";
import { IMAGES_BUCKET } from "@/lib/images/rules";
import { REPORTS_BUCKET } from "@/lib/reports/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** A deletion problem the founder can act on; the message is shown to them. */
export class AccountError extends Error {}

/** Updates the founder's own name and country. Runs as the user, so RLS applies. */
export async function updateAccountDetails(userId: string, input: { full_name: string; country: string }): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: input.full_name, country: input.country })
    .eq("id", userId)
    .select("id");
  if (error) throw new Error(`Could not update profile: ${error.message}`);
  if (!data?.length) throw new Error("Profile not found for the signed-in user.");
}

/** Every stored object under the user's folder (`<userId>/<startupId>/<file>`). */
async function filesUnder(bucket: string, userId: string): Promise<string[]> {
  const storage = createAdminClient().storage.from(bucket);
  const paths: string[] = [];
  const pending = [userId];
  while (pending.length) {
    const folder = pending.pop()!;
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await storage.list(folder, { limit: 1000, offset });
      if (error) throw new Error(`Could not list ${bucket}/${folder}: ${error.message}`);
      for (const entry of data ?? []) {
        // Folders come back without an id.
        if (entry.id === null) pending.push(`${folder}/${entry.name}`);
        else paths.push(`${folder}/${entry.name}`);
      }
      if ((data ?? []).length < 1000) break;
    }
  }
  return paths;
}

async function removeFiles(bucket: string, userId: string): Promise<number> {
  const paths = await filesUnder(bucket, userId);
  const storage = createAdminClient().storage.from(bucket);
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await storage.remove(paths.slice(i, i + 100));
    if (error) throw new Error(`Could not remove files from ${bucket}: ${error.message}`);
  }
  return paths.length;
}

/**
 * Stops any Pro renewal at Paystack. Throws AccountError if Paystack can't be
 * reached, so callers stop before doing anything irreversible.
 */
export async function cancelSubscriptions(userId: string): Promise<number> {
  const { data: subs, error } = await createAdminClient()
    .from("subscriptions")
    .select("provider_subscription_code, status")
    .eq("user_id", userId);
  if (error) throw new Error(`Could not load subscriptions: ${error.message}`);
  let cancelled = 0;
  for (const sub of subs ?? []) {
    if (!sub.provider_subscription_code || sub.status === "cancelled" || sub.status === "completed") continue;
    try {
      await disableSubscription(sub.provider_subscription_code);
      cancelled++;
    } catch (cause) {
      console.error(cause);
      throw new AccountError(
        "We couldn't cancel the Pro subscription with Paystack, so nothing has been changed. Please try again in a few minutes, or cancel the subscription from the Billing page first.",
      );
    }
  }
  return cancelled;
}

/**
 * Hard-deletes a founder's account (spec 8): stops any Pro renewal at
 * Paystack, removes their stored files, then deletes the auth user, which
 * cascades to every row they own, payments included. AI usage rows are kept
 * for cost totals with the user unlinked. The deletion is logged in
 * audit_logs without personal details, with the amount they had paid so
 * revenue history still adds up.
 */
export async function deleteAccount(userId: string, options: { actorId?: string | null } = {}): Promise<void> {
  const admin = createAdminClient();
  const cancelled = await cancelSubscriptions(userId);

  const { data: payments, error: paymentsError } = await admin
    .from("payments")
    .select("amount_kobo, status, currency")
    .eq("user_id", userId);
  if (paymentsError) throw new Error(`Could not load payments: ${paymentsError.message}`);
  const paid = (payments ?? []).filter((p) => p.status === "success");

  // Files first: if a later step fails the account still exists and the
  // founder can retry, rather than leaving files nobody can reach.
  const documents = await removeFiles(DOCUMENTS_BUCKET, userId);
  const reports = await removeFiles(REPORTS_BUCKET, userId);
  const images = await removeFiles(IMAGES_BUCKET, userId);

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(`Could not delete auth user: ${error.message}`);

  const { error: auditError } = await admin.from("audit_logs").insert({
    actor_id: options.actorId ?? null,
    action: "account.deleted",
    target_type: "profile",
    target_id: userId,
    metadata: {
      payments: paid.length,
      // Per currency, in each currency's smallest unit (kobo, cents).
      paid: paid.reduce<Record<string, number>>((by, p) => ({ ...by, [p.currency]: (by[p.currency] ?? 0) + p.amount_kobo }), {}),
      files_removed: { documents, reports, images },
      subscriptions_cancelled: cancelled,
      by: options.actorId ? "staff" : "founder",
    },
  });
  if (auditError) console.error(`Account ${userId} deleted but the audit log failed: ${auditError.message}`);
}
