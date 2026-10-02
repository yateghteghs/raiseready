import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeDb } from "../../test/fake-supabase";

const fake = createFakeDb();
const db = fake.tables;
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fake.client }));

const initialized: Record<string, unknown>[] = [];
const subscriptions: Record<string, unknown>[] = [];
vi.mock("@/lib/billing/paystack", async (original) => ({
  ...(await original<typeof import("@/lib/billing/paystack")>()),
  initializeTransaction: async (input: Record<string, unknown>) => {
    initialized.push(input);
    return { authorization_url: "https://checkout.paystack.test/x", reference: input.reference };
  },
  ensureProPlan: async (currency: string) => `PLN_${currency}`,
  createSubscription: async (input: Record<string, unknown>) => {
    subscriptions.push(input);
    return { subscription_code: "SUB_1" };
  },
}));

const { startCheckout, quote, handlePaystackEvent, BillingError } = await import("@/lib/billing/service");

const founder = { id: "u1", email: "ada@example.com" };

function reset(env: Record<string, string> = {}) {
  for (const k of Object.keys(db)) delete db[k];
  initialized.length = 0;
  subscriptions.length = 0;
  vi.unstubAllEnvs();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  db.profiles = [
    { id: "u1", plan: "free", credits: 0, status: "active", referred_by: null },
    { id: "ref", plan: "free", credits: 0, status: "active", referred_by: null },
  ];
  db.subscriptions = [];
  db.payments = [];
  db.audit_logs = [];
  db.discount_codes = [
    { id: "c20", code: "LAUNCH20", percent_off: 20, products: ["pro_monthly", "credits_3", "credits_10"], max_redemptions: null, expires_at: null, active: true },
    { id: "c100", code: "FREEPACK", percent_off: 100, products: ["credits_3"], max_redemptions: 1, expires_at: null, active: true },
    { id: "cold", code: "OLD", percent_off: 50, products: ["credits_3"], max_redemptions: null, expires_at: "2020-01-01T00:00:00Z", active: true },
  ];
  db.discount_redemptions = [];
  db.referral_rewards = [];
}

const lastPayment = () => db.payments[db.payments.length - 1];
const pay = (amount: number, extra: Record<string, unknown> = {}) =>
  handlePaystackEvent({
    event: "charge.success",
    data: {
      id: 1,
      status: "success",
      reference: lastPayment().reference,
      amount,
      currency: lastPayment().currency,
      paid_at: "2026-10-01T10:00:00Z",
      customer: { customer_code: "CUS_1" },
      authorization: { authorization_code: "AUTH_1", reusable: true },
      ...extra,
    },
  });

describe("discount codes", () => {
  beforeEach(() => reset());

  it("takes a code off the price and records the redemption once paid", async () => {
    await startCheckout(founder, "credits_10", "https://x/cb", { code: " launch20 " });
    expect(lastPayment()).toMatchObject({ amount_kobo: 800_000, list_amount_kobo: 1_000_000, discount_code_id: "c20", status: "pending" });
    expect(initialized[0]).toMatchObject({ amountKobo: 800_000, currency: "NGN", planCode: undefined });
    await pay(800_000);
    expect(db.profiles[0].credits).toBe(10);
    expect(db.discount_redemptions).toEqual([expect.objectContaining({ code_id: "c20", user_id: "u1" })]);
    await expect(startCheckout(founder, "credits_3", "https://x/cb", { code: "LAUNCH20" })).rejects.toThrow(/already used/);
  });

  it("explains codes that can't be used", async () => {
    await expect(quote("u1", "credits_3", "NGN", "NOPE")).rejects.toBeInstanceOf(BillingError);
    await expect(quote("u1", "credits_3", "NGN", "OLD")).rejects.toThrow(/expired/);
    await expect(quote("u1", "pro_monthly", "NGN", "FREEPACK")).rejects.toThrow(/doesn't apply/);
  });

  it("grants 100%-off purchases without sending the founder to Paystack", async () => {
    const url = await startCheckout(founder, "credits_3", "https://x/cb", { code: "FREEPACK" });
    expect(url).toBe("/app/billing?payment=success");
    expect(initialized).toHaveLength(0);
    expect(db.profiles[0].credits).toBe(3);
    expect(lastPayment()).toMatchObject({ amount_kobo: 0, status: "success" });
    // Its one use is gone.
    db.profiles.push({ id: "u2", plan: "free", credits: 0, status: "active" });
    await expect(quote("u2", "credits_3", "NGN", "FREEPACK")).rejects.toThrow(/fully used/);
  });

  it("charges a discounted first month of Pro once, then starts the plan next month", async () => {
    await startCheckout(founder, "pro_monthly", "https://x/cb", { code: "LAUNCH20" });
    expect(initialized[0]).toMatchObject({ amountKobo: 1_200_000, planCode: undefined });
    await pay(1_200_000);
    expect(db.profiles[0].plan).toBe("pro");
    expect(subscriptions).toEqual([
      { customerCode: "CUS_1", planCode: "PLN_NGN", authorizationCode: "AUTH_1", startDate: "2026-11-01T10:00:00.000Z" },
    ]);
    expect(db.subscriptions[0]).toMatchObject({ status: "active", current_period_end: "2026-11-01T10:00:00.000Z" });
  });

  it("keeps a discounted month of Pro but doesn't renew if the card can't be reused", async () => {
    await startCheckout(founder, "pro_monthly", "https://x/cb", { code: "LAUNCH20" });
    await pay(1_200_000, { authorization: { authorization_code: "AUTH_X", reusable: false } });
    expect(subscriptions).toHaveLength(0);
    expect(db.subscriptions[0]).toMatchObject({ status: "non_renewing" });
    expect(db.audit_logs.some((a) => a.action === "billing.renewal_not_started")).toBe(true);
  });

  it("uses the Paystack plan for full-price Pro", async () => {
    await startCheckout(founder, "pro_monthly", "https://x/cb");
    expect(initialized[0]).toMatchObject({ amountKobo: 1_500_000, planCode: "PLN_NGN" });
  });
});

describe("referrals", () => {
  beforeEach(() => {
    reset();
    db.profiles[0].referred_by = "ref";
    // The inviter has already spent ₦37,500, so their credits are usable straight away.
    db.payments.push({ id: "ref-paid", user_id: "ref", reference: "rr_old", amount_kobo: 3_750_000, currency: "NGN", product: "credits_10", status: "success" });
  });

  it("gives an invited founder 10% off their first purchase", async () => {
    const q = await quote("u1", "credits_3", "NGN");
    expect(q).toMatchObject({ amount: 450_000, percentOff: 10, source: { kind: "referral" } });
  });

  it("uses a better code instead of the referral discount", async () => {
    const q = await quote("u1", "credits_3", "NGN", "LAUNCH20");
    expect(q).toMatchObject({ amount: 400_000, source: { kind: "code" } });
  });

  it("gives the referrer 2 credits once, on the invited founder's first payment", async () => {
    await startCheckout(founder, "credits_3", "https://x/cb");
    await pay(450_000);
    expect(db.profiles.find((p) => p.id === "ref")!.credits).toBe(2);
    // Second purchase: full price, no second reward.
    await startCheckout(founder, "credits_3", "https://x/cb");
    expect(lastPayment()).toMatchObject({ amount_kobo: 500_000, referral_discount: false });
    await pay(500_000);
    expect(db.profiles.find((p) => p.id === "ref")!.credits).toBe(2);
    expect(db.referral_rewards).toHaveLength(1);
  });

  it("follows the super admin's referral settings", async () => {
    db.referral_settings = [{ id: 1, enabled: true, friend_percent_off: 25, referrer_credits: 5, min_spend_ngn: 3_750_000, min_spend_usd: 2_500 }];
    expect(await quote("u1", "credits_3", "NGN")).toMatchObject({ amount: 375_000, percentOff: 25 });
    await startCheckout(founder, "credits_3", "https://x/cb");
    await pay(375_000);
    expect(db.profiles.find((p) => p.id === "ref")!.credits).toBe(5);
  });

  it("gives no discount or reward while the programme is off", async () => {
    db.referral_settings = [{ id: 1, enabled: false, friend_percent_off: 25, referrer_credits: 5, min_spend_ngn: 3_750_000, min_spend_usd: 2_500 }];
    expect(await quote("u1", "credits_3", "NGN")).toMatchObject({ amount: 500_000, source: null });
    await startCheckout(founder, "credits_3", "https://x/cb");
    await pay(500_000);
    expect(db.referral_rewards).toHaveLength(0);
  });

  it("can reward the inviter without discounting the invited founder", async () => {
    db.referral_settings = [{ id: 1, enabled: true, friend_percent_off: 0, referrer_credits: 1, min_spend_ngn: 3_750_000, min_spend_usd: 2_500 }];
    expect(await quote("u1", "credits_3", "NGN")).toMatchObject({ amount: 500_000 });
    await startCheckout(founder, "credits_3", "https://x/cb");
    await pay(500_000);
    expect(db.profiles.find((p) => p.id === "ref")!.credits).toBe(1);
  });

  it("locks credits until the inviter has spent the minimum, then releases them once", async () => {
    db.payments = db.payments.filter((p) => p.user_id !== "ref"); // the inviter hasn't paid yet
    await startCheckout(founder, "credits_3", "https://x/cb");
    await pay(450_000);
    const inviter = () => db.profiles.find((p) => p.id === "ref")!;
    expect(inviter().credits).toBe(0);
    expect(db.referral_rewards[0]).toMatchObject({ status: "locked", credits: 2 });

    // The inviter buys a ₦10,000 pack: still locked.
    const asInviter = { id: "ref", email: "ref@example.com" };
    await startCheckout(asInviter, "credits_10", "https://x/cb");
    await pay(1_000_000);
    expect(inviter().credits).toBe(10);
    expect(db.referral_rewards[0].status).toBe("locked");

    // Two more ₦10,000 packs and a ₦5,000 pack: ₦35,000. Then one more takes them past ₦37,500.
    for (const product of ["credits_10", "credits_10", "credits_3"] as const) {
      await startCheckout(asInviter, product, "https://x/cb");
      await pay(lastPayment().amount_kobo as number);
    }
    expect(db.referral_rewards[0].status).toBe("locked");
    await startCheckout(asInviter, "credits_3", "https://x/cb");
    await pay(500_000);
    expect(db.referral_rewards[0]).toMatchObject({ status: "released" });
    expect(inviter().credits).toBe(10 + 10 + 10 + 3 + 3 + 2);

    // Later payments don't release it again.
    await startCheckout(asInviter, "credits_3", "https://x/cb");
    await pay(500_000);
    expect(inviter().credits).toBe(10 + 10 + 10 + 3 + 3 + 2 + 3);
  });

  it("doesn't reward a suspended referrer", async () => {
    db.profiles.find((p) => p.id === "ref")!.status = "suspended";
    await startCheckout(founder, "credits_3", "https://x/cb");
    await pay(450_000);
    expect(db.referral_rewards).toHaveLength(0);
  });
});

describe("dollar prices", () => {
  it("are refused until USD is switched on", async () => {
    reset();
    await expect(startCheckout(founder, "credits_3", "https://x/cb", { currency: "USD" })).rejects.toThrow(/currency/);
  });

  it("charge in cents once switched on", async () => {
    reset({ PAYSTACK_USD_ENABLED: "true" });
    await startCheckout(founder, "credits_10", "https://x/cb", { currency: "USD", code: "LAUNCH20" });
    expect(initialized[0]).toMatchObject({ amountKobo: 600, currency: "USD" });
    expect(lastPayment()).toMatchObject({ currency: "USD", amount_kobo: 600, list_amount_kobo: 700 });
    await pay(600);
    expect(db.profiles[0].credits).toBe(10);
  });
});
