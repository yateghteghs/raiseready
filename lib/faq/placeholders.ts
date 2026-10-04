import type { PlanRules } from "@/lib/billing/plan-rules";

/**
 * Numbers an FAQ answer can quote from Admin → Plans, written as
 * `{pro.simulations}`, so answers stay right when a plan changes.
 */
export const PLAN_PLACEHOLDERS = {
  "free.assessments": (r: PlanRules) => r.free.assessments,
  "free.simulations": (r: PlanRules) => r.free.simulations,
  "pro.simulations": (r: PlanRules) => r.pro.simulations,
  "pro.decks": (r: PlanRules) => r.pro.decksPerMonth,
  "pro_plus.simulations": (r: PlanRules) => r.pro_plus.simulations,
  "pro_plus.decks": (r: PlanRules) => r.pro_plus.decksPerMonth,
} as const;

/** Replaces known placeholders with the live numbers; anything else is left as written. */
export function fillPlanNumbers(text: string, rules: PlanRules): string {
  return text.replace(/\{([a-z_]+\.[a-z]+)\}/g, (whole, key: string) =>
    key in PLAN_PLACEHOLDERS ? String(PLAN_PLACEHOLDERS[key as keyof typeof PLAN_PLACEHOLDERS](rules)) : whole,
  );
}
