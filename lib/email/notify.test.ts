import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usedLastSession } from "@/lib/billing/entitlements";

import { createFakeDb } from "../../test/fake-supabase";

const fake = createFakeDb();
const db = fake.tables;
const client = Object.assign(Object.create(fake.client), {
  auth: { admin: { getUserById: async (id: string) => ({ data: { user: id === "u1" ? { id, email: "ada@x.example" } : null } }) } },
});
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => client }));
vi.mock("@/lib/site-url", () => ({ getSiteUrl: async () => "https://rr.example" }));
let accept = true;
const sent: { to: { email: string }[]; subject: string; text: string; category: string; sender?: string }[] = [];
vi.mock("@/lib/email/mailtrap", () => ({
  emailConfigured: () => true,
  sendEmail: async (m: (typeof sent)[number]) => {
    sent.push(m);
    return accept ? { ok: true, ids: ["m"] } : { ok: false, reason: "refused" };
  },
}));

const notify = await import("@/lib/email/notify");
const flush = () => new Promise((r) => setTimeout(r, 10));

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  db.profiles = [{ id: "u1", full_name: "Ada Obi" }];
  db.email_events = [];
  sent.length = 0;
  accept = true;
  vi.stubEnv("APP_URL", "https://rr.example");
});
afterEach(() => vi.unstubAllEnvs());

describe("event emails", () => {
  it("sends one receipt per payment, even when the payment is reported twice", async () => {
    const payment = { userId: "u1", reference: "T1", product: "credits_10", amountMinor: 1_000_000, currency: "NGN", paidAt: "2026-10-03T10:00:00Z", renewal: false };
    notify.notifyReceipt(payment);
    await flush();
    notify.notifyReceipt(payment);
    await flush();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: [{ email: "ada@x.example", name: "Ada Obi" }], subject: "Your RaiseReady receipt", category: "Receipt" });
    expect(sent[0].text).toContain("Amount: ₦10,000");
    expect(sent[0].text).toContain("Reference: T1");
    expect(sent[0].text).toContain("3 October 2026");
  });

  it("doesn't send a receipt for a free (100% off) purchase", async () => {
    notify.notifyReceipt({ userId: "u1", reference: "T0", product: "credits_3", amountMinor: 0, currency: "NGN", renewal: false });
    await flush();
    expect(sent).toHaveLength(0);
  });

  it("tries again later if Mailtrap refuses", async () => {
    accept = false;
    expect(await notify.sendOnce("receipt:T2", "receipt", "u1", () => ({ subject: "s", text: "t", category: "Receipt" }))).toBe("failed");
    expect(db.email_events).toHaveLength(0);
    accept = true;
    expect(await notify.sendOnce("receipt:T2", "receipt", "u1", () => ({ subject: "s", text: "t", category: "Receipt" }))).toBe("sent");
  });

  it("warns about failed renewals and ended plans once each", async () => {
    notify.notifyRenewalFailed("u1", "SUB_1", "pro");
    notify.notifyRenewalFailed("u1", "SUB_1", "pro");
    notify.notifyPlanEnded("u1", "SUB_1", "pro_plus");
    await flush();
    expect(sent.map((m) => m.subject)).toEqual([
      "Action needed: your RaiseReady Pro payment didn't go through",
      "Your RaiseReady Pro Plus plan has ended",
    ]);
  });

  it("tells founders once when they've used their last session, from Mhenuter", async () => {
    notify.notifyOutOfPractice("u1", "free");
    notify.notifyOutOfPractice("u1", "free");
    await flush();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ subject: "You've used your free practice session", sender: "personal" });
  });

  it("sends security and account notices", async () => {
    notify.notifyPasswordChanged("u1");
    notify.notifyAccountStatus("u1", "suspended", "Unpaid chargeback");
    notify.notifyAccountDeleted({ email: "gone@x.example", name: "Gone" });
    await flush();
    expect(sent.map((m) => m.subject).sort()).toEqual([
      "Your RaiseReady account has been deleted",
      "Your RaiseReady account has been suspended",
      "Your RaiseReady password was changed",
    ]);
    expect(sent.find((m) => m.subject.includes("suspended"))?.text).toContain("Reason: Unpaid chargeback");
  });
});

describe("last practice session", () => {
  const base = { proActive: false, credits: 0, assessments: 0, freeSimulationsUsed: 0, proSimulationsThisMonth: 0 };
  it("is the free session, the last monthly one, or the last credit", () => {
    expect(usedLastSession(base, "free")).toBe(true);
    expect(usedLastSession({ ...base, credits: 2 }, "free")).toBe(false);
    expect(usedLastSession({ ...base, proActive: true, tier: "pro", proSimulationsThisMonth: 29 }, "pro")).toBe(true);
    expect(usedLastSession({ ...base, proActive: true, tier: "pro", proSimulationsThisMonth: 10 }, "pro")).toBe(false);
    expect(usedLastSession({ ...base, freeSimulationsUsed: 1, credits: 1 }, "credit")).toBe(true);
    expect(usedLastSession({ ...base, freeSimulationsUsed: 1, credits: 3 }, "credit")).toBe(false);
  });
});
