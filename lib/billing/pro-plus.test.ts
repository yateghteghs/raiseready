import { beforeEach, describe, expect, it, vi } from "vitest";

import { deckUnlockAccess, rewriteLimit, simulationAccess, tierOf } from "@/lib/billing/entitlements";

import { createFakeDb } from "../../test/fake-supabase";

const fake = createFakeDb();
const db = fake.tables;
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fake.client }));

const initialized: Record<string, unknown>[] = [];
const disabled: string[] = [];
vi.mock("@/lib/billing/paystack", async (original) => ({
  ...(await original<typeof import("@/lib/billing/paystack")>()),
  initializeTransaction: async (input: Record<string, unknown>) => {
    initialized.push(input);
    return { authorization_url: "https://checkout.paystack.test/x", reference: input.reference };
  },
  ensurePlan: async (product: string, currency: string) => (product === "pro_monthly" ? `PLN_PRO_${currency}` : `PLN_PLUS_${currency}`),
  disableSubscription: async (code: string) => {
    disabled.push(code);
  },
}));

const { startCheckout, handlePaystackEvent, getUsage, BillingError } = await import("@/lib/billing/service");

const founder = { id: "u1", email: "ada@example.com" };
const future = new Date(Date.now() + 30 * 86_400_000).toISOString();
const past = new Date(Date.now() - 86_400_000).toISOString();

function reset() {
  for (const k of Object.keys(db)) delete db[k];
  initialized.length = 0;
  disabled.length = 0;
  db.profiles = [{ id: "u1", plan: "free", credits: 0, deck_credits: 0, status: "active", referred_by: null, paystack_customer_code: null }];
  db.subscriptions = [];
  db.payments = [];
  db.audit_logs = [];
  db.discount_codes = [];
  db.discount_redemptions = [];
  db.referral_rewards = [];
  db.team_members = [];
  db.teams = [];
}

const lastPayment = () => db.payments[db.payments.length - 1];
const charge = (amount: number, plan: string | null) =>
  handlePaystackEvent({
    event: "charge.success",
    data: {
      id: 1,
      status: "success",
      reference: lastPayment().reference,
      amount,
      currency: "NGN",
      paid_at: "2026-10-01T10:00:00Z",
      customer: { customer_code: "CUS_1" },
      plan: plan ? { plan_code: plan } : null,
    },
  });

describe("plan levels", () => {
  it("lets an active team's Pro Plus win over the founder's own plan", () => {
    expect(tierOf("free", null, { ends_at: future })).toBe("pro_plus");
    expect(tierOf("pro", null, { ends_at: past })).toBe("pro");
    expect(tierOf("pro_plus", null, null)).toBe("pro_plus");
    expect(tierOf("free", null, null)).toBe("free");
  });

  it("gives Pro Plus higher monthly allowances", () => {
    const base = { proActive: true, credits: 0, assessments: 0, freeSimulationsUsed: 0 };
    expect(simulationAccess({ ...base, tier: "pro", proSimulationsThisMonth: 30 }, "seed_vc", "tough")).toMatchObject({ ok: false });
    expect(simulationAccess({ ...base, tier: "pro_plus", proSimulationsThisMonth: 30 }, "seed_vc", "tough")).toEqual({ ok: true, via: "pro" });
    expect(simulationAccess({ ...base, tier: "pro_plus", proSimulationsThisMonth: 100 }, "seed_vc", "tough")).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/100 Pro Plus simulations/),
    });
    const decks = { proActive: true, deckCredits: 0, previewsUsed: 1 };
    expect(deckUnlockAccess({ ...decks, tier: "pro", proDecksThisMonth: 3 })).toMatchObject({ ok: false });
    expect(deckUnlockAccess({ ...decks, tier: "pro_plus", proDecksThisMonth: 9 })).toEqual({ ok: true, via: "pro" });
    expect(rewriteLimit("pro", "pro_plus")).toBe(100);
    expect(rewriteLimit("credit", "pro_plus")).toBe(2);
  });
});

describe("Pro Plus billing", () => {
  beforeEach(reset);

  it("subscribes a free founder to Pro Plus on its own Paystack plan", async () => {
    await startCheckout(founder, "pro_plus_monthly", "https://x/cb");
    expect(initialized[0]).toMatchObject({ amountKobo: 3_500_000, planCode: "PLN_PLUS_NGN" });
    await charge(3_500_000, "PLN_PLUS_NGN");
    expect(db.profiles[0].plan).toBe("pro_plus");
    expect(db.subscriptions).toEqual([expect.objectContaining({ plan: "pro_plus", status: "active" })]);
    expect((await getUsage("u1", null)).tier).toBe("pro_plus");
  });

  it("upgrades from Pro: ends the Pro subscription without ending the new plan", async () => {
    db.profiles[0].plan = "pro";
    db.subscriptions.push({ id: "s-pro", user_id: "u1", plan: "pro", status: "active", provider_subscription_code: "SUB_PRO", current_period_end: future, created_at: "2026-09-01T00:00:00Z" });

    await startCheckout(founder, "pro_plus_monthly", "https://x/cb");
    await charge(3_500_000, "PLN_PLUS_NGN");
    expect(disabled).toEqual(["SUB_PRO"]);
    expect(db.profiles[0].plan).toBe("pro_plus");

    // Paystack confirms the new subscription, then the old one being disabled.
    await handlePaystackEvent({
      event: "subscription.create",
      data: { subscription_code: "SUB_PLUS", status: "active", next_payment_date: future, customer: { customer_code: "CUS_1" } },
    });
    await handlePaystackEvent({
      event: "subscription.disable",
      data: { subscription_code: "SUB_PRO", status: "cancelled", customer: { customer_code: "CUS_1" } },
    });
    expect(db.profiles[0].plan).toBe("pro_plus");
    expect(db.subscriptions.find((s) => s.provider_subscription_code === "SUB_PLUS")).toMatchObject({ plan: "pro_plus", status: "active" });
    expect(db.subscriptions.find((s) => s.id === "s-pro")).toMatchObject({ status: "cancelled" });

    // When Pro Plus itself is cancelled and ends, the founder returns to free.
    await handlePaystackEvent({
      event: "subscription.disable",
      data: { subscription_code: "SUB_PLUS", status: "complete", customer: { customer_code: "CUS_1" } },
    });
    expect(db.profiles[0].plan).toBe("free");
  });

  it("records Pro Plus renewals as Pro Plus", async () => {
    db.profiles[0].plan = "pro_plus";
    db.profiles[0].paystack_customer_code = "CUS_1";
    db.subscriptions.push({ id: "s1", user_id: "u1", plan: "pro_plus", status: "active", provider_subscription_code: "SUB_PLUS", current_period_end: past, created_at: "2026-09-01T00:00:00Z" });
    await handlePaystackEvent({
      event: "charge.success",
      data: { id: 2, status: "success", reference: "T_renew", amount: 3_500_000, currency: "NGN", paid_at: "2026-11-01T10:00:00Z", customer: { customer_code: "CUS_1" }, plan: { plan_code: "PLN_PLUS_NGN" } },
    });
    expect(db.payments.find((p) => p.reference === "T_renew")).toMatchObject({ product: "pro_plus_monthly" });
    expect(db.profiles[0].plan).toBe("pro_plus");
  });

  it("stops founders buying a plan they already have, or Pro over Pro Plus", async () => {
    db.profiles[0].plan = "pro_plus";
    await expect(startCheckout(founder, "pro_plus_monthly", "https://x/cb")).rejects.toThrow(BillingError);
    await expect(startCheckout(founder, "pro_monthly", "https://x/cb")).rejects.toThrow(/cancel Pro Plus first/);
  });

  it("gives team members Pro Plus without paying, until the team ends", async () => {
    db.teams.push({ id: "t1", name: "Lagos Accelerator", ends_at: future, owner_id: null });
    db.team_members.push({ team_id: "t1", user_id: "u1" });
    const usage = await getUsage("u1", null);
    expect(usage).toMatchObject({ tier: "pro_plus", proActive: true, team: { name: "Lagos Accelerator" } });
    await expect(startCheckout(founder, "pro_monthly", "https://x/cb")).rejects.toThrow(/already gives you Pro Plus/);

    db.teams[0].ends_at = past;
    expect(await getUsage("u1", null)).toMatchObject({ tier: "free", team: null });
  });
});
