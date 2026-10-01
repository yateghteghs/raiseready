type AuthErrorLike = { code?: string; message?: string; name?: string; status?: number };

const MESSAGES: Record<string, string> = {
  invalid_credentials: "That email and password don't match. Check them and try again.",
  email_not_confirmed: "Please confirm your email first. Check your inbox for the link we sent.",
  user_already_exists: "An account with this email already exists. Try logging in instead.",
  email_exists: "An account with this email already exists. Try logging in instead.",
  weak_password: "That password is too easy to guess. Try a longer one.",
  same_password: "Your new password must be different from your current one.",
  over_request_rate_limit: "Too many attempts. Please wait a few minutes and try again.",
  over_email_send_rate_limit: "Too many emails sent recently. Please wait a few minutes and try again.",
  user_banned: "This account has been suspended or closed. If you think this is a mistake, contact support.",
  signup_disabled: "Sign-ups are currently closed.",
  email_provider_disabled: "Email sign-up is currently turned off.",
  email_address_invalid: "That email address can't be used. Please try a different one.",
  email_address_not_authorized: "We can't send emails to this address yet. Please try again later.",
  service_unreachable: "We couldn't reach the sign-in service. Please try again in a moment.",
  supabase_not_configured:
    "Accounts aren't available yet: this site isn't connected to its database. (Error code: supabase_not_configured)",
};

/** A stable code for an auth error, including network failures. */
export function authErrorCode(error: AuthErrorLike | null | undefined): string {
  if (!error) return "unknown";
  if (error.code) return error.code;
  if (error.name === "AuthRetryableFetchError" || error.status === 0) return "service_unreachable";
  return "unknown";
}

/**
 * Turns Supabase Auth errors into messages that are safe to show. Messages
 * from Supabase itself are never shown; the error code is, so problems can be
 * reported and diagnosed.
 */
export function friendlyAuthError(error: AuthErrorLike | null | undefined): string {
  const code = authErrorCode(error);
  return MESSAGES[code] ?? `Something went wrong. Please try again. (Error code: ${code})`;
}

/** Logs an auth failure on the server (visible in hosting logs) without user data. */
export function logAuthError(action: string, error: AuthErrorLike): void {
  console.error(
    `[auth] ${action} failed: code=${authErrorCode(error)} status=${error.status ?? "?"} message=${error.message ?? ""}`,
  );
}
