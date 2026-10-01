import { describe, expect, it } from "vitest";

import { formatMoney, koboToNaira } from "@/lib/format";

describe("formatMoney", () => {
  it("defaults to Naira", () => {
    expect(formatMoney(15000)).toBe("₦15,000");
  });

  it("uses the stored currency when given", () => {
    expect(formatMoney(2500, "usd")).toBe("$2,500");
  });

  it("keeps kobo when the amount is fractional", () => {
    expect(formatMoney(1234.5)).toBe("₦1,234.50");
  });

  it("supports compact notation for large figures", () => {
    expect(formatMoney(250_000_000, "NGN", { compact: true })).toBe("₦250M");
  });
});

describe("koboToNaira", () => {
  it("converts Paystack kobo amounts", () => {
    expect(koboToNaira(1_500_000)).toBe(15_000);
  });
});
