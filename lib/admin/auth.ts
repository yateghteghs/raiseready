import { notFound, redirect } from "next/navigation";

import { getCurrentProfile, getCurrentUser } from "@/lib/auth/session";
import type { Tables } from "@/lib/supabase/database.types";

export function isAdmin(profile: Pick<Tables<"profiles">, "role"> | null | undefined): boolean {
  return profile?.role === "admin";
}

/**
 * Every admin page and action calls this first (spec 8: admin routes checked
 * server-side by role). Non-admins get a 404 so the area isn't advertised.
 */
export async function requireAdmin(): Promise<{ id: string; email: string | null }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fadmin");
  const profile = await getCurrentProfile();
  if (!isAdmin(profile)) notFound();
  return user;
}
