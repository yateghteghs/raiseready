import { describe, expect, it } from "vitest";

import { can, isStaff, userActionProblem } from "@/lib/admin/permissions";

const person = (id: string, role: "founder" | "viewer" | "support" | "admin", status: "active" | "suspended" | "terminated" = "active") => ({ id, role, status });
const admin = person("a", "admin");
const support = person("s", "support");
const viewer = person("v", "viewer");
const founder = person("f", "founder");

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

  it("lets admins change roles, but not grant staff roles to blocked accounts", () => {
    expect(userActionProblem(admin, founder, { type: "change_role", role: "support" })).toBeNull();
    expect(userActionProblem(admin, support, { type: "change_role", role: "founder" })).toBeNull();
    expect(userActionProblem(admin, founder, { type: "change_role", role: "founder" })).toMatch(/already/);
    expect(userActionProblem(admin, person("f", "founder", "suspended"), { type: "change_role", role: "admin" })).toMatch(/active/);
  });
});
