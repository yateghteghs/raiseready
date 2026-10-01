/** Turns Supabase Auth errors into messages that are safe and useful to show. */
export function friendlyAuthError(error: { code?: string; message?: string } | null | undefined): string {
  const code = error?.code ?? "";
  switch (code) {
    case "invalid_credentials":
      return "That email and password don't match. Check them and try again.";
    case "email_not_confirmed":
      return "Please confirm your email first. Check your inbox for the link we sent.";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Try logging in instead.";
    case "weak_password":
      return "That password is too easy to guess. Try a longer one.";
    case "same_password":
      return "Your new password must be different from your current one.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "signup_disabled":
      return "Sign-ups are currently closed.";
    default:
      return "Something went wrong. Please try again.";
  }
}
