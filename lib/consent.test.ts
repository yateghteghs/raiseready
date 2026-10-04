import { describe, expect, it } from "vitest";

import { isConsent, preferenceMaxAge } from "@/lib/consent";

describe("cookie consent", () => {
  it("accepts only the two choices", () => {
    expect(isConsent("all")).toBe(true);
    expect(isConsent("essential")).toBe(true);
    expect(isConsent("yes")).toBe(false);
    expect(isConsent(undefined)).toBe(false);
  });

  it("keeps preference cookies only after the visitor accepts", () => {
    expect(preferenceMaxAge("all", 30)).toBe(30 * 24 * 60 * 60);
    expect(preferenceMaxAge("essential", 30)).toBeUndefined();
    expect(preferenceMaxAge(undefined, 365)).toBeUndefined();
  });
});
