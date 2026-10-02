import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeDb } from "../../test/fake-supabase";

const fake = createFakeDb();
const db = fake.tables;
let role = "super_admin";
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fake.client }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/admin/auth", () => ({ getStaff: async () => ({ id: "staff", email: "s@x", profile: { role } }) }));

const { savePlanAction } = await import("@/lib/billing/plan-actions");
const { saveFxRateAction, deleteFxRateAction } = await import("@/lib/currency/fx-actions");
const { getPlanRules } = await import("@/lib/billing/plan-settings");
const { getFxRates } = await import("@/lib/currency/fx");
const { simulationAccess } = await import("@/lib/billing/entitlements");

const idle = { status: "idle" } as never;

function form(entries: [string, string][]) {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
}

const proForm = (overrides: [string, string][] = []) => {
  const f = form([
    ["description", "For founders raising this year"],
    ["simulations", "40"],
    ["decksPerMonth", "4"],
    ["rewritesPerDeck", "20"],
    ["personas", "angel"],
    ["personas", "seed_vc"],
    ["difficulties", "friendly"],
    ["difficulties", "tough"],
    ["pdfReports", "on"],
    ["extras", "Priority support\n\n  Monthly office hours  "],
  ]);
  for (const [k, v] of overrides) f.set(k, v);
  return f;
};

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  db.plan_settings = [];
  db.fx_rates = [];
  db.audit_logs = [];
  role = "super_admin";
});

describe("plan editor", () => {
  it("saves a plan and the limits follow it", async () => {
    expect(await savePlanAction("pro", idle, proForm())).toMatchObject({ status: "success" });
    const rules = await getPlanRules();
    expect(rules.pro).toMatchObject({
      description: "For founders raising this year",
      simulations: 40,
      decksPerMonth: 4,
      personas: ["angel", "seed_vc"],
      difficulties: ["friendly", "tough"],
      pdfReports: true,
      progressTracking: false,
      extras: ["Priority support", "Monthly office hours"],
    });
    expect(db.audit_logs[0]).toMatchObject({ action: "admin.plan_changed" });

    const usage = { tier: "pro" as const, proActive: true, credits: 0, assessments: 0, freeSimulationsUsed: 0, proSimulationsThisMonth: 0, rules };
    expect(simulationAccess(usage, "grant_evaluator", "friendly")).toMatchObject({ ok: false });
    expect(simulationAccess(usage, "seed_vc", "tough")).toMatchObject({ ok: true });
  });

  it("rejects bad input and non super admins", async () => {
    const bad = await savePlanAction("pro", idle, proForm([["simulations", "-1"]]));
    expect(bad).toMatchObject({ status: "error", fieldErrors: { simulations: [expect.any(String)] } });
    const none = await savePlanAction("free", idle, form([["simulations", "1"], ["assessments", "1"]]));
    expect(none.fieldErrors).toMatchObject({ personas: ["Choose at least one investor."], difficulties: ["Choose at least one difficulty."] });
    expect(await savePlanAction("teams", idle, proForm())).toMatchObject({ status: "error", message: "Unknown plan." });
    role = "admin";
    expect(await savePlanAction("pro", idle, proForm())).toMatchObject({ status: "error" });
    expect(db.plan_settings).toHaveLength(0);
  });
});

describe("exchange rates", () => {
  it("saves, replaces and removes a rate", async () => {
    expect(await saveFxRateAction(idle, form([["currency", "kes"], ["per_usd", "129.5"]]))).toMatchObject({ status: "success" });
    await saveFxRateAction(idle, form([["currency", "KES"], ["per_usd", "130"]]));
    expect(await getFxRates()).toEqual({ KES: 130 });
    expect(await saveFxRateAction(idle, form([["currency", "USD"], ["per_usd", "1"]]))).toMatchObject({ status: "error" });
    expect(await saveFxRateAction(idle, form([["currency", "GHS"], ["per_usd", "0"]]))).toMatchObject({ status: "error" });
    await deleteFxRateAction("KES");
    expect(await getFxRates()).toEqual({});
    role = "support";
    expect(await deleteFxRateAction("KES")).toEqual({ error: expect.any(String) });
  });
});
