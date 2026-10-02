import { describe, expect, it } from "vitest";

import { discountCodeSchema } from "@/lib/billing/discount-codes";

describe("discount code form", () => {
  it("normalises the code and accepts optional limits", () => {
    const parsed = discountCodeSchema.parse({ code: " launch 20", percent_off: "20", products: ["credits_3"], max_redemptions: "", expires_on: "" });
    expect(parsed).toMatchObject({ code: "LAUNCH20", percent_off: 20, products: ["credits_3"], max_redemptions: undefined, expires_on: undefined });
  });

  it("rejects bad codes, percentages and empty product lists", () => {
    expect(discountCodeSchema.safeParse({ code: "A!", percent_off: "20", products: ["credits_3"] }).success).toBe(false);
    expect(discountCodeSchema.safeParse({ code: "OK20", percent_off: "0", products: ["credits_3"] }).success).toBe(false);
    expect(discountCodeSchema.safeParse({ code: "OK20", percent_off: "101", products: ["credits_3"] }).success).toBe(false);
    expect(discountCodeSchema.safeParse({ code: "OK20", percent_off: "20", products: [] }).success).toBe(false);
  });
});
