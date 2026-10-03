import { z } from "zod";

import type { Staff } from "@/lib/admin/auth";
import { can, isStaff, roleLabel, userActionProblem } from "@/lib/admin/permissions";
import { sendEmail } from "@/lib/email/mailtrap";
import { staffInviteEmail, staffSignInEmail } from "@/lib/email/templates";
import { userIdForEmail } from "@/lib/notifications/service";
import { getSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/supabase/database.types";

/** A refused staff invite; the message is shown to the staff member. */
export class StaffInviteError extends Error {}

export const STAFF_ROLES = ["viewer", "support", "admin", "super_admin"] as const satisfies readonly UserRole[];

export const staffInviteSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email({ error: "Enter a valid email address." })),
  full_name: z.string().trim().min(2, { error: "Enter their name." }).max(100, { error: "Use at most 100 characters." }),
  role: z.enum(STAFF_ROLES, { error: "Choose a role." }),
});

/** Whether `actorRole` may invite someone with `role`; admins invite up to Support, super admins anyone. */
export function staffInviteProblem(actorRole: UserRole, role: UserRole): string | null {
  if (!can(actorRole, "change_role")) return "Your role doesn't allow inviting staff.";
  if ((role === "admin" || role === "super_admin") && actorRole !== "super_admin") return "Only a super admin can invite an admin.";
  return null;
}

/** Where a staff sign-in link lands: the admin welcome page, which asks them to choose a password. */
async function staffLink(hashedToken: string, type: "invite" | "magiclink"): Promise<string> {
  const site = await getSiteUrl();
  return `${site}/auth/callback?token_hash=${encodeURIComponent(hashedToken)}&type=${type}&next=/admin/welcome`;
}

/** A staff link, and whether it was also emailed (Mailtrap set up and accepted it). */
export type StaffLink = { link: string; emailed: boolean };

/**
 * Creates a staff account and returns a one-time link for them to set their
 * password. Staff never go through founder sign-up or onboarding. The link is
 * emailed when Mailtrap is set up, and always shown to the inviter as well.
 */
export async function inviteStaff(staff: Staff, input: z.infer<typeof staffInviteSchema>): Promise<StaffLink> {
  const problem = staffInviteProblem(staff.profile.role, input.role);
  if (problem) throw new StaffInviteError(problem);
  const admin = createAdminClient();

  const existingId = await userIdForEmail(input.email);
  if (existingId) {
    const { data: existing } = await admin.from("profiles").select("role").eq("id", existingId).maybeSingle();
    throw new StaffInviteError(
      existing && isStaff(existing.role)
        ? "This person is already staff. Use 'New sign-in link' on the Staff tab if they can't get in."
        : "This email already has a founder account. Open it on the Founders tab and change its role instead.",
    );
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email: input.email,
    options: { data: { full_name: input.full_name } },
  });
  if (error || !data.user) throw new Error(`Could not create the staff account: ${error?.message ?? "no user"}`);

  const { error: roleError } = await admin.from("profiles").update({ role: input.role, full_name: input.full_name }).eq("id", data.user.id);
  if (roleError) throw new Error(`Could not set the staff role: ${roleError.message}`);
  await admin.from("audit_logs").insert({
    actor_id: staff.id,
    action: "admin.staff_invited",
    target_type: "profile",
    target_id: data.user.id,
    metadata: { role: input.role },
  });
  const link = await staffLink(data.properties.hashed_token, "invite");
  const sent = await sendEmail({
    to: [{ email: input.email, name: input.full_name }],
    ...staffInviteEmail({ name: input.full_name, role: roleLabel(input.role), link }),
    category: "Staff invite",
    sender: "personal",
  });
  return { link, emailed: sent.ok };
}

/** A fresh one-time sign-in link for a staff member who hasn't set a password or can't get in. */
export async function newStaffLink(staff: Staff, targetId: string): Promise<StaffLink> {
  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("id, role, status").eq("id", targetId).maybeSingle();
  if (!target || !isStaff(target.role)) throw new StaffInviteError("This person isn't staff.");
  const problem = userActionProblem({ id: staff.id, role: staff.profile.role, status: staff.profile.status }, target, { type: "reset_password" });
  if (problem) throw new StaffInviteError(problem);

  const { data: user } = await admin.auth.admin.getUserById(targetId);
  if (!user.user?.email) throw new StaffInviteError("This account has no email address.");
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: user.user.email });
  if (error) throw new Error(`Could not create a sign-in link: ${error.message}`);
  await admin.from("audit_logs").insert({
    actor_id: staff.id,
    action: "admin.staff_link_created",
    target_type: "profile",
    target_id: targetId,
    metadata: {},
  });
  const link = await staffLink(data.properties.hashed_token, "magiclink");
  const sent = await sendEmail({ to: [{ email: user.user.email }], ...staffSignInEmail({ link }), category: "Staff sign-in link" });
  return { link, emailed: sent.ok };
}
