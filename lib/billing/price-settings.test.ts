import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeDb } from "../../test/fake-supabase";

const fake = createFakeDb();
const db = fake.tables;
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fake.client }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const plans: unknown[][] = [];
const initialized: Record<string, unknown>[] = [];
vi.mock("@/lib/billing/paystack", async (original) => ({
  ...(await original<typeof import("@/lib/billing/paystack")>()),
  ensurePlan: async (...args: unknown[]) => {
    plans.push(args);
    return "PLN_X";
  },
  initializeTransaction: async (input: Record<string, unknown>) => {
    initialized.push(input);
    return { authorization_url: "https://checkout.paystack.test/x", reference: input.reference };
  },
}));

const { getPrices, priceFormSchema, savePrices, tableFromForm } = await import("@/lib/billing/price-settings");
const { startCheckout } = await import("@/lib/billing/service");
const { DEFAULT_PRICES } = await import("@/lib/billing/prices");

const staff = { id: "staff" } as never;

function reset() {
  for (const k of Object.keys(db)) delete db[k];
  plans.length = 0;
  initialized.length = 0;
  db.profiles = [{ id: "u1", plan: "free", credits: 0, status: "active", referred_by: null }];
  db.subscriptions = [];
  db.payments = [];
  db.price_settings = [];
  db.audit_logs = [];
  db.discount_codes = [];
  db.discount_redemptions = [];
  db.team_members = [];
}

const form = (overrides: Record<string, string> = {}) =>
  Object.fromEntries(
    (["NGN", "USD"] as const).flatMap((c) =>
      Object.entries(DEFAULT_PRICES[c]).map(([p, v]) => [`${c}.${p}`, overrides[`${c}.${p}`] ?? String(v / 100)]),
    ),
  );

describe("price settings", () => {
  beforeEach(reset);

  it("uses the defaults until a super admin changes a price", async () => {
    expect(await getPrices()).toEqual(DEFAULT_PRICES);
    db.price_settings.push({ product: "pro_monthly", currency: "NGN", amount: 2_000_000 });
    expect((await getPrices()).NGN).toMatchObject({ pro_monthly: 2_000_000, credits_3: 500_000 });
  });

  it("saves only what changed, in kobo, and logs it", async () => {
    const parsed = priceFormSchema.parse(form({ "NGN.pro_monthly": "20000", "USD.deck_builder": "6" }));
    expect(await savePrices(staff, tableFromForm(parsed as Record<string, number>))).toEqual({ changed: 2 });
    expect(db.price_settings).toEqual([
      expect.objectContaining({ product: "pro_monthly", currency: "NGN", amount: 2_000_000 }),
      expect.objectContaining({ product: "deck_builder", currency: "USD", amount: 600 }),
    ]);
    expect(db.audit_logs[0]).toMatchObject({ action: "admin.prices_changed" });
    expect(await savePrices(staff, await getPrices())).toEqual({ changed: 0 });
  });

  it("refuses prices that are too low or not whole numbers", () => {
    expect(priceFormSchema.safeParse(form({ "NGN.credits_3": "50" })).success).toBe(false);
    expect(priceFormSchema.safeParse(form({ "USD.pro_monthly": "9.99" })).success).toBe(false);
    expect(priceFormSchema.safeParse(form({ "NGN.credits_3": "abc" })).success).toBe(false);
  });

  it("charges the new price at checkout, on a Paystack plan at that price", async () => {
    db.price_settings.push({ product: "pro_monthly", currency: "NGN", amount: 2_000_000 });
    await startCheckout({ id: "u1", email: "a@x.example" }, "pro_monthly", "https://x/cb");
    expect(initialized[0]).toMatchObject({ amountKobo: 2_000_000 });
    expect(plans[0]).toEqual(["pro_monthly", "NGN", 2_000_000]);
  });
});
