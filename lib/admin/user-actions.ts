"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getStaff } from "@/lib/admin/auth";
import { MAX_GRANT, type UserAction } from "@/lib/admin/permissions";
import { AdminActionError, applyUserAction } from "@/lib/admin/users";
import { formValues, validationFailed, type FormState } from "@/lib/forms";

const confirmWord = (word: string) =>
  z.string().trim().refine((v) => v.toUpperCase() === word, { error: `Type ${word} to confirm.` });
const reason = z.string().trim().max(500, { error: "Use at most 500 characters." }).optional();

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("suspend"), reason }),
  z.object({ type: z.literal("reactivate") }),
  z.object({ type: z.literal("terminate"), terminate_reason: reason, confirm_terminate: confirmWord("TERMINATE") }),
  z.object({ type: z.literal("delete"), confirm_delete: confirmWord("DELETE") }),
  z.object({
    type: z.literal("change_role"),
    role: z.enum(["founder", "viewer", "support", "admin", "super_admin"], { error: "Choose a role." }),
  }),
  z.object({ type: z.literal("reset_password") }),
  z.object({
    type: z.literal("grant_credits"),
    amount: z.coerce.number({ error: "Enter a number." }).int({ error: "Use a whole number." }).min(1).max(MAX_GRANT, { error: `At most ${MAX_GRANT} at a time.` }),
    credit_reason: reason,
  }),
]);

/** One entry point for every admin action on a user; permissions are checked in applyUserAction. */
export async function userAdminAction(targetId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await getStaff();
  if (!staff) return { status: "error", message: "Your admin session has ended. Please sign in again." };
  if (!z.uuid().safeParse(targetId).success) return { status: "error", message: "Unknown user." };

  const values = formValues(formData);
  const parsed = actionSchema.safeParse(values);
  if (!parsed.success) return validationFailed(parsed.error, values);
  const input = parsed.data;

  try {
    const action: UserAction =
      input.type === "change_role"
        ? { type: "change_role", role: input.role }
        : input.type === "grant_credits"
          ? { type: "grant_credits", amount: input.amount }
          : { type: input.type };
    const why =
      ("reason" in input && input.reason) ||
      ("terminate_reason" in input && input.terminate_reason) ||
      ("credit_reason" in input && input.credit_reason) ||
      undefined;
    await applyUserAction(staff, targetId, action, why);
  } catch (error) {
    if (error instanceof AdminActionError) return { status: "error", message: error.message, values };
    console.error("[admin] user action failed:", error);
    return { status: "error", message: "Something went wrong. Nothing may have changed; refresh and try again.", values };
  }

  revalidatePath("/admin", "layout");
  if (input.type === "delete") redirect("/admin/users?deleted=1");
  const done: Record<string, string> = {
    suspend: "Account suspended. They have been signed out and can't sign in.",
    reactivate: "Account reactivated. They can sign in again.",
    terminate: "Account terminated permanently.",
    change_role: "Role updated.",
    reset_password: "Password reset email sent. The link in it works once and expires after an hour.",
    grant_credits: "Credits added.",
  };
  return { status: "success", message: done[input.type] };
}
