"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getStaff } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import { emailConfigured, sendEmail } from "@/lib/email/mailtrap";
import { testEmail } from "@/lib/email/templates";
import { inviteStaff, newStaffLink, StaffInviteError, staffInviteSchema } from "@/lib/admin/staff";
import { formValues, validationFailed, type FormState } from "@/lib/forms";

export type InviteState = FormState & { link?: string };

export async function inviteStaffAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const staff = await getStaff();
  if (!staff) return { status: "error", message: "Your admin session has ended. Please sign in again." };
  const values = formValues(formData);
  const parsed = staffInviteSchema.safeParse(values);
  if (!parsed.success) return validationFailed(parsed.error, values);
  try {
    const { link, emailed } = await inviteStaff(staff, parsed.data);
    revalidatePath("/admin/users");
    return {
      status: "success",
      message: emailed
        ? `Account created and the invite emailed to ${parsed.data.email}. The link is below too, in case it doesn't arrive; it works once and expires (by default after an hour).`
        : `Account created for ${parsed.data.email}. Send them this link; it works once and expires (by default after an hour).`,
      link,
    };
  } catch (error) {
    if (error instanceof StaffInviteError) return { status: "error", message: error.message, values };
    console.error("[staff] invite failed:", error);
    return { status: "error", message: "Something went wrong. No account was created.", values };
  }
}

export async function newStaffLinkAction(targetId: string): Promise<{ link?: string; emailed?: boolean; error?: string }> {
  const staff = await getStaff();
  if (!staff) return { error: "Your admin session has ended. Please sign in again." };
  if (!z.uuid().safeParse(targetId).success) return { error: "Unknown user." };
  try {
    return await newStaffLink(staff, targetId);
  } catch (error) {
    if (error instanceof StaffInviteError) return { error: error.message };
    console.error("[staff] link failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}

/** Super admins check that Mailtrap works by emailing themselves. */
export async function sendTestEmailAction(): Promise<{ message?: string; error?: string }> {
  const staff = await getStaff();
  if (!staff || !can(staff.profile.role, "manage_content")) return { error: "Only a super admin can send a test email." };
  if (!emailConfigured()) return { error: "Email isn't set up: add MAILTRAP_API_TOKEN in Vercel, then redeploy." };
  if (!staff.email) return { error: "Your account has no email address." };
  const result = await sendEmail({ to: [{ email: staff.email }], ...testEmail({ sentBy: staff.email }), category: "Test", sender: "personal" });
  return result.ok
    ? { message: `Sent to ${staff.email}. It should arrive within a minute; check spam too. Mailtrap's Email Logs show every message.` }
    : { error: `Mailtrap didn't send it: ${result.reason}. Check the token, and that indexprima.com is verified in Mailtrap.` };
}
