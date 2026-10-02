import { NextResponse, type NextRequest } from "next/server";

import { authRedirectFor, isProtectedPath } from "@/lib/auth/routes";
import { isReferralCode, REFERRAL_COOKIE, REFERRAL_COOKIE_DAYS } from "@/lib/referrals/code";
import { updateSession } from "@/lib/supabase/proxy";

/** Remembers an invite code from `?ref=` so sign-up can credit the founder who shared the link. */
function rememberReferral(request: NextRequest, response: NextResponse): NextResponse {
  const ref = request.nextUrl.searchParams.get("ref")?.toUpperCase();
  if (isReferralCode(ref)) {
    response.cookies.set(REFERRAL_COOKIE, ref, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      maxAge: REFERRAL_COOKIE_DAYS * 24 * 60 * 60,
      path: "/",
    });
  }
  return response;
}

export async function proxy(request: NextRequest) {
  // Without Supabase settings there is no session to refresh. Let public pages
  // render, keep signed-in areas closed, and say clearly what is missing.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
    if (isProtectedPath(request.nextUrl.pathname)) {
      return new NextResponse("Service unavailable", { status: 503 });
    }
    return rememberReferral(request, NextResponse.next({ request }));
  }

  const { response, userId } = await updateSession(request);

  const target = authRedirectFor(
    request.nextUrl.pathname,
    request.nextUrl.search,
    userId !== null,
  );
  if (!target) return rememberReferral(request, response);

  // Carry over any refreshed session cookies onto the redirect.
  const redirect = NextResponse.redirect(new URL(target, request.url));
  for (const cookie of response.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return rememberReferral(request, redirect);
}

export const config = {
  matcher: [
    // Everything except static assets and image optimisation.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
