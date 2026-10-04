import { describe, expect, it } from "vitest";

import { DEFAULT_PLAN_RULES } from "@/lib/billing/plan-rules";
import { fillPlanNumbers } from "@/lib/faq/placeholders";

describe("FAQ plan numbers", () => {
  it("fills in the live plan numbers", () => {
    const rules = structuredClone(DEFAULT_PLAN_RULES);
    rules.pro.simulations = 40;
    expect(fillPlanNumbers("Up to {pro.simulations} sessions, {pro_plus.decks} decks.", rules)).toBe(
      `Up to 40 sessions, ${DEFAULT_PLAN_RULES.pro_plus.decksPerMonth} decks.`,
    );
  });

  it("leaves unknown or malformed placeholders alone", () => {
    expect(fillPlanNumbers("{pro.price} and {nope} and {pro.simulations", DEFAULT_PLAN_RULES)).toBe(
      "{pro.price} and {nope} and {pro.simulations",
    );
  });
});
