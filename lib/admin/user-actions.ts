"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getStaff } from "@/lib/admin/auth";
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
  z.object({ type: z.literal("change_role"), role: z.enum(["founder", "viewer", "support", "admin"], { error: "Choose a role." }) }),
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
    await applyUserAction(
      staff,
      targetId,
      input.type === "change_role" ? { type: "change_role", role: input.role } : { type: input.type },
      ("reason" in input && input.reason) || ("terminate_reason" in input && input.terminate_reason) || undefined,
    );
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
  };
  return { status: "success", message: done[input.type] };
}
