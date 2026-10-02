/**
 * Prices per currency and discount maths. Amounts are in the currency's
 * smallest unit (kobo for NGN, cents for USD), as Paystack expects.
 *
 * USD is hidden until PAYSTACK_USD_ENABLED=true is set in Vercel, which should
 * happen only after Paystack approves USD for the business.
 */
import type { PaymentProduct } from "@/lib/supabase/database.types";

export type Currency = "NGN" | "USD";
export const CURRENCIES: Currency[] = ["NGN", "USD"];

export const PRICES: Record<Currency, Record<PaymentProduct, number>> = {
  NGN: { pro_monthly: 1_500_000, credits_3: 500_000, credits_10: 1_000_000 },
  // Placeholder dollar prices: confirm before switching USD on.
  USD: { pro_monthly: 1_000, credits_3: 400, credits_10: 700 },
};

/** Smallest charge Paystack accepts comfortably; discounted prices never go below it (except 100% off). */
export const MIN_CHARGE: Record<Currency, number> = { NGN: 10_000, USD: 100 };

/** Referral programme: what the new founder and the founder who invited them get. */
export const REFERRAL = {
  /** Off the referred founder's first purchase, when no better code is used. */
  friendPercentOff: 10,
  /** Simulation credits for the referrer once the referred founder first pays. */
  referrerCredits: 2,
} as const;

export function usdEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.PAYSTACK_USD_ENABLED === "true";
}

export function availableCurrencies(env: Record<string, string | undefined> = process.env): Currency[] {
  return usdEnabled(env) ? ["NGN", "USD"] : ["NGN"];
}

export function isCurrency(value: unknown): value is Currency {
  return value === "NGN" || value === "USD";
}

export function priceOf(product: PaymentProduct, currency: Currency): number {
  return PRICES[currency][product];
}

/** Price after a percentage discount, rounded to whole naira/dollars, never below the minimum charge unless free. */
export function discounted(list: number, percentOff: number, currency: Currency): { amount: number; discount: number } {
  if (percentOff <= 0) return { amount: list, discount: 0 };
  if (percentOff >= 100) return { amount: 0, discount: list };
  const raw = Math.round((list * (100 - percentOff)) / 100 / 100) * 100;
  const amount = Math.min(list, Math.max(MIN_CHARGE[currency], raw));
  return { amount, discount: list - amount };
}

export type DiscountCodeCheck = {
  active: boolean;
  percent_off: number;
  products: PaymentProduct[];
  max_redemptions: number | null;
  expires_at: string | null;
};

/** Why a code can't be used for this purchase, or null if it can. */
export function codeProblem(
  code: DiscountCodeCheck | null,
  input: { product: PaymentProduct; redemptions: number; usedByThisFounder: boolean; now?: number },
): string | null {
  if (!code || !code.active) return "That code isn't valid.";
  if (code.expires_at && Date.parse(code.expires_at) <= (input.now ?? Date.now())) return "That code has expired.";
  if (!code.products.includes(input.product)) return "That code doesn't apply to this purchase.";
  if (input.usedByThisFounder) return "You've already used that code.";
  if (code.max_redemptions !== null && input.redemptions >= code.max_redemptions) return "That code has been fully used.";
  return null;
}

/** Normalises what a founder types: trims, upper-cases, drops spaces. */
export function normaliseCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}
