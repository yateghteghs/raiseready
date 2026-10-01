import { describe, expect, it } from "vitest";

import { can, isStaff, userActionProblem } from "@/lib/admin/permissions";

const person = (id: string, role: "founder" | "viewer" | "support" | "admin" | "super_admin", status: "active" | "suspended" | "terminated" = "active") => ({ id, role, status });
const admin = person("a", "admin");
const support = person("s", "support");
const viewer = person("v", "viewer");
const founder = person("f", "founder");
const superAdmin = person("sa", "super_admin");

describe("staff permissions", () => {
  it("gives each role only its own powers", () => {
    expect(isStaff("founder")).toBe(false);
    expect(isStaff("viewer")).toBe(true);
    expect(can("viewer", "suspend")).toBe(false);
    expect(can("support", "suspend")).toBe(true);
    expect(can("support", "delete")).toBe(false);
    expect(can("support", "change_role")).toBe(false);
    expect(can("admin", "terminate")).toBe(true);
    expect(can(null, "view")).toBe(false);
  });

  it("lets support suspend and reactivate founders, and nothing more", () => {
    expect(userActionProblem(support, founder, { type: "suspend" })).toBeNull();
    expect(userActionProblem(support, person("f", "founder", "suspended"), { type: "reactivate" })).toBeNull();
    expect(userActionProblem(support, founder, { type: "terminate" })).toMatch(/role/);
    expect(userActionProblem(support, founder, { type: "delete" })).toMatch(/role/);
    expect(userActionProblem(support, viewer, { type: "suspend" })).toMatch(/Only an admin/);
    expect(userActionProblem(viewer, founder, { type: "suspend" })).toMatch(/role/);
  });

  it("never lets anyone act on their own account", () => {
    for (const action of [{ type: "suspend" }, { type: "delete" }, { type: "change_role", role: "founder" }] as const) {
      expect(userActionProblem(admin, admin, action)).toMatch(/your own account/);
    }
  });

  it("follows the account lifecycle", () => {
    expect(userActionProblem(admin, person("f", "founder", "suspended"), { type: "suspend" })).toMatch(/active/);
    expect(userActionProblem(admin, founder, { type: "reactivate" })).toMatch(/suspended/);
    expect(userActionProblem(admin, person("f", "founder", "terminated"), { type: "reactivate" })).toMatch(/permanent/);
    expect(userActionProblem(admin, person("f", "founder", "terminated"), { type: "delete" })).toBeNull();
  });

  it("keeps passwords, credits and admins for super admins", () => {
    expect(userActionProblem(admin, founder, { type: "reset_password" })).toMatch(/role/);
    expect(userActionProblem(admin, founder, { type: "grant_credits", amount: 3 })).toMatch(/role/);
    expect(userActionProblem(superAdmin, founder, { type: "reset_password" })).toBeNull();
    expect(userActionProblem(superAdmin, admin, { type: "reset_password" })).toBeNull();
    expect(userActionProblem(superAdmin, founder, { type: "grant_credits", amount: 3 })).toBeNull();
    expect(userActionProblem(superAdmin, founder, { type: "grant_credits", amount: 0 })).toMatch(/between/);
    expect(userActionProblem(superAdmin, founder, { type: "grant_credits", amount: 101 })).toMatch(/between/);
    expect(userActionProblem(superAdmin, person("f", "founder", "terminated"), { type: "grant_credits", amount: 1 })).toMatch(/terminated/);
    expect(can("super_admin", "manage_content")).toBe(true);
    expect(can("admin", "manage_content")).toBe(false);
    expect(can("admin", "notify")).toBe(true);
  });

  it("lets only super admins manage admins", () => {
    const otherAdmin = person("a2", "admin");
    expect(userActionProblem(admin, otherAdmin, { type: "suspend" })).toMatch(/super admin/);
    expect(userActionProblem(admin, founder, { type: "change_role", role: "admin" })).toMatch(/super admin/);
    expect(userActionProblem(admin, superAdmin, { type: "delete" })).toMatch(/super admin/);
    expect(userActionProblem(superAdmin, otherAdmin, { type: "change_role", role: "founder" })).toBeNull();
    expect(userActionProblem(superAdmin, founder, { type: "change_role", role: "super_admin" })).toBeNull();
    expect(userActionProblem(admin, support, { type: "suspend" })).toBeNull();
  });

  it("lets admins change roles, but not grant staff roles to blocked accounts", () => {
    expect(userActionProblem(admin, founder, { type: "change_role", role: "support" })).toBeNull();
    expect(userActionProblem(admin, support, { type: "change_role", role: "founder" })).toBeNull();
    expect(userActionProblem(admin, founder, { type: "change_role", role: "founder" })).toMatch(/already/);
    expect(userActionProblem(superAdmin, person("f", "founder", "suspended"), { type: "change_role", role: "admin" })).toMatch(/active/);
  });
});
