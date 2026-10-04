import type { AccountStatus, UserRole } from "@/lib/supabase/database.types";

/**
 * Who can do what in the admin area. Pure rules, checked on the server
 * before every admin page and action.
 *
 * - viewer: sees the admin dashboard
 * - support: also suspends and reactivates founders
 * - admin: also terminates, deletes, changes roles up to support, and sends
 *   notifications
 * - super_admin: everything, including password resets, free credits,
 *   managing admins, the report signature, the public showcase and teams
 */
export type StaffAction =
  | "view"
  | "suspend"
  | "terminate"
  | "delete"
  | "change_role"
  | "notify"
  | "reset_password"
  | "grant_credits"
  | "manage_content"
  | "manage_discounts"
  | "manage_teams"
  | "export";

const ADMIN_ACTIONS: StaffAction[] = ["view", "suspend", "terminate", "delete", "change_role", "notify", "export"];

const PERMISSIONS: Record<UserRole, readonly StaffAction[]> = {
  founder: [],
  viewer: ["view"],
  support: ["view", "suspend"],
  admin: ADMIN_ACTIONS,
  super_admin: [...ADMIN_ACTIONS, "reset_password", "grant_credits", "manage_content", "manage_discounts", "manage_teams"],
};

/** Roles only a super admin may give, take away or act on. */
const SENIOR_ROLES: readonly UserRole[] = ["admin", "super_admin"];

/** Most free credits a super admin can add in one go. */
export const MAX_GRANT = 100;

export const ROLES: { value: UserRole; label: string; summary: string }[] = [
  { value: "founder", label: "Founder", summary: "Uses the app. No admin access." },
  { value: "viewer", label: "Viewer", summary: "Can see the admin dashboard, nothing else." },
  { value: "support", label: "Support", summary: "Can also suspend and reactivate founders." },
  { value: "admin", label: "Admin", summary: "Also terminates and deletes users, sends notifications, and assigns roles up to Support." },
  { value: "super_admin", label: "Super admin", summary: "Everything, including passwords, free credits, admins, teams, report signature and website content." },
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
  | { type: "change_role"; role: UserRole }
  | { type: "reset_password" }
  | { type: "grant_credits"; amount: number }
  | { type: "confirm_email" }
  | { type: "resend_confirmation" };

type Person = { id: string; role: UserRole; status: AccountStatus };

/**
 * Whether `actor` may apply `action` to `target`. Returns null when allowed,
 * otherwise the reason, in words an admin can act on.
 */
export function userActionProblem(actor: Person, target: Person, action: UserAction): string | null {
  // Helping someone who can't confirm their email is a support task.
  const needs: StaffAction =
    action.type === "reactivate" || action.type === "confirm_email" || action.type === "resend_confirmation" ? "suspend" : action.type;
  if (!can(actor.role, needs)) return "Your role doesn't allow this.";
  if (actor.id === target.id) return "You can't do this to your own account.";
  // Staff can only be managed from above: support never touches staff,
  // admins manage viewers and support, super admins manage everyone.
  if (SENIOR_ROLES.includes(target.role) && actor.role !== "super_admin") return "Only a super admin can change an admin account.";
  if (isStaff(target.role) && !SENIOR_ROLES.includes(actor.role)) return "Only an admin can change another staff account.";

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
      if (SENIOR_ROLES.includes(action.role) && actor.role !== "super_admin") return "Only a super admin can make someone an admin.";
      if (target.status !== "active" && action.role !== "founder") return "Only active accounts can be given a staff role.";
      return null;
    case "reset_password":
    case "confirm_email":
    case "resend_confirmation":
      return target.status === "terminated" ? "This account is terminated." : null;
    case "grant_credits":
      if (target.status === "terminated") return "This account is terminated.";
      if (!Number.isInteger(action.amount) || action.amount < 1 || action.amount > MAX_GRANT) {
        return `Add between 1 and ${MAX_GRANT} credits.`;
      }
      return null;
  }
}
