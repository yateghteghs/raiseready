import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeDb } from "../../test/fake-supabase";

const fake = createFakeDb();
const db = fake.tables;
const verify = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fake.client }));
vi.mock("@/lib/billing/paystack", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/billing/paystack")>()),
  verifyTransaction: (ref: string) => verify(ref),
}));

const { recheckPayment } = await import("@/lib/billing/service");

const tx = (over: Record<string, unknown> = {}) => ({
  id: 1, status: "success", reference: "rr_c", amount: 507_500, requested_amount: 500_000, currency: "NGN", paid_at: "2026-10-09T10:00:00Z", ...over,
});

describe("Check with Paystack", () => {
  beforeEach(() => {
    for (const k of Object.keys(db)) delete db[k];
    db.profiles = [{ id: "u1", plan: "free", credits: 0 }];
    db.audit_logs = [];
    db.payments = [{ id: "p1", user_id: "u1", reference: "rr_c", amount_kobo: 500_000, currency: "NGN", product: "credits_3", status: "failed" }];
    verify.mockReset();
  });

  it("adds the purchase when Paystack confirms a payment marked failed, and logs who checked", async () => {
    verify.mockResolvedValue(tx());
    expect(await recheckPayment("rr_c", "staff1")).toBe("granted");
    expect(db.profiles[0].credits).toBe(3);
    expect(await recheckPayment("rr_c", "staff1")).toBe("already_paid");
    expect(db.audit_logs.find((a) => a.action === "billing.payment_rechecked")).toMatchObject({ actor_id: "staff1" });
  });

  it("adds nothing when Paystack says it wasn't paid or the amount is wrong", async () => {
    verify.mockResolvedValue(tx({ status: "abandoned" }));
    expect(await recheckPayment("rr_c", "staff1")).toBe("not_paid");
    verify.mockResolvedValue(tx({ amount: 100, requested_amount: 100 }));
    expect(await recheckPayment("rr_c", "staff1")).toBe("mismatch");
    expect(db.profiles[0].credits).toBe(0);
    expect(await recheckPayment("nope", "staff1")).toBe("unknown");
  });
});
