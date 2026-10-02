import { z } from "zod";

import type { Difficulty, Persona, Plan } from "@/lib/supabase/database.types";

/**
 * What each plan includes. Super admins edit these under Admin → Plans
 * (stored in plan_settings); the defaults below apply until then. The plan
 * rules (entitlements.ts) and the pricing cards both read them, so what the
 * website promises always matches what the plan allows.
 */

export const ALL_PERSONAS: Persona[] = ["angel", "seed_vc", "grant_evaluator"];
export const ALL_DIFFICULTIES: Difficulty[] = ["friendly", "analytical", "tough"];

export const planRuleSchema = z.object({
  /** Shown under the plan name; null uses the built-in (translated) wording. */
  description: z.string().trim().max(120).nullable(),
  /** Extra selling points shown after the generated features. */
  extras: z.array(z.string().trim().min(1).max(120)).max(4),
  /** Free: assessments in total. Paid plans always have unlimited assessments. */
  assessments: z.number().int().min(0).max(100),
  /** Free: simulations in total. Paid: simulations each month. */
  simulations: z.number().int().min(0).max(1000),
  personas: z.array(z.enum(ALL_PERSONAS as [Persona, ...Persona[]])).min(1),
  difficulties: z.array(z.enum(ALL_DIFFICULTIES as [Difficulty, ...Difficulty[]])).min(1),
  /** Paid plans: full pitch decks each month. */
  decksPerMonth: z.number().int().min(0).max(100),
  /** Paid plans: AI rewrites of single slides on each plan-paid deck. */
  rewritesPerDeck: z.number().int().min(0).max(1000),
  /** Free: whether the founder's first deck can be previewed. */
  deckPreview: z.boolean(),
  pdfReports: z.boolean(),
  progressTracking: z.boolean(),
});
export type PlanRule = z.infer<typeof planRuleSchema>;
export type PlanRules = Record<Plan, PlanRule>;

export const PLAN_NAMES: Record<Plan, string> = { free: "Free", pro: "Pro", pro_plus: "Pro Plus" };
export const EDITABLE_PLANS: Plan[] = ["free", "pro", "pro_plus"];

const PAID_BASE: Omit<PlanRule, "simulations" | "decksPerMonth" | "rewritesPerDeck"> = {
  description: null,
  extras: [],
  assessments: 0,
  personas: ALL_PERSONAS,
  difficulties: ALL_DIFFICULTIES,
  deckPreview: true,
  pdfReports: true,
  progressTracking: true,
};

export const DEFAULT_PLAN_RULES: PlanRules = {
  free: {
    description: null,
    extras: [],
    assessments: 1,
    simulations: 1,
    personas: ["angel", "seed_vc"],
    difficulties: ["friendly", "analytical"],
    decksPerMonth: 0,
    rewritesPerDeck: 0,
    deckPreview: true,
    pdfReports: false,
    progressTracking: false,
  },
  pro: { ...PAID_BASE, simulations: 30, decksPerMonth: 3, rewritesPerDeck: 30 },
  pro_plus: { ...PAID_BASE, simulations: 100, decksPerMonth: 10, rewritesPerDeck: 100 },
};

/** Saved settings merged over the defaults. Anything malformed falls back to the default. */
export function mergeRules(saved: { plan: string; config: unknown }[]): PlanRules {
  const rules: PlanRules = structuredClone(DEFAULT_PLAN_RULES);
  for (const row of saved) {
    if (!EDITABLE_PLANS.includes(row.plan as Plan)) continue;
    const plan = row.plan as Plan;
    const parsed = planRuleSchema.safeParse({ ...rules[plan], ...(row.config as object) });
    if (parsed.success) rules[plan] = parsed.data;
    else console.error(`[plans] ignoring invalid settings for ${plan}`);
  }
  return rules;
}
