import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeDb } from "../../test/fake-supabase";

const fake = createFakeDb();
const db = fake.tables;
const links: Record<string, unknown>[] = [];
// The fake database plus the few Supabase Auth admin calls staff invites use.
const client = Object.assign(Object.create(fake.client), {
  auth: {
    admin: {
      generateLink: async (input: { type: string; email: string; options?: { data?: { full_name?: string } } }) => {
        links.push(input);
        if (input.type === "invite") db.profiles.push({ id: "new-staff", role: "founder", status: "active", full_name: input.options?.data?.full_name ?? null });
        return { data: { user: { id: input.type === "invite" ? "new-staff" : "s2" }, properties: { hashed_token: "HASH" } }, error: null };
      },
      getUserById: async (id: string) => ({ data: { user: { id, email: `${id}@x.example` } } }),
    },
  },
});
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => client }));
vi.mock("@/lib/site-url", () => ({ getSiteUrl: async () => "https://rr.example" }));
const existing = new Map<string, string>();
vi.mock("@/lib/notifications/service", () => ({ userIdForEmail: async (email: string) => existing.get(email) ?? null }));

const { inviteStaff, newStaffLink, staffInviteProblem, StaffInviteError } = await import("@/lib/admin/staff");

const actor = (role: string) => ({ id: "me", email: "me@x", profile: { role, status: "active" } }) as never;

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  db.profiles = [
    { id: "f1", role: "founder", status: "active" },
    { id: "s2", role: "support", status: "active" },
  ];
  db.audit_logs = [];
  links.length = 0;
  existing.clear();
});

describe("staff invites", () => {
  it("lets admins invite up to Support and super admins anyone", () => {
    expect(staffInviteProblem("admin", "support")).toBeNull();
    expect(staffInviteProblem("admin", "admin")).toMatch(/super admin/);
    expect(staffInviteProblem("super_admin", "super_admin")).toBeNull();
    expect(staffInviteProblem("support", "viewer")).toMatch(/doesn't allow/);
  });

  it("creates the account with its staff role and returns a link to the admin welcome page", async () => {
    const link = await inviteStaff(actor("super_admin"), { email: "kemi@x.example", full_name: "Kemi", role: "admin" });
    expect(link).toBe("https://rr.example/auth/callback?token_hash=HASH&type=invite&next=/admin/welcome");
    expect(db.profiles.find((p) => p.id === "new-staff")).toMatchObject({ role: "admin", full_name: "Kemi" });
    expect(db.audit_logs[0]).toMatchObject({ action: "admin.staff_invited", target_id: "new-staff" });
  });

  it("refuses emails that already have an account, and roles above the inviter", async () => {
    existing.set("ada@x.example", "f1");
    await expect(inviteStaff(actor("super_admin"), { email: "ada@x.example", full_name: "Ada", role: "viewer" })).rejects.toThrow(/founder account/);
    await expect(inviteStaff(actor("admin"), { email: "new@x.example", full_name: "New", role: "super_admin" })).rejects.toThrow(StaffInviteError);
    expect(links).toHaveLength(0);
  });

  it("makes a new sign-in link for staff only, for super admins", async () => {
    expect(await newStaffLink(actor("super_admin"), "s2")).toContain("type=magiclink&next=/admin/welcome");
    await expect(newStaffLink(actor("super_admin"), "f1")).rejects.toThrow(/isn't staff/);
    await expect(newStaffLink(actor("admin"), "s2")).rejects.toThrow(StaffInviteError);
  });
});
