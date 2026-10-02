import { describe, expect, it } from "vitest";

import { CREDIT_PACKS, FREE_PLAN } from "@/lib/billing/plans";
import { DEFAULT_PRICES } from "@/lib/billing/prices";
import { formatMoney, koboToNaira } from "@/lib/format";

describe("plans", () => {
  it("matches the published prices", () => {
    expect(formatMoney(koboToNaira(DEFAULT_PRICES.NGN.pro_monthly))).toBe("₦15,000");
    expect(formatMoney(koboToNaira(DEFAULT_PRICES.NGN.pro_plus_monthly))).toBe("₦35,000");
    expect(CREDIT_PACKS.map((p) => formatMoney(koboToNaira(DEFAULT_PRICES.NGN[p.product])))).toEqual(["₦5,000", "₦10,000"]);
  });

  it("keeps the tough difficulty and Grant Evaluator for paid users", () => {
    expect(FREE_PLAN.difficulties).not.toContain("tough");
    expect(FREE_PLAN.personas).not.toContain("grant_evaluator");
  });
});
