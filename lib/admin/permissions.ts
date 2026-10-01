import type { AccountStatus, UserRole } from "@/lib/supabase/database.types";

/**
 * Who can do what in the admin area. Pure rules, checked on the server
 * before every admin page and action.
 *
 * - viewer: sees the admin dashboard
 * - support: also suspends and reactivates founders
 * - admin: everything, including terminating, deleting and changing roles
 */
export type StaffAction = "view" | "suspend" | "terminate" | "delete" | "change_role";

const PERMISSIONS: Record<UserRole, readonly StaffAction[]> = {
  founder: [],
  viewer: ["view"],
  support: ["view", "suspend"],
  admin: ["view", "suspend", "terminate", "delete", "change_role"],
};

export const ROLES: { value: UserRole; label: string; summary: string }[] = [
  { value: "founder", label: "Founder", summary: "Uses the app. No admin access." },
  { value: "viewer", label: "Viewer", summary: "Can see the admin dashboard, nothing else." },
  { value: "support", label: "Support", summary: "Can also suspend and reactivate founders." },
  { value: "admin", label: "Admin", summary: "Full access, including deleting users and changing roles." },
];

export const roleLabel = (role: string) => ROLES.find((r) => r.value === role)?.label ?? role;

export const STATUS_LABELS: Record<AccountStatus, string> = {
  active: "Active",
  suspended: "Suspended",
  terminated: "Terminated",
};

export function can(role: UserRole | null | undefined, action: StaffAction): boolean {
  return role ? PERMISSIONS[role]?.includes(action) === true : false;
}

export function isStaff(role: UserRole | null | undefined): boolean {
  return can(role, "view");
}

export type UserAction =
  | { type: "suspend" }
  | { type: "reactivate" }
  | { type: "terminate" }
  | { type: "delete" }
  | { type: "change_role"; role: UserRole };

type Person = { id: string; role: UserRole; status: AccountStatus };

/**
 * Whether `actor` may apply `action` to `target`. Returns null when allowed,
 * otherwise the reason, in words an admin can act on.
 */
export function userActionProblem(actor: Person, target: Person, action: UserAction): string | null {
  const needs: StaffAction = action.type === "reactivate" ? "suspend" : action.type;
  if (!can(actor.role, needs)) return "Your role doesn't allow this.";
  if (actor.id === target.id) return "You can't do this to your own account.";
  // Only admins may act on other staff, so support can't lock out an admin.
  if (isStaff(target.role) && actor.role !== "admin") return "Only an admin can change another staff account.";

  switch (action.type) {
    case "suspend":
      return target.status === "active" ? null : "Only active accounts can be suspended.";
    case "reactivate":
      return target.status === "suspended" ? null : "Only suspended accounts can be reactivated. Termination is permanent.";
    case "terminate":
      return target.status === "terminated" ? "This account is already terminated." : null;
    case "delete":
      return null;
    case "change_role":
      if (!PERMISSIONS[action.role]) return "Unknown role.";
      if (action.role === target.role) return "They already have this role.";
      if (target.status !== "active" && action.role !== "founder") return "Only active accounts can be given a staff role.";
      return null;
  }
}
