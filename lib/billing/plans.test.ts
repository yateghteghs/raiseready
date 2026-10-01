import { describe, expect, it } from "vitest";

import { CREDIT_PACKS, FREE_PLAN, PRO_PLAN } from "@/lib/billing/plans";
import { formatMoney, koboToNaira } from "@/lib/format";

describe("plans", () => {
  it("matches the published prices", () => {
    expect(formatMoney(koboToNaira(PRO_PLAN.priceKobo))).toBe("₦15,000");
    expect(CREDIT_PACKS.map((p) => formatMoney(koboToNaira(p.priceKobo)))).toEqual(["₦5,000", "₦10,000"]);
  });

  it("keeps the tough difficulty and Grant Evaluator for paid users", () => {
    expect(FREE_PLAN.difficulties).not.toContain("tough");
    expect(FREE_PLAN.personas).not.toContain("grant_evaluator");
  });
});
