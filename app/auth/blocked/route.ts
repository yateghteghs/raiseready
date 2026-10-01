import { NextResponse, type NextRequest } from "next/server";

import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Signs out a suspended or terminated account and explains why on the login
 * page. Active accounts are sent back to the app, so this link can't be used
 * to sign someone out.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (session?.status === "active") return NextResponse.redirect(new URL("/app", request.url));
  if (session) {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.redirect(new URL(`/login?error=${session.status}`, request.url));
  }
  return NextResponse.redirect(new URL("/login", request.url));
}
