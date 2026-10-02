import { describe, expect, it } from "vitest";

import { assessmentAccess, deckBuildAccess, pdfAccess, progressAccess, rewriteLimit, simulationAccess } from "@/lib/billing/entitlements";
import { DEFAULT_PLAN_RULES, mergeRules } from "@/lib/billing/plan-rules";

const base = { credits: 0, assessments: 0, freeSimulationsUsed: 0, proSimulationsThisMonth: 0 };

describe("admin-edited plan rules", () => {
  it("merges saved settings over the defaults and ignores invalid ones", () => {
    const rules = mergeRules([
      { plan: "free", config: { simulations: 2, personas: ["angel", "seed_vc", "grant_evaluator"] } },
      { plan: "pro", config: { simulations: -5 } },
      { plan: "platinum", config: {} },
    ]);
    expect(rules.free).toMatchObject({ simulations: 2, assessments: 1 });
    expect(rules.pro.simulations).toBe(DEFAULT_PLAN_RULES.pro.simulations);
  });

  it("enforces what the admin set, not just what the cards say", () => {
    const rules = mergeRules([
      { plan: "free", config: { simulations: 2, personas: ["angel", "grant_evaluator"], pdfReports: true, deckPreview: false, assessments: 3 } },
      { plan: "pro", config: { difficulties: ["friendly", "analytical"], rewritesPerDeck: 5, progressTracking: false } },
    ]);
    const free = { ...base, proActive: false, rules };
    expect(simulationAccess({ ...free, freeSimulationsUsed: 1 }, "grant_evaluator", "friendly")).toEqual({ ok: true, via: "free" });
    expect(simulationAccess(free, "seed_vc", "friendly")).toMatchObject({ ok: false });
    expect(assessmentAccess({ ...free, assessments: 2 })).toMatchObject({ ok: true });
    expect(pdfAccess(free)).toMatchObject({ ok: true });
    expect(deckBuildAccess({ proActive: false, deckCredits: 0, proDecksThisMonth: 0, previewsUsed: 0, rules })).toMatchObject({ ok: false });

    const pro = { ...base, proActive: true, tier: "pro" as const, rules };
    expect(simulationAccess(pro, "seed_vc", "tough")).toMatchObject({ ok: false, reason: expect.stringMatching(/Pro includes/) });
    expect(simulationAccess({ ...pro, credits: 1 }, "seed_vc", "tough")).toEqual({ ok: true, via: "credit" });
    expect(progressAccess(pro)).toBe(false);
    expect(rewriteLimit("pro", "pro", rules)).toBe(5);
  });
});
