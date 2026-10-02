import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeDb } from "../../test/fake-supabase";
import { assessmentAccess, isProActive, lagosMonthStart, PRO_GRACE_MS, simulationAccess, type Usage } from "@/lib/billing/entitlements";
import { isValidSignature } from "@/lib/billing/paystack";

const fake = createFakeDb();
const db = fake.tables;
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fake.client }));
vi.mock("@/lib/ai/usage", () => ({ withinRateLimit: async () => true }));

const { applyChargeSuccess, handlePaystackEvent, getUsage } = await import("@/lib/billing/service");
const { startSimulation } = await import("@/lib/simulation/service");

const usage = (over: Partial<Usage> = {}): Usage => ({
  proActive: false,
  credits: 0,
  assessments: 0,
  freeSimulationsUsed: 0,
  proSimulationsThisMonth: 0,
  ...over,
});

describe("plan rules", () => {
  it("gives free users one simulation with an Angel or Seed VC on friendly/analytical", () => {
    expect(simulationAccess(usage(), "angel", "friendly")).toEqual({ ok: true, via: "free" });
    expect(simulationAccess(usage(), "grant_evaluator", "friendly")).toMatchObject({ ok: false, upgrade: true });
    expect(simulationAccess(usage(), "seed_vc", "tough")).toMatchObject({ ok: false });
    expect(simulationAccess(usage({ freeSimulationsUsed: 1 }), "angel", "friendly")).toMatchObject({ ok: false, reason: expect.stringMatching(/used your free/) });
  });

  it("lets credits pay for any persona and difficulty", () => {
    expect(simulationAccess(usage({ credits: 2, freeSimulationsUsed: 1 }), "grant_evaluator", "tough")).toEqual({ ok: true, via: "credit" });
  });

  it("gives Pro 30 simulations a month, then falls back to credits", () => {
    expect(simulationAccess(usage({ proActive: true, proSimulationsThisMonth: 29 }), "seed_vc", "tough")).toEqual({ ok: true, via: "pro" });
    expect(simulationAccess(usage({ proActive: true, proSimulationsThisMonth: 30 }), "seed_vc", "tough")).toMatchObject({ ok: false });
    expect(simulationAccess(usage({ proActive: true, proSimulationsThisMonth: 30, credits: 1 }), "seed_vc", "tough")).toEqual({ ok: true, via: "credit" });
  });

  it("gives free users one assessment and Pro unlimited", () => {
    expect(assessmentAccess(usage())).toMatchObject({ ok: true });
    expect(assessmentAccess(usage({ assessments: 1 }))).toMatchObject({ ok: false });
    expect(assessmentAccess(usage({ proActive: true, assessments: 40 }))).toMatchObject({ ok: true });
  });

  it("keeps Pro through a short grace period after the paid period ends", () => {
    const now = Date.parse("2026-11-10T00:00:00Z");
    const sub = (end: string) => ({ status: "non_renewing" as const, current_period_end: end });
    expect(isProActive("pro", sub("2026-11-09T00:00:00Z"), now)).toBe(true);
    expect(isProActive("pro", sub(new Date(now - PRO_GRACE_MS - 1).toISOString()), now)).toBe(false);
    expect(isProActive("free", null, now)).toBe(false);
  });

  it("counts months in Lagos time", () => {
    // 23:30 UTC on 31 Oct is already 1 Nov in Lagos.
    expect(lagosMonthStart(Date.parse("2026-10-31T23:30:00Z")).toISOString()).toBe("2026-10-31T23:00:00.000Z");
  });
});

describe("webhook signature", () => {
  const secret = "sk_test_abc";
  const body = '{"event":"charge.success"}';
  const sign = (b: string) => createHmac("sha512", secret).update(b).digest("hex");

  it("accepts Paystack's HMAC-SHA512 signature", () => {
    expect(isValidSignature(body, sign(body), secret)).toBe(true);
  });

  it("rejects tampered bodies, wrong secrets and missing signatures", () => {
    expect(isValidSignature(body + " ", sign(body), secret)).toBe(false);
    expect(isValidSignature(body, createHmac("sha512", "other").update(body).digest("hex"), secret)).toBe(false);
    expect(isValidSignature(body, null, secret)).toBe(false);
  });
});

function reset() {
  for (const k of Object.keys(db)) delete db[k];
  db.profiles = [{ id: "u1", plan: "free", credits: 0, paystack_customer_code: null }];
  db.subscriptions = [];
  db.audit_logs = [];
  db.payments = [
    { id: "p-credits", user_id: "u1", reference: "rr_credits", amount_kobo: 500_000, currency: "NGN", product: "credits_3", status: "pending" },
    { id: "p-pro", user_id: "u1", reference: "rr_pro", amount_kobo: 1_500_000, currency: "NGN", product: "pro_monthly", status: "pending" },
  ];
}

const charge = (reference: string, amount: number, extra: Record<string, unknown> = {}) => ({
  event: "charge.success",
  data: { id: 1, status: "success", reference, amount, currency: "NGN", paid_at: "2026-10-01T10:00:00Z", customer: { customer_code: "CUS_1", email: "a@x.co" }, ...extra },
});

describe("payments via webhook", () => {
  beforeEach(reset);

  it("adds credits once, even if Paystack sends the event twice", async () => {
    await handlePaystackEvent(charge("rr_credits", 500_000));
    await handlePaystackEvent(charge("rr_credits", 500_000));
    expect(db.profiles[0].credits).toBe(3);
    expect(db.payments[0].status).toBe("success");
    expect(db.audit_logs.filter((a) => a.action === "billing.credits_added")).toHaveLength(1);
  });

  it("does not double-grant when the return page and webhook both apply the payment", async () => {
    const event = charge("rr_credits", 500_000);
    const results = await Promise.all([applyChargeSuccess(event.data as never, event), handlePaystackEvent(event)]);
    expect(results[0]).toBe(true);
    expect(db.profiles[0].credits).toBe(3);
  });

  it("adds one deck for a deck builder purchase, once", async () => {
    db.payments.push({ id: "p-deck", user_id: "u1", reference: "rr_deck", amount_kobo: 750_000, currency: "NGN", product: "deck_builder", status: "pending" });
    const tx = { id: 9, status: "success", reference: "rr_deck", amount: 750_000, currency: "NGN", paid_at: "2026-10-02T00:00:00Z" };
    expect(await applyChargeSuccess(tx, {})).toBe(true);
    expect(await applyChargeSuccess(tx, {})).toBe(false);
    expect(db.profiles.find((p) => p.id === "u1")?.deck_credits).toBe(1);
    expect(db.profiles.find((p) => p.id === "u1")?.credits).toBe(0);
  });

  it("upgrades the account to Pro and links the Paystack customer", async () => {
    await handlePaystackEvent(charge("rr_pro", 1_500_000, { plan: { plan_code: "PLN_pro" } }));
    expect(db.profiles[0]).toMatchObject({ plan: "pro", paystack_customer_code: "CUS_1" });
    expect(db.subscriptions[0]).toMatchObject({ user_id: "u1", status: "active", current_period_end: "2026-11-01T10:00:00.000Z" });
    const u = await getUsage("u1", null);
    expect(u.proActive).toBe(true);
  });

  it("refuses a payment whose amount doesn't match", async () => {
    await handlePaystackEvent(charge("rr_credits", 100));
    expect(db.profiles[0].credits).toBe(0);
    expect(db.payments[0].status).toBe("failed");
  });

  it("ignores failed charges and unknown references without a plan", async () => {
    await handlePaystackEvent({ event: "charge.success", data: { ...charge("rr_credits", 500_000).data, status: "failed" } });
    await handlePaystackEvent(charge("someone-elses-ref", 500_000));
    expect(db.profiles[0].credits).toBe(0);
  });

  it("follows the subscription lifecycle: created, not renewing, then ended", async () => {
    await handlePaystackEvent(charge("rr_pro", 1_500_000, { plan: { plan_code: "PLN_pro" } }));
    await handlePaystackEvent({
      event: "subscription.create",
      data: { subscription_code: "SUB_1", status: "active", next_payment_date: "2026-11-01T10:00:00Z", customer: { customer_code: "CUS_1" } },
    });
    expect(db.subscriptions).toHaveLength(1);
    expect(db.subscriptions[0]).toMatchObject({ provider_subscription_code: "SUB_1", status: "active" });

    await handlePaystackEvent({ event: "subscription.not_renew", data: { subscription_code: "SUB_1", status: "non-renewing", customer: { customer_code: "CUS_1" } } });
    expect(db.subscriptions[0].status).toBe("non_renewing");
    expect(db.profiles[0].plan).toBe("pro");

    await handlePaystackEvent({ event: "subscription.disable", data: { subscription_code: "SUB_1", status: "complete", customer: { customer_code: "CUS_1" } } });
    expect(db.subscriptions[0].status).toBe("completed");
    expect(db.profiles[0].plan).toBe("free");
  });

  it("records monthly renewals that arrive with Paystack's own reference", async () => {
    await handlePaystackEvent(charge("rr_pro", 1_500_000, { plan: { plan_code: "PLN_pro" } }));
    await handlePaystackEvent(charge("T_renewal_1", 1_500_000, { plan: { plan_code: "PLN_pro" }, paid_at: "2026-11-01T10:00:00Z" }));
    await handlePaystackEvent(charge("T_renewal_1", 1_500_000, { plan: { plan_code: "PLN_pro" }, paid_at: "2026-11-01T10:00:00Z" }));
    expect(db.payments.filter((p) => p.reference === "T_renewal_1")).toHaveLength(1);
    expect(db.subscriptions[0].current_period_end).toBe("2026-12-01T10:00:00.000Z");
  });
});

describe("limits when starting a simulation", () => {
  beforeEach(() => {
    reset();
    db.startups = [{ id: "s1", owner_id: "u1", name: "PayLink" }];
    db.knowledge_profiles = [{ id: "kp1", startup_id: "s1", version: 1, source_document_ids: [], data: {} }];
    db.documents = [];
    db.simulations = [];
    db.simulation_turns = [];
    db.assessments = [];
  });
  const start = (persona = "angel", difficulty = "friendly") =>
    startSimulation("u1", db.startups[0] as never, { persona: persona as never, difficulty: difficulty as never, fundingType: null });

  it("allows the one free simulation, then blocks the next", async () => {
    await start();
    expect(db.simulations[0].funded_by).toBe("free");
    await expect(start()).rejects.toThrow(/used your free simulation/);
  });

  it("blocks Pro-only choices on the free plan", async () => {
    await expect(start("grant_evaluator", "tough")).rejects.toThrow(/^Free includes an Angel investor or a /);
    expect(db.simulations).toHaveLength(0);
  });

  it("spends a credit when the free allowance is used up", async () => {
    db.profiles[0].credits = 2;
    await start();
    await start("grant_evaluator", "tough");
    expect(db.simulations.map((s) => s.funded_by)).toEqual(["free", "credit"]);
    expect(db.profiles[0].credits).toBe(1);
  });

  it("unlocks everything after a test payment upgrades the account via webhook", async () => {
    await handlePaystackEvent(charge("rr_pro", 1_500_000, { plan: { plan_code: "PLN_pro" } }));
    await start("grant_evaluator", "tough");
    await start("seed_vc", "tough");
    expect(db.simulations.map((s) => s.funded_by)).toEqual(["pro", "pro"]);
  });
});
