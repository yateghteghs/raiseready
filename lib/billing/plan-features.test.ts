import { describe, expect, it } from "vitest";

import { planFeatures } from "@/lib/billing/plan-features";
import { DEFAULT_PLAN_RULES } from "@/lib/billing/plan-rules";
import { DICTIONARIES } from "@/lib/i18n/messages";

const t = DICTIONARIES.en.pricing.features;

describe("plan features", () => {
  it("describes the default plans", () => {
    expect(planFeatures("free", DEFAULT_PLAN_RULES, t)).toEqual([
      "1 readiness assessment",
      "1 Investor Room simulation",
      "Investors: Angel, Seed VC",
      "Difficulty: Friendly, Analytical",
      "Pitch deck preview: the first 3 slides",
    ]);
    expect(planFeatures("pro", DEFAULT_PLAN_RULES, t)).toContain("Up to 30 simulations a month");
    expect(planFeatures("pro_plus", DEFAULT_PLAN_RULES, t)).toEqual([
      "Everything in Pro",
      "Up to 100 simulations a month",
      "10 pitch decks a month",
      "100 AI rewrites per deck",
      "Voice practice and slide-by-slide deck feedback as they launch",
    ]);
  });

  it("follows admin changes, so the card never promises more than the plan allows", () => {
    const rules = structuredClone(DEFAULT_PLAN_RULES);
    rules.free = { ...rules.free, simulations: 2, personas: ["angel", "seed_vc", "grant_evaluator"], pdfReports: true, extras: ["Founder community"] };
    rules.pro = { ...rules.pro, pdfReports: false };
    expect(planFeatures("free", rules, t)).toEqual(
      expect.arrayContaining(["2 Investor Room simulations", "All investors, including Grant Evaluator", "Downloadable PDF reports", "Founder community"]),
    );
    expect(planFeatures("pro", rules, t)).not.toContain("Downloadable PDF reports");
    // Pro Plus still has PDFs, so it lists them rather than hiding them behind "Everything in Pro".
    expect(planFeatures("pro_plus", rules, t)).toContain("Downloadable PDF reports");
  });

  it("works in every language", () => {
    expect(planFeatures("pro", DEFAULT_PLAN_RULES, DICTIONARIES.fr.pricing.features)).toContain("Jusqu'à 30 simulations par mois");
  });
});
