/**
 * Plans, prices and limits (spec section 7). The single source of truth for
 * both the pricing page and server-side limit enforcement.
 * Amounts are in kobo (1/100 Naira), as Paystack expects.
 */

import { PRICES } from "@/lib/billing/prices";
import type { Difficulty, PaymentProduct, Persona } from "@/lib/supabase/database.types";

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
  priceKobo: PRICES.NGN.pro_monthly,
  interval: "month",
  assessments: Infinity,
  simulationsPerMonth: 30,
  personas: ["seed_vc", "angel", "grant_evaluator"] as Persona[],
  difficulties: ["friendly", "analytical", "tough"] as Difficulty[],
  pdfReports: true,
  progressTracking: true,
} as const;

export const CREDIT_PACKS = [
  { product: "credits_3" as PaymentProduct, name: "3 simulations", priceKobo: PRICES.NGN.credits_3, simulations: 3 },
  { product: "credits_10" as PaymentProduct, name: "10 simulations", priceKobo: PRICES.NGN.credits_10, simulations: 10 },
] as const;
