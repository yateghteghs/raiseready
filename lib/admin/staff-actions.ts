"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getStaff } from "@/lib/admin/auth";
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
    const link = await inviteStaff(staff, parsed.data);
    revalidatePath("/admin/users");
    return {
      status: "success",
      message: `Account created for ${parsed.data.email}. Send them this link; it works once and expires (by default after an hour).`,
      link,
    };
  } catch (error) {
    if (error instanceof StaffInviteError) return { status: "error", message: error.message, values };
    console.error("[staff] invite failed:", error);
    return { status: "error", message: "Something went wrong. No account was created.", values };
  }
}

export async function newStaffLinkAction(targetId: string): Promise<{ link?: string; error?: string }> {
  const staff = await getStaff();
  if (!staff) return { error: "Your admin session has ended. Please sign in again." };
  if (!z.uuid().safeParse(targetId).success) return { error: "Unknown user." };
  try {
    return { link: await newStaffLink(staff, targetId) };
  } catch (error) {
    if (error instanceof StaffInviteError) return { error: error.message };
    console.error("[staff] link failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
}
