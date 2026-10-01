import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeDb } from "../../test/fake-supabase";

const fake = createFakeDb();
const db = fake.tables;
const steps: string[] = [];

// Storage: bucket -> folder -> entries (folders have id null).
let files: Record<string, Record<string, { id: string | null; name: string }[]>> = {};
const storage = {
  from: (bucket: string) => ({
    list: async (folder: string) => ({ data: files[bucket]?.[folder] ?? [], error: null }),
    remove: async (paths: string[]) => {
      steps.push(`remove ${bucket}: ${paths.join(", ")}`);
      return { data: [], error: null };
    },
  }),
};
let deleteUserError: { message: string } | null = null;
const auth = {
  admin: {
    deleteUser: async (id: string) => {
      steps.push(`deleteUser ${id}`);
      return { error: deleteUserError };
    },
  },
};

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ ...fake.client, storage, auth }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fake.client }));
const disableSubscription = vi.fn(async (code: string) => {
  steps.push(`disable ${code}`);
});
vi.mock("@/lib/billing/paystack", () => ({ disableSubscription: (code: string) => disableSubscription(code) }));
vi.mock("@/lib/reports/service", () => ({ REPORTS_BUCKET: "reports" }));

const { deleteAccount, AccountError } = await import("@/lib/account/service");

const USER = "user-1";

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  steps.length = 0;
  deleteUserError = null;
  disableSubscription.mockClear();
  files = {
    documents: {
      [USER]: [{ id: null, name: "startup-1" }],
      [`${USER}/startup-1`]: [
        { id: "a", name: "deck.pdf" },
        { id: "b", name: "model.xlsx" },
      ],
    },
    reports: { [USER]: [{ id: null, name: "startup-1" }], [`${USER}/startup-1`]: [{ id: "c", name: "r1.pdf" }] },
  };
  db.subscriptions = [
    { id: "s1", user_id: USER, provider_subscription_code: "SUB_live", status: "active" },
    { id: "s2", user_id: USER, provider_subscription_code: "SUB_old", status: "cancelled" },
  ];
  db.payments = [
    { id: "p1", user_id: USER, amount_kobo: 1_500_000, status: "success" },
    { id: "p2", user_id: USER, amount_kobo: 500_000, status: "failed" },
    { id: "p3", user_id: "someone-else", amount_kobo: 1_000_000, status: "success" },
  ];
});

describe("deleteAccount", () => {
  it("cancels Pro, removes every file, deletes the user, then logs without personal details", async () => {
    await deleteAccount(USER);
    expect(steps).toEqual([
      "disable SUB_live",
      `remove documents: ${USER}/startup-1/deck.pdf, ${USER}/startup-1/model.xlsx`,
      `remove reports: ${USER}/startup-1/r1.pdf`,
      `deleteUser ${USER}`,
    ]);
    expect(db.audit_logs).toEqual([
      expect.objectContaining({
        actor_id: null,
        action: "account.deleted",
        target_id: USER,
        metadata: { payments: 1, paid_kobo: 1_500_000, files_removed: { documents: 2, reports: 1 }, subscriptions_cancelled: 1 },
      }),
    ]);
  });

  it("deletes nothing if the Paystack subscription can't be cancelled", async () => {
    disableSubscription.mockRejectedValueOnce(new Error("Paystack down"));
    await expect(deleteAccount(USER)).rejects.toBeInstanceOf(AccountError);
    expect(steps).toEqual([]);
    expect(db.audit_logs ?? []).toEqual([]);
  });

  it("does not log a deletion that failed", async () => {
    deleteUserError = { message: "boom" };
    await expect(deleteAccount(USER)).rejects.toThrow(/Could not delete auth user/);
    expect(db.audit_logs ?? []).toEqual([]);
  });
});
