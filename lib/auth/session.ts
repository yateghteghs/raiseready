import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import { DataLoadError } from "@/lib/data-errors";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { AccountStatus, Tables } from "@/lib/supabase/database.types";

export type SessionUser = { id: string; email: string | null };

/** Where a signed-in but suspended or terminated user is sent to be signed out. */
export const BLOCKED_PATH = "/auth/blocked";

/**
 * The verified session for this request and the account's status, or null.
 * getClaims() validates the session token rather than trusting the cookie.
 * Cached so layouts and pages share one lookup per request.
 */
export const getSession = cache(async (): Promise<{ user: SessionUser; status: AccountStatus } | null> => {
  // Sign-in state is per request: never let a page using it be prerendered.
  await connection();
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  const user = { id: data.claims.sub, email };

  // Suspended or terminated accounts are also banned in Supabase Auth, but a
  // session issued before the ban stays valid until it expires, so check here.
  // If the lookup itself fails, pages that need the profile report the error.
  const { data: profile } = await supabase.from("profiles").select("status").eq("id", user.id).maybeSingle();
  return { user, status: profile?.status ?? "active" };
});

/** The signed-in user if their account is active, otherwise null. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await getSession();
  return session?.status === "active" ? session.user : null;
});

/** Returns the signed-in, active user or redirects to log in (or out, if blocked). */
export async function requireUser(nextPath = "/app"): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (session.status !== "active") redirect(BLOCKED_PATH);
  return session.user;
}

export const getCurrentProfile = cache(async (): Promise<Tables<"profiles"> | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new DataLoadError("profile", error.code || "unknown", error.message);
  return data;
});
