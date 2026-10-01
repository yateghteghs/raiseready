import { AccountError, cancelSubscriptions, deleteAccount } from "@/lib/account/service";
import type { Staff } from "@/lib/admin/auth";
import { userActionProblem, type UserAction } from "@/lib/admin/permissions";
import { getSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

/** A refused admin action; the message is shown to the staff member. */
export class AdminActionError extends Error {}

/** Supabase Auth ban long enough to be permanent (about 100 years). */
const BAN_FOREVER = "876000h";

async function audit(actorId: string, action: string, targetId: string, metadata: Record<string, unknown>) {
  const { error } = await createAdminClient()
    .from("audit_logs")
    .insert({ actor_id: actorId, action, target_type: "profile", target_id: targetId, metadata: metadata as Json });
  if (error) console.error(`Audit log failed for ${action} on ${targetId}: ${error.message}`);
}

async function setBan(userId: string, duration: string) {
  const { error } = await createAdminClient().auth.admin.updateUserById(userId, { ban_duration: duration });
  if (error) throw new Error(`Could not update sign-in ban: ${error.message}`);
}

/**
 * Applies an admin action to a user after checking the actor's permissions
 * (lib/admin/permissions.ts). Every action is audit-logged with the actor.
 *
 * Suspend and terminate update the profile status first, which the app
 * checks on every request, then ban the account in Supabase Auth so no new
 * session can start.
 */
export async function applyUserAction(staff: Staff, targetId: string, action: UserAction, reason?: string): Promise<void> {
  const admin = createAdminClient();
  const { data: target, error } = await admin.from("profiles").select("id, role, status").eq("id", targetId).maybeSingle();
  if (error) throw new Error(`Could not load user: ${error.message}`);
  if (!target) throw new AdminActionError("This user no longer exists.");

  const problem = userActionProblem({ id: staff.id, role: staff.profile.role, status: staff.profile.status }, target, action);
  if (problem) throw new AdminActionError(problem);

  const now = new Date().toISOString();
  const setStatus = async (status: "active" | "suspended" | "terminated") => {
    const { error: updateError } = await admin
      .from("profiles")
      .update({ status, status_reason: status === "active" ? null : (reason ?? null), status_changed_at: now })
      .eq("id", targetId);
    if (updateError) throw new Error(`Could not update status: ${updateError.message}`);
  };

  switch (action.type) {
    case "suspend":
      await setStatus("suspended");
      await setBan(targetId, BAN_FOREVER);
      await audit(staff.id, "admin.user_suspended", targetId, { reason: reason ?? null });
      return;
    case "reactivate":
      await setBan(targetId, "none");
      await setStatus("active");
      await audit(staff.id, "admin.user_reactivated", targetId, {});
      return;
    case "terminate": {
      // A terminated account must not keep paying for Pro.
      let cancelled: number;
      try {
        cancelled = await cancelSubscriptions(targetId);
      } catch (cause) {
        if (cause instanceof AccountError) throw new AdminActionError(cause.message);
        throw cause;
      }
      await setStatus("terminated");
      // Staff roles go with termination, so a terminated account can never sign in to admin.
      await admin.from("profiles").update({ role: "founder" }).eq("id", targetId);
      await setBan(targetId, BAN_FOREVER);
      await audit(staff.id, "admin.user_terminated", targetId, { reason: reason ?? null, subscriptions_cancelled: cancelled });
      return;
    }
    case "delete":
      try {
        await deleteAccount(targetId, { actorId: staff.id });
      } catch (cause) {
        if (cause instanceof AccountError) throw new AdminActionError(cause.message);
        throw cause;
      }
      return;
    case "reset_password": {
      // Staff never see or set passwords: the person gets an email and picks their own.
      const { data: authUser } = await admin.auth.admin.getUserById(targetId);
      const email = authUser.user?.email;
      if (!email) throw new AdminActionError("This account has no email address.");
      const siteUrl = await getSiteUrl();
      const { error: resetError } = await admin.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
      });
      if (resetError?.code === "over_email_send_rate_limit" || resetError?.code === "over_request_rate_limit") {
        throw new AdminActionError("Too many emails sent recently. Wait a few minutes and try again.");
      }
      if (resetError) throw new Error(`Could not send reset email: ${resetError.message}`);
      await audit(staff.id, "admin.password_reset_sent", targetId, {});
      return;
    }
    case "grant_credits": {
      const { data: balance, error: creditError } = await admin.rpc("add_credits", { p_user_id: targetId, p_amount: action.amount });
      if (creditError || balance === null) throw new Error(`Could not add credits: ${creditError?.message ?? "no balance returned"}`);
      await audit(staff.id, "admin.credits_granted", targetId, { amount: action.amount, balance, reason: reason ?? null });
      return;
    }
    case "change_role": {
      const from = target.role;
      const { error: roleError } = await admin.from("profiles").update({ role: action.role }).eq("id", targetId);
      if (roleError) throw new Error(`Could not change role: ${roleError.message}`);
      await audit(staff.id, "profile.role_changed", targetId, { from, role: action.role });
      return;
    }
  }
}
