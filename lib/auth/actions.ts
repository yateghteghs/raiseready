"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { recordSignIn } from "@/lib/activity/service";
import { REFERRAL_COOKIE } from "@/lib/referrals/code";
import { linkReferral } from "@/lib/referrals/service";
import { authErrorCode, friendlyAuthError, logAuthError } from "@/lib/auth/errors";
import { isStaffProfile } from "@/lib/admin/auth";
import { notifyPasswordChanged } from "@/lib/email/notify";
import { sendWelcomeEmail } from "@/lib/email/welcome";
import { DEFAULT_AFTER_LOGIN, safeNextPath } from "@/lib/auth/redirect";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/auth/schemas";
import { isSupabaseConfigured } from "@/lib/env";
import { formValues, validationFailed, type FormState } from "@/lib/forms";
import { localiseState } from "@/lib/i18n/server";
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

/** Results are translated into the visitor's language. */
export async function login(prev: FormState, formData: FormData): Promise<FormState> {
  return localiseState(await loginInEnglish(prev, formData));
}

async function loginInEnglish(_prev: FormState, formData: FormData): Promise<FormState> {
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

  // Founders who confirmed in another browser get their welcome on first login.
  const userId = data.user.id;
  after(() => sendWelcomeEmail(userId));

  const next = safeNextPath(formData.get("next"));
  // Staff land in the admin area unless a link sent them somewhere specific.
  if (next === DEFAULT_AFTER_LOGIN || next.startsWith("/app/onboarding")) {
    const { data: profile } = await supabase.from("profiles").select("role, status").eq("id", data.user.id).maybeSingle();
    if (isStaffProfile(profile)) redirect("/admin");
  }
  redirect(next);
}

/** Results are translated into the visitor's language. */
export async function register(prev: FormState, formData: FormData): Promise<FormState> {
  return localiseState(await registerInEnglish(prev, formData));
}

async function registerInEnglish(_prev: FormState, formData: FormData): Promise<FormState> {
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
    // A 5xx here comes from the email step (Supabase's mail sender, or our
    // Send Email hook reporting that Mailtrap didn't send), not from sign-in.
    const message =
      error.status !== undefined && error.status >= 500
        ? "We couldn't send your confirmation email just now. Wait a minute, then check your inbox or try again."
        : friendlyAuthError(error);
    return { status: "error", message, values };
  }

  // Arrived through a founder's invite link? Link the accounts. Supabase
  // returns a user with no identities when the email is already registered,
  // so existing accounts are never re-linked.
  const ref = (await cookies()).get(REFERRAL_COOKIE)?.value;
  if (ref && data.user && (data.user.identities?.length ?? 0) > 0) await linkReferral(data.user.id, ref);

  // With email confirmation off, Supabase signs the user in immediately (and
  // counts the address as confirmed), so the welcome email goes now.
  if (data.session) {
    const newUserId = data.session.user.id;
    after(() => sendWelcomeEmail(newUserId));
    redirect("/app/onboarding");
  }

  return {
    status: "success",
    message: `We've sent a confirmation link to ${parsed.data.email}. Open it to activate your account.`,
    values: { email: parsed.data.email },
  };
}

/** "Send it again" on the check-your-email screen. Results are translated. */
export async function resendConfirmation(email: string): Promise<FormState> {
  return localiseState(await resendConfirmationInEnglish(email));
}

async function resendConfirmationInEnglish(email: string): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = forgotPasswordSchema.safeParse({ email });
  if (!parsed.success) return validationFailed(parsed.error, {});
  const supabase = await createClient();
  const siteUrl = await getSiteUrl();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: `${siteUrl}/auth/callback?next=/app/onboarding` },
  });
  if (error) {
    logAuthError("resend confirmation", error);
    const message =
      error.status !== undefined && error.status >= 500
        ? "We couldn't send your confirmation email just now. Wait a minute, then check your inbox or try again."
        : friendlyAuthError(error);
    return { status: "error", message };
  }
  return { status: "success", message: "We've sent it again. It can take a minute to arrive." };
}

/** Results are translated into the visitor's language. */
export async function requestPasswordReset(prev: FormState, formData: FormData): Promise<FormState> {
  return localiseState(await requestPasswordResetInEnglish(prev, formData));
}

async function requestPasswordResetInEnglish(_prev: FormState, formData: FormData): Promise<FormState> {
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

/** Results are translated into the visitor's language. */
export async function resetPassword(prev: FormState, formData: FormData): Promise<FormState> {
  return localiseState(await resetPasswordInEnglish(prev, formData));
}

async function resetPasswordInEnglish(_prev: FormState, formData: FormData): Promise<FormState> {
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

  // Staff setting their first password continue to the admin area; that
  // isn't a change worth warning about, every other password change is.
  const next = safeNextPath(formData.get("next"));
  if (!next.startsWith("/admin")) notifyPasswordChanged(claims.claims.sub);
  redirect(next.startsWith("/admin") ? "/admin" : "/app");
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
