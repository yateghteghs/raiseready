import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import { DataLoadError } from "@/lib/data-errors";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type SessionUser = { id: string; email: string | null };

/**
 * The verified signed-in user for this request, or null.
 * getClaims() validates the session token rather than trusting the cookie.
 * Cached so layouts and pages share one lookup per request.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  // Sign-in state is per request: never let a page using it be prerendered.
  await connection();
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  return { id: data.claims.sub, email };
});

/** Returns the signed-in user or redirects to the login page. */
export async function requireUser(nextPath = "/app"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
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
