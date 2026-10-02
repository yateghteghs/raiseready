import { describe, expect, it } from "vitest";

import { countryCode } from "@/lib/currency/countries";
import {
  displayCurrency,
  estimate,
  localCurrency,
  priceLabel,
} from "@/lib/currency/display";

describe("currency display", () => {
  it("shows naira in Nigeria and dollars elsewhere, unless the visitor chose", () => {
    expect(displayCurrency({ country: "NG", chosen: null, usdOn: true })).toBe(
      "NGN",
    );
    expect(displayCurrency({ country: "KE", chosen: null, usdOn: true })).toBe(
      "USD",
    );
    expect(
      displayCurrency({ country: null, chosen: undefined, usdOn: true }),
    ).toBe("USD");
    expect(displayCurrency({ country: "KE", chosen: "NGN", usdOn: true })).toBe(
      "NGN",
    );
    expect(displayCurrency({ country: "NG", chosen: "EUR", usdOn: true })).toBe(
      "NGN",
    );
    expect(
      displayCurrency({ country: "KE", chosen: "USD", usdOn: false }),
    ).toBe("NGN");
  });

  it("finds the country from a profile name or a request header", () => {
    expect(countryCode("Kenya")).toBe("KE");
    expect(countryCode("GH")).toBe("GH");
    expect(countryCode("Other")).toBeNull();
    expect(countryCode(null)).toBeNull();
    expect(localCurrency("KE", "USD")).toBe("KES");
    expect(localCurrency("NG", "NGN")).toBeNull();
    expect(localCurrency("FR", "USD")).toBeNull();
    // Charged in naira outside Nigeria: estimate in dollars when there's no local currency.
    expect(localCurrency(null, "NGN")).toBe("USD");
    expect(localCurrency("KE", "NGN")).toBe("KES");
    expect(localCurrency("NG", "NGN")).toBeNull();
  });

  it("estimates roughly, and only with a rate", () => {
    const rates = { KES: 129, NGN: 1500 };
    expect(estimate(2500, "USD", "KES", rates)).toBe(3200);
    expect(estimate(1_500_000, "NGN", "KES", rates)).toBe(1300);
    expect(estimate(1_500_000, "NGN", "KES", { KES: 129 })).toBeNull();
    expect(estimate(2500, "USD", "GHS", rates)).toBeNull();
    expect(estimate(2500, "USD", null, rates)).toBeNull();
  });

  it("labels prices with an optional estimate", () => {
    expect(
      priceLabel(2500, { currency: "USD", local: "KES", rates: { KES: 129 } }),
    ).toEqual({
      price: "$25",
      approx: expect.stringMatching(/^≈ KES\s3,200$/),
    });
    expect(
      priceLabel(1_500_000, { currency: "NGN", local: null, rates: {} }),
    ).toEqual({ price: "₦15,000", approx: null });
    // Naira prices for a Kenyan visitor: shillings with a rate, otherwise dollars.
    expect(
      priceLabel(1_500_000, {
        currency: "NGN",
        local: "KES",
        rates: { NGN: 1500, KES: 129 },
      }).approx,
    ).toMatch(/^≈ KES\s1,300$/);
    expect(
      priceLabel(1_500_000, {
        currency: "NGN",
        local: "KES",
        rates: { NGN: 1500 },
      }).approx,
    ).toBe("≈ $10");
    expect(
      priceLabel(1_500_000, { currency: "NGN", local: "USD", rates: {} })
        .approx,
    ).toBeNull();
    expect(
      priceLabel(0, { currency: "USD", local: "GHS", rates: { GHS: 15 } }),
    ).toEqual({ price: "$0", approx: null });
    expect(
      priceLabel(250, { currency: "USD", local: "KES", rates: { KES: 0.9 } })
        .approx,
    ).toMatch(/^≈ KES\s2\.3$/);
  });
});
