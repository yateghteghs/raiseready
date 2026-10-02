/**
 * Plans and products (spec section 7). What each plan includes is in
 * lib/billing/plan-rules.ts and prices in lib/billing/prices.ts; super admins
 * can change both in the admin area.
 */

import type { PaidPlan, PaymentProduct } from "@/lib/supabase/database.types";

export const PRO_PLAN = { id: "pro", name: "Pro", product: "pro_monthly" as PaymentProduct, interval: "month" } as const;

/**
 * Pro Plus: everything in Pro with higher limits, plus new premium features
 * (voice practice, slide-by-slide deck feedback) as they launch. Team members
 * get Pro Plus while their team is active.
 */
export const PRO_PLUS_PLAN = { id: "pro_plus", name: "Pro Plus", product: "pro_plus_monthly" as PaymentProduct, interval: "month" } as const;

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
  /** AI rewrites of single slides on a bought deck (plans set their own). Typing changes is always free. */
  creditRewritesPerDeck: 2,
  previewSlides: 3,
  freePreviews: 1,
} as const;
