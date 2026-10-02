import type { EmailOtpType } from "@supabase/supabase-js";
import { after, NextResponse, type NextRequest } from "next/server";

import { recordSignIn } from "@/lib/activity/service";
import { safeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for links in Supabase auth emails (sign-up confirmation and
 * password reset). Supports both the default `?code=` links and `?token_hash=`
 * links from customised email templates.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  const signedIn = (user: { id: string; email?: string } | null | undefined) => {
    if (user?.email) {
      const userAgent = request.headers.get("user-agent");
      after(() => recordSignIn({ email: user.email!, userId: user.id, succeeded: true, surface: "app", userAgent }));
    }
    return NextResponse.redirect(new URL(next, origin));
  };

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return signedIn(data.user);
  } else if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return signedIn(data.user);
  }

  return NextResponse.redirect(new URL("/login?error=link", origin));
}
