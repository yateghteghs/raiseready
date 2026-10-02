import { describe, expect, it } from "vitest";

import { discountCodeSchema } from "@/lib/billing/discount-codes";
import { referralSettingsSchema } from "@/lib/billing/referral-settings";

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

describe("referral settings form", () => {
  it("accepts 0-100% and 0-50 credits, with the on/off checkbox", () => {
    const mins = { min_spend_naira: "37500", min_spend_dollars: "25" };
    expect(referralSettingsSchema.parse({ enabled: "on", friend_percent_off: "15", referrer_credits: "3", ...mins })).toEqual({
      enabled: true,
      friend_percent_off: 15,
      referrer_credits: 3,
      min_spend_naira: 37_500,
      min_spend_dollars: 25,
    });
    expect(referralSettingsSchema.parse({ friend_percent_off: "0", referrer_credits: "0", ...mins }).enabled).toBe(false);
    expect(referralSettingsSchema.safeParse({ friend_percent_off: "101", referrer_credits: "1", ...mins }).success).toBe(false);
    expect(referralSettingsSchema.safeParse({ friend_percent_off: "10", referrer_credits: "51", ...mins }).success).toBe(false);
    expect(referralSettingsSchema.safeParse({ friend_percent_off: "7.5", referrer_credits: "1", ...mins }).success).toBe(false);
    expect(referralSettingsSchema.safeParse({ friend_percent_off: "10", referrer_credits: "1", min_spend_naira: "-1", min_spend_dollars: "25" }).success).toBe(false);
  });
});
