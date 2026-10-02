/**
 * Plans, prices and limits (spec section 7). The single source of truth for
 * both the pricing page and server-side limit enforcement.
 * Prices are in lib/billing/prices.ts and can be changed by super admins.
 */

import type { Difficulty, PaidPlan, PaymentProduct, Persona } from "@/lib/supabase/database.types";

export const CURRENCY = "NGN";

export const FREE_PLAN = {
  id: "free",
  name: "Free",
  priceKobo: 0,
  assessments: 1,
  simulations: 1,
  personas: ["angel", "seed_vc"] as Persona[],
  difficulties: ["friendly", "analytical"] as Difficulty[],
  pdfReports: false,
  progressTracking: false,
} as const;

export const PRO_PLAN = {
  id: "pro",
  name: "Pro",
  product: "pro_monthly" as PaymentProduct,
  interval: "month",
  assessments: Infinity,
  simulationsPerMonth: 30,
  personas: ["seed_vc", "angel", "grant_evaluator"] as Persona[],
  difficulties: ["friendly", "analytical", "tough"] as Difficulty[],
  pdfReports: true,
  progressTracking: true,
} as const;

/**
 * Pro Plus: everything in Pro with higher limits, plus new premium features
 * (voice practice, slide-by-slide deck feedback) as they launch. Team members
 * get Pro Plus while their team is active.
 */
export const PRO_PLUS_PLAN = {
  id: "pro_plus",
  name: "Pro Plus",
  product: "pro_plus_monthly" as PaymentProduct,
  interval: "month",
  simulationsPerMonth: 100,
} as const;

/** Monthly allowances for each paid plan. */
export const PLAN_LIMITS: Record<PaidPlan, { name: string; simulationsPerMonth: number; decksPerMonth: number; rewritesPerDeck: number }> = {
  pro: { name: PRO_PLAN.name, simulationsPerMonth: PRO_PLAN.simulationsPerMonth, decksPerMonth: 3, rewritesPerDeck: 30 },
  pro_plus: { name: PRO_PLUS_PLAN.name, simulationsPerMonth: PRO_PLUS_PLAN.simulationsPerMonth, decksPerMonth: 10, rewritesPerDeck: 100 },
};

/** The monthly subscription product for each paid plan, and back. */
export const PLAN_PRODUCTS: Record<PaidPlan, PaymentProduct> = { pro: "pro_monthly", pro_plus: "pro_plus_monthly" };
export function planOfProduct(product: PaymentProduct): PaidPlan | null {
  return product === "pro_monthly" ? "pro" : product === "pro_plus_monthly" ? "pro_plus" : null;
}

/** Teams are agreed and invoiced directly, not sold through checkout. */
export const TEAMS_PLAN = { name: "Teams", memberPlan: "pro_plus" as PaidPlan } as const;

export const CREDIT_PACKS = [
  { product: "credits_3" as PaymentProduct, name: "3 simulations", simulations: 3 },
  { product: "credits_10" as PaymentProduct, name: "10 simulations", simulations: 10 },
] as const;

/**
 * Pitch deck builder. Pro includes a few decks a month; anyone can buy one
 * deck at a time; everyone gets one free preview (the outline and the first
 * few slides) that a purchase or Pro later unlocks without regenerating.
 */
export const DECK_BUILDER = {
  product: "deck_builder" as PaymentProduct,
  name: "Pitch deck",
  /** Pro's allowances; Pro Plus has more (PLAN_LIMITS). */
  proDecksPerMonth: 3,
  /** AI rewrites of single slides. Typing changes yourself is always free. */
  proRewritesPerDeck: 30,
  creditRewritesPerDeck: 2,
  previewSlides: 3,
  freePreviews: 1,
} as const;
