import type { Currency, PriceTable } from "@/lib/billing/prices";
import { COUNTRY_CURRENCY } from "@/lib/currency/countries";

/** How much of each currency one US dollar buys (from Admin → Prices). */
export type FxRates = Record<string, number>;

/**
 * Which currency to show (and charge) prices in: naira for Nigeria, US
 * dollars elsewhere, or the visitor's own choice. Always naira while dollar
 * payments are off, because that's what they'd be charged.
 */
export function displayCurrency(input: { country: string | null; chosen: string | null | undefined; usdOn: boolean }): Currency {
  if (!input.usdOn) return "NGN";
  if (input.chosen === "NGN" || input.chosen === "USD") return input.chosen;
  return input.country === "NG" ? "NGN" : "USD";
}

/** The visitor's local currency when it isn't the one they're charged in. */
export function localCurrency(country: string | null, charged: Currency): string | null {
  const local = country ? COUNTRY_CURRENCY[country] : null;
  return local && local !== charged ? local : null;
}

/** Rounds an estimate to two significant figures, so it doesn't look exact. */
function roughly(value: number): number {
  if (value < 10) return Math.round(value * 10) / 10;
  const scale = 10 ** (Math.floor(Math.log10(value)) - 1);
  return Math.round(value / scale) * scale;
}

/** An amount in the visitor's currency, from a price in the smallest unit, or null without rates. */
export function estimate(minor: number, from: Currency, to: string | null, rates: FxRates): number | null {
  if (!to) return null;
  const perUsd = rates[to];
  if (!perUsd) return null;
  const usd = from === "USD" ? minor / 100 : rates.NGN ? minor / 100 / rates.NGN : null;
  return usd === null ? null : roughly(usd * perUsd);
}

export function formatAmount(amount: number, currency: string, locale = "en"): string {
  try {
    return new Intl.NumberFormat(locale === "en" ? "en-NG" : locale, { style: "currency", currency, maximumFractionDigits: amount < 10 ? 1 : 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en")}`;
  }
}

/** "₦15,000" or "$10", plus "≈ KSh 1,300" when the visitor's own currency differs and a rate is set. */
export function priceLabel(
  minor: number,
  ctx: { currency: Currency; local: string | null; rates: FxRates; locale?: string },
): { price: string; approx: string | null } {
  const price = formatAmount(minor / 100, ctx.currency, ctx.locale);
  const local = estimate(minor, ctx.currency, ctx.local, ctx.rates);
  return { price, approx: local === null ? null : `≈ ${formatAmount(local, ctx.local!, ctx.locale)}` };
}

export type PriceContext = { currency: Currency; local: string | null; rates: FxRates; prices: PriceTable; usdOn: boolean };
