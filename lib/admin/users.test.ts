import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeDb } from "../../test/fake-supabase";
import type { Staff } from "@/lib/admin/auth";

const fake = createFakeDb();
const db = fake.tables;
const bans: Record<string, string> = {};
const resets: string[] = [];
const auth = {
  resetPasswordForEmail: async (email: string) => {
    resets.push(email);
    return { error: null };
  },
  admin: {
    getUserById: async (id: string) => ({ data: { user: { id, email: `${id}@example.com` } } }),
    updateUserById: async (id: string, attrs: { ban_duration: string }) => {
      bans[id] = attrs.ban_duration;
      return { error: null };
    },
  },
};
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ ...fake.client, auth }) }));
const deleteAccount = vi.fn(async () => {});
const cancelSubscriptions = vi.fn(async () => 1);
vi.mock("@/lib/site-url", () => ({ getSiteUrl: async () => "https://raiseready.test" }));
vi.mock("@/lib/account/service", () => ({
  AccountError: class extends Error {},
  deleteAccount: (...args: unknown[]) => deleteAccount(...(args as [])),
  cancelSubscriptions: (...args: unknown[]) => cancelSubscriptions(...(args as [])),
}));

const { applyUserAction, AdminActionError } = await import("@/lib/admin/users");

const staff = (role: "super_admin" | "admin" | "support" | "viewer"): Staff =>
  ({ id: "staff", email: "s@x.co", profile: { id: "staff", role, status: "active" } }) as Staff;

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  for (const k of Object.keys(bans)) delete bans[k];
  deleteAccount.mockClear();
  resets.length = 0;
  cancelSubscriptions.mockClear();
  db.profiles = [
    { id: "staff", role: "admin", status: "active" },
    { id: "f1", role: "founder", status: "active", status_reason: null },
  ];
});

const profile = (id: string) => db.profiles.find((p) => p.id === id)!;
const actions = () => (db.audit_logs ?? []).map((a) => a.action);

describe("applyUserAction", () => {
  it("suspends with a reason, bans sign-in, and reactivates", async () => {
    await applyUserAction(staff("support"), "f1", { type: "suspend" }, "Spam uploads");
    expect(profile("f1")).toMatchObject({ status: "suspended", status_reason: "Spam uploads" });
    expect(bans.f1).toBe("876000h");

    await applyUserAction(staff("support"), "f1", { type: "reactivate" });
    expect(profile("f1")).toMatchObject({ status: "active", status_reason: null });
    expect(bans.f1).toBe("none");
    expect(actions()).toEqual(["admin.user_suspended", "admin.user_reactivated"]);
    expect(db.audit_logs!.every((a) => a.actor_id === "staff")).toBe(true);
  });

  it("terminates permanently, cancelling Pro and removing any staff role", async () => {
    profile("f1").role = "viewer";
    await applyUserAction(staff("admin"), "f1", { type: "terminate" }, "Fraud");
    expect(cancelSubscriptions).toHaveBeenCalledWith("f1");
    expect(profile("f1")).toMatchObject({ status: "terminated", role: "founder" });
    expect(bans.f1).toBe("876000h");
    await expect(applyUserAction(staff("admin"), "f1", { type: "reactivate" })).rejects.toThrow(/permanent/);
  });

  it("deletes through the account deletion flow, recording the actor", async () => {
    await applyUserAction(staff("admin"), "f1", { type: "delete" });
    expect(deleteAccount).toHaveBeenCalledWith("f1", { actorId: "staff" });
  });

  it("sends a password reset email without staff seeing the password", async () => {
    await applyUserAction(staff("super_admin"), "f1", { type: "reset_password" });
    expect(resets).toEqual(["f1@example.com"]);
    expect(actions()).toEqual(["admin.password_reset_sent"]);
    await expect(applyUserAction(staff("admin"), "f1", { type: "reset_password" })).rejects.toThrow(/role/);
  });

  it("adds free credits through the credits function, super admins only", async () => {
    db.profiles.find((p) => p.id === "f1")!.credits = 2;
    await applyUserAction(staff("super_admin"), "f1", { type: "grant_credits", amount: 3 }, "Hackathon winner");
    expect(profile("f1").credits).toBe(5);
    expect(db.audit_logs![0]).toMatchObject({ action: "admin.credits_granted", metadata: { amount: 3, balance: 5, reason: "Hackathon winner" } });
    await expect(applyUserAction(staff("admin"), "f1", { type: "grant_credits", amount: 3 })).rejects.toThrow(/role/);
  });

  it("changes roles and logs the old and new role", async () => {
    await applyUserAction(staff("admin"), "f1", { type: "change_role", role: "support" });
    expect(profile("f1").role).toBe("support");
    expect(db.audit_logs![0]).toMatchObject({ action: "profile.role_changed", metadata: { from: "founder", role: "support" } });
  });

  it("refuses what the actor's role doesn't allow, changing nothing", async () => {
    await expect(applyUserAction(staff("viewer"), "f1", { type: "suspend" })).rejects.toBeInstanceOf(AdminActionError);
    await expect(applyUserAction(staff("support"), "f1", { type: "delete" })).rejects.toBeInstanceOf(AdminActionError);
    await expect(applyUserAction(staff("admin"), "staff", { type: "suspend" })).rejects.toThrow(/own account/);
    await expect(applyUserAction(staff("admin"), "nobody", { type: "suspend" })).rejects.toThrow(/no longer exists/);
    expect(profile("f1").status).toBe("active");
    expect(bans).toEqual({});
    expect(deleteAccount).not.toHaveBeenCalled();
  });
});
