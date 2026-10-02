/**
 * Prices per currency and discount maths. Amounts are in the currency's
 * smallest unit (kobo for NGN, cents for USD), as Paystack expects.
 *
 * USD is hidden until PAYSTACK_USD_ENABLED=true is set in Vercel, which should
 * happen only after Paystack approves USD for the business.
 */
import { formatMoney } from "@/lib/format";
import type { PaymentProduct } from "@/lib/supabase/database.types";

export type Currency = "NGN" | "USD";
export const CURRENCIES: Currency[] = ["NGN", "USD"];

export type PriceTable = Record<Currency, Record<PaymentProduct, number>>;

/**
 * Default prices. Super admins can change any of them under Admin → Prices
 * (stored in price_settings); load the live ones with getPrices().
 */
export const DEFAULT_PRICES: PriceTable = {
  NGN: { pro_monthly: 1_500_000, pro_plus_monthly: 3_500_000, credits_3: 500_000, credits_10: 1_000_000, deck_builder: 750_000 },
  // Placeholder dollar prices: confirm before switching USD on.
  USD: { pro_monthly: 1_000, pro_plus_monthly: 2_500, credits_3: 400, credits_10: 700, deck_builder: 500 },
};

/** Smallest charge Paystack accepts comfortably; discounted prices never go below it (except 100% off). */
export const MIN_CHARGE: Record<Currency, number> = { NGN: 10_000, USD: 100 };

/**
 * Referral programme defaults. Super admins change the live values under
 * Admin → Discounts (stored in referral_settings); these apply until then.
 */
export const DEFAULT_REFERRAL = {
  enabled: true,
  /** Off the referred founder's first purchase, when no better code is used. */
  friendPercentOff: 10,
  /** Simulation credits for the referrer once the referred founder first pays. */
  referrerCredits: 2,
  /**
   * The inviter must have spent this much themselves before their referral
   * credits unlock (smallest units: ₦37,500 and $25). Spending in both
   * currencies counts proportionally. 0 in either means no minimum.
   */
  minSpendNgn: 3_750_000,
  minSpendUsd: 2_500,
};

export type ReferralSettings = typeof DEFAULT_REFERRAL;

export function usdEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.PAYSTACK_USD_ENABLED === "true";
}

export function availableCurrencies(env: Record<string, string | undefined> = process.env): Currency[] {
  return usdEnabled(env) ? ["NGN", "USD"] : ["NGN"];
}

export function isCurrency(value: unknown): value is Currency {
  return value === "NGN" || value === "USD";
}

export function priceOf(product: PaymentProduct, currency: Currency, prices: PriceTable): number {
  return prices[currency][product];
}

/** Every product, in the order admins and price lists show them. */
export const PRICED_PRODUCTS: PaymentProduct[] = ["pro_monthly", "pro_plus_monthly", "credits_3", "credits_10", "deck_builder"];

/** Allowed range for a price, in the currency's smallest unit. */
export const PRICE_LIMITS: Record<Currency, { min: number; max: number }> = {
  NGN: { min: 10_000, max: 1_000_000_000 },
  USD: { min: 100, max: 1_000_000 },
};

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

/** The minimum spend in words, e.g. "₦37,500 (or $25)", or null if there isn't one. */
export function minimumSpendText(p: Pick<ReferralSettings, "minSpendNgn" | "minSpendUsd">, first: Currency = "NGN"): string | null {
  if (p.minSpendNgn <= 0 || p.minSpendUsd <= 0) return null;
  const ngn = formatMoney(p.minSpendNgn / 100, "NGN");
  const usd = formatMoney(p.minSpendUsd / 100, "USD");
  return first === "USD" ? `${usd} (or ${ngn})` : `${ngn} (or ${usd})`;
}

/** The invite card's description of the programme, e.g. "Founders who join … and you get …". */
export function inviteOfferText(p: ReferralSettings, first: Currency = "NGN"): string {
  const minimum = minimumSpendText(p, first);
  const unlock = minimum ? `, usable once you've spent ${minimum} on RaiseReady yourself` : "";
  const credits = `${p.referrerCredits} free simulation ${p.referrerCredits === 1 ? "credit" : "credits"}`;
  const friend = p.friendPercentOff > 0 ? `Founders who join with it get ${p.friendPercentOff}% off their first purchase` : "";
  if (friend && p.referrerCredits > 0) return `${friend}, and you get ${credits} when they first pay${unlock}.`;
  if (friend) return `${friend}.`;
  if (p.referrerCredits > 0) return `You get ${credits} when a founder who joins with it first pays${unlock}.`;
  return "";
}

/**
 * How far a founder's own spending is towards unlocking referral credits:
 * 1 or more means unlocked. Each currency counts as a share of its own
 * minimum, so ₦18,750 plus $12.50 is halfway plus halfway.
 */
export function unlockProgress(
  spent: { currency: string; amount: number }[],
  minimum: Pick<ReferralSettings, "minSpendNgn" | "minSpendUsd">,
): number {
  if (minimum.minSpendNgn <= 0 || minimum.minSpendUsd <= 0) return 1;
  let progress = 0;
  for (const s of spent) {
    if (s.amount <= 0) continue;
    if (s.currency === "USD") progress += s.amount / minimum.minSpendUsd;
    else progress += s.amount / minimum.minSpendNgn;
  }
  return progress;
}
