import { describe, expect, it } from "vitest";

import { availableCurrencies, codeProblem, discounted, normaliseCode, priceOf } from "@/lib/billing/prices";

describe("prices", () => {
  it("keeps USD hidden until it is switched on", () => {
    expect(availableCurrencies({})).toEqual(["NGN"]);
    expect(availableCurrencies({ PAYSTACK_USD_ENABLED: "true" })).toEqual(["NGN", "USD"]);
    expect(priceOf("pro_monthly", "NGN")).toBe(1_500_000);
  });

  it("rounds discounts to whole units and respects the minimum charge", () => {
    expect(discounted(1_500_000, 20, "NGN")).toEqual({ amount: 1_200_000, discount: 300_000 });
    expect(discounted(500_000, 33, "NGN")).toEqual({ amount: 335_000, discount: 165_000 });
    expect(discounted(1_000, 15, "USD")).toEqual({ amount: 900, discount: 100 }); // $8.50 rounds to $9
    expect(discounted(400, 99, "USD")).toEqual({ amount: 100, discount: 300 }); // never below $1
    expect(discounted(400, 100, "USD")).toEqual({ amount: 0, discount: 400 });
    expect(discounted(400, 0, "USD")).toEqual({ amount: 400, discount: 0 });
  });

  it("checks codes against expiry, product, limits and earlier use", () => {
    const code = { active: true, percent_off: 20, products: ["credits_3" as const], max_redemptions: 2, expires_at: "2026-12-31T00:00:00Z" };
    const ok = { product: "credits_3" as const, redemptions: 0, usedByThisFounder: false, now: Date.parse("2026-10-01T00:00:00Z") };
    expect(codeProblem(code, ok)).toBeNull();
    expect(codeProblem(null, ok)).toMatch(/isn't valid/);
    expect(codeProblem({ ...code, active: false }, ok)).toMatch(/isn't valid/);
    expect(codeProblem(code, { ...ok, now: Date.parse("2027-01-01T00:00:00Z") })).toMatch(/expired/);
    expect(codeProblem(code, { ...ok, product: "pro_monthly" })).toMatch(/doesn't apply/);
    expect(codeProblem(code, { ...ok, usedByThisFounder: true })).toMatch(/already used/);
    expect(codeProblem(code, { ...ok, redemptions: 2 })).toMatch(/fully used/);
    expect(codeProblem({ ...code, max_redemptions: null }, { ...ok, redemptions: 999 })).toBeNull();
  });

  it("normalises typed codes", () => {
    expect(normaliseCode("  launch 20 ")).toBe("LAUNCH20");
  });
});
