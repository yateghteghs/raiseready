"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AccountError, deleteAccount, updateAccountDetails } from "@/lib/account/service";
import { accountDetailsSchema, deleteAccountSchema } from "@/lib/account/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { formValues, validationFailed, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const NOT_SIGNED_IN: FormState = { status: "error", message: "Your session has ended. Please log in again." };

export async function saveAccountDetails(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const values = formValues(formData);
  const parsed = accountDetailsSchema.safeParse(values);
  if (!parsed.success) return validationFailed(parsed.error, values);
  try {
    await updateAccountDetails(user.id, parsed.data);
  } catch (error) {
    console.error(error);
    return { status: "error", message: "We couldn't save your changes. Please try again.", values };
  }
  revalidatePath("/app", "layout");
  return { status: "success", message: "Account details saved.", values };
}

export async function deleteMyAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const values = formValues(formData);
  const parsed = deleteAccountSchema.safeParse(values);
  if (!parsed.success) return validationFailed(parsed.error, values);
  try {
    await deleteAccount(user.id);
  } catch (error) {
    console.error(error);
    const message =
      error instanceof AccountError ? error.message : "We couldn't finish deleting your account. Please try again.";
    return { status: "error", message, values };
  }
  // The user no longer exists; clear the session cookies.
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/account-deleted");
}
