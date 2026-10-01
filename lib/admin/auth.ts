import { notFound, redirect } from "next/navigation";

import { can, isStaff, type StaffAction } from "@/lib/admin/permissions";
import { ADMIN_LOGIN_PATH } from "@/lib/auth/routes";
import { BLOCKED_PATH, getCurrentProfile, getSession } from "@/lib/auth/session";
import type { Tables } from "@/lib/supabase/database.types";

export type Staff = { id: string; email: string | null; profile: Tables<"profiles"> };

/** Whether a profile can open the admin area (viewer, support or admin). */
export function isStaffProfile(profile: Pick<Tables<"profiles">, "role" | "status"> | null | undefined): boolean {
  return Boolean(profile && profile.status === "active" && isStaff(profile.role));
}

/** The signed-in staff member, or null. Never redirects. */
export async function getStaff(): Promise<Staff | null> {
  const session = await getSession();
  if (!session || session.status !== "active") return null;
  const profile = await getCurrentProfile();
  if (!profile || !isStaffProfile(profile)) return null;
  return { ...session.user, profile };
}

/**
 * Every admin page calls this first (spec 8: admin routes checked server-side
 * by role). Signed-out visitors go to the admin login; anyone without the
 * permission gets a 404 so the area isn't advertised.
 */
export async function requireStaff(action: StaffAction = "view", nextPath = "/admin"): Promise<Staff> {
  const session = await getSession();
  if (!session) redirect(`${ADMIN_LOGIN_PATH}?next=${encodeURIComponent(nextPath)}`);
  if (session.status !== "active") redirect(BLOCKED_PATH);
  const staff = await getStaff();
  if (!staff || !can(staff.profile.role, action)) notFound();
  return staff;
}
