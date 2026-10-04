"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { recordSignIn } from "@/lib/activity/service";
import { isStaffProfile } from "@/lib/admin/auth";
import { authErrorCode, friendlyAuthError, logAuthError } from "@/lib/auth/errors";
import { safeNextPath } from "@/lib/auth/redirect";
import { loginSchema } from "@/lib/auth/schemas";
import { isSupabaseConfigured } from "@/lib/env";
import { formValues, validationFailed, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const NO_ACCESS = "This account doesn't have admin access. Founders log in on the main login page.";

/** Admin sign-in: the usual email and password, then only staff accounts are let in. */
export async function adminLogin(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return { status: "error", message: friendlyAuthError({ code: "supabase_not_configured" }) };
  const values = formValues(formData);
  delete values.password;
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationFailed(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  const userAgent = (await headers()).get("user-agent");
  const record = (succeeded: boolean, failureCode: string | null) =>
    after(() =>
      recordSignIn({ email: parsed.data.email, userId: data.user?.id ?? null, succeeded, surface: "admin", failureCode, userAgent }),
    );
  if (error && error.code !== "invalid_credentials") logAuthError("admin login", error);
  if (error || !data.user) {
    record(false, error ? authErrorCode(error) : "unknown");
    return { status: "error", message: friendlyAuthError(error), values };
  }

  const { data: profile } = await supabase.from("profiles").select("role, status").eq("id", data.user.id).maybeSingle();
  if (!isStaffProfile(profile)) {
    // Right password, but not staff: worth seeing in the history.
    record(false, "no_admin_access");
    await supabase.auth.signOut({ scope: "local" });
    return { status: "error", message: NO_ACCESS, values };
  }
  record(true, null);

  const next = safeNextPath(formData.get("next"), "/admin");
  redirect(next.startsWith("/admin") || next === "/status" ? next : "/admin");
}
