import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeDb } from "../../test/fake-supabase";

const fake = createFakeDb();
const db = fake.tables;
const users: Record<string, { email: string; email_confirmed_at: string | null }> = {};
const client = Object.assign(Object.create(fake.client), {
  auth: { admin: { getUserById: async (id: string) => ({ data: { user: users[id] ? { id, ...users[id] } : null } }) } },
});
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => client }));
vi.mock("@/lib/site-url", () => ({ getSiteUrl: async () => "https://rr.example" }));
let accept = true;
const sent: { to: { email: string; name?: string }[]; subject: string; sender?: string; category: string; text: string }[] = [];
vi.mock("@/lib/email/mailtrap", () => ({
  sendEmail: async (m: (typeof sent)[number]) => {
    sent.push(m);
    return accept ? { ok: true, ids: ["m1"] } : { ok: false, reason: "refused" };
  },
}));

const { sendWelcomeEmail } = await import("@/lib/email/welcome");

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  db.profiles = [
    { id: "f1", role: "founder", full_name: "Ada Obi", welcome_email_sent_at: null },
    { id: "f2", role: "founder", full_name: null, welcome_email_sent_at: null },
    { id: "old", role: "founder", full_name: "Old", welcome_email_sent_at: "2026-01-01T00:00:00Z" },
    { id: "s1", role: "support", full_name: "Staff", welcome_email_sent_at: null },
  ];
  users.f1 = { email: "ada@x.example", email_confirmed_at: "2026-10-03T00:00:00Z" };
  users.f2 = { email: "f2@x.example", email_confirmed_at: null };
  users.old = { email: "old@x.example", email_confirmed_at: "2026-01-01T00:00:00Z" };
  users.s1 = { email: "s1@x.example", email_confirmed_at: "2026-10-03T00:00:00Z" };
  sent.length = 0;
  accept = true;
});

describe("welcome email", () => {
  it("is sent once, from Mhenuter, after the founder confirms their email", async () => {
    expect(await sendWelcomeEmail("f1")).toBe("sent");
    expect(sent[0]).toMatchObject({ to: [{ email: "ada@x.example", name: "Ada Obi" }], subject: "Welcome to RaiseReady", sender: "personal", category: "Welcome" });
    expect(sent[0].text).toContain("Hi Ada,");
    expect(sent[0].text).toContain("https://rr.example/app");
    expect(await sendWelcomeEmail("f1")).toBe("skipped");
    expect(sent).toHaveLength(1);
  });

  it("isn't sent to unconfirmed founders, existing accounts or staff", async () => {
    expect(await sendWelcomeEmail("f2")).toBe("skipped");
    expect(await sendWelcomeEmail("old")).toBe("skipped");
    expect(await sendWelcomeEmail("s1")).toBe("skipped");
    expect(await sendWelcomeEmail("missing")).toBe("skipped");
    expect(sent).toHaveLength(0);
  });

  it("tries again later if Mailtrap refuses it", async () => {
    accept = false;
    expect(await sendWelcomeEmail("f1")).toBe("failed");
    expect(db.profiles.find((p) => p.id === "f1")?.welcome_email_sent_at).toBeNull();
    accept = true;
    expect(await sendWelcomeEmail("f1")).toBe("sent");
  });
});
