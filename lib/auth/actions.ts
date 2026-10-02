"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { recordSignIn } from "@/lib/activity/service";
import { authErrorCode, friendlyAuthError, logAuthError } from "@/lib/auth/errors";
import { safeNextPath } from "@/lib/auth/redirect";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/auth/schemas";
import { isSupabaseConfigured } from "@/lib/env";
import { formValues, validationFailed, type FormState } from "@/lib/forms";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

const NOT_CONFIGURED: FormState = {
  status: "error",
  message: friendlyAuthError({ code: "supabase_not_configured" }),
};

/** Values echoed back to the form after an error. Passwords never are. */
function safeValues(formData: FormData) {
  const values = formValues(formData);
  delete values.password;
  delete values.confirm_password;
  return values;
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const values = safeValues(formData);
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationFailed(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  const userAgent = (await headers()).get("user-agent");
  after(() =>
    recordSignIn({
      email: parsed.data.email,
      userId: data.user?.id ?? null,
      succeeded: !error,
      surface: "app",
      failureCode: error ? authErrorCode(error) : null,
      userAgent,
    }),
  );
  if (error && error.code !== "invalid_credentials") logAuthError("login", error);
  if (error) return { status: "error", message: friendlyAuthError(error), values };

  redirect(safeNextPath(formData.get("next")));
}

export async function register(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const values = safeValues(formData);
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationFailed(parsed.error, values);

  const supabase = await createClient();
  const siteUrl = await getSiteUrl();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name },
      emailRedirectTo: `${siteUrl}/auth/callback?next=/app/onboarding`,
    },
  });
  if (error) {
    logAuthError("sign-up", error);
    return { status: "error", message: friendlyAuthError(error), values };
  }

  // With email confirmation off, Supabase signs the user in immediately.
  if (data.session) redirect("/app/onboarding");

  return {
    status: "success",
    message: `We've sent a confirmation link to ${parsed.data.email}. Open it to activate your account.`,
  };
}

export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const values = safeValues(formData);
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationFailed(parsed.error, values);

  const supabase = await createClient();
  const siteUrl = await getSiteUrl();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
  });
  if (error) logAuthError("password reset request", error);
  if (error && (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit")) {
    return { status: "error", message: friendlyAuthError(error), values };
  }

  // Same message whether or not the account exists, so this form can't be
  // used to discover who has an account.
  return {
    status: "success",
    message: `If an account exists for ${parsed.data.email}, we've sent a link to reset the password.`,
  };
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationFailed(parsed.error, {});

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return {
      status: "error",
      message: "This reset link has expired. Request a new one from the 'Forgot password' page.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) logAuthError("password update", error);
  if (error) return { status: "error", message: friendlyAuthError(error) };

  redirect("/app");
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
