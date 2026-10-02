import type { Currency, PriceTable } from "@/lib/billing/prices";
import { COUNTRY_CURRENCY } from "@/lib/currency/countries";

/** How much of each currency one US dollar buys (from Admin → Prices). */
export type FxRates = Record<string, number>;

/**
 * Which currency to show (and charge) prices in: naira for Nigeria, US
 * dollars elsewhere, or the visitor's own choice. Always naira while dollar
 * payments are off, because that's what they'd be charged.
 */
export function displayCurrency(input: {
  country: string | null;
  chosen: string | null | undefined;
  usdOn: boolean;
}): Currency {
  if (!input.usdOn) return "NGN";
  if (input.chosen === "NGN" || input.chosen === "USD") return input.chosen;
  return input.country === "NG" ? "NGN" : "USD";
}

/**
 * The currency to show an estimate in: the visitor's own when it differs from
 * the one they're charged in, or US dollars for anyone outside Nigeria who is
 * charged in naira.
 */
export function localCurrency(
  country: string | null,
  charged: Currency,
): string | null {
  const local = country ? COUNTRY_CURRENCY[country] : null;
  if (local && local !== charged) return local;
  return charged === "NGN" && country !== "NG" ? "USD" : null;
}

/** Rounds an estimate to two significant figures, so it doesn't look exact. */
function roughly(value: number): number {
  if (value < 10) return Math.round(value * 10) / 10;
  const scale = 10 ** (Math.floor(Math.log10(value)) - 1);
  return Math.round(value / scale) * scale;
}

/** An amount in the visitor's currency, from a price in the smallest unit, or null without rates. */
export function estimate(
  minor: number,
  from: Currency,
  to: string | null,
  rates: FxRates,
): number | null {
  if (!to) return null;
  const perUsd = to === "USD" ? 1 : rates[to];
  if (!perUsd) return null;
  const usd =
    from === "USD" ? minor / 100 : rates.NGN ? minor / 100 / rates.NGN : null;
  return usd === null ? null : roughly(usd * perUsd);
}

export function formatAmount(
  amount: number,
  currency: string,
  locale = "en",
): string {
  try {
    return new Intl.NumberFormat(locale === "en" ? "en-NG" : locale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 0,
      maximumFractionDigits: amount < 10 && !Number.isInteger(amount) ? 1 : 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en")}`;
  }
}

/** "₦15,000" or "$10", plus "≈ KSh 1,300" when the visitor's own currency differs and a rate is set. */
export function priceLabel(
  minor: number,
  ctx: {
    currency: Currency;
    local: string | null;
    rates: FxRates;
    locale?: string;
  },
): { price: string; approx: string | null } {
  const price = formatAmount(minor / 100, ctx.currency, ctx.locale);
  // Without a rate for their own currency, people paying in naira still get a dollar estimate.
  const targets = [
    ctx.local,
    ctx.currency === "NGN" && ctx.local && ctx.local !== "USD" ? "USD" : null,
  ];
  for (const to of targets) {
    const amount =
      minor > 0 && to ? estimate(minor, ctx.currency, to, ctx.rates) : null;
    if (amount !== null)
      return { price, approx: `≈ ${formatAmount(amount, to!, ctx.locale)}` };
  }
  return { price, approx: null };
}

export type PriceContext = {
  /** What the visitor is charged in. */
  currency: Currency;
  /**
   * What the headline prices are shown in, when different: US dollars for
   * visitors outside Nigeria while checkout is still in naira.
   */
  shown?: Currency;
  local: string | null;
  rates: FxRates;
  prices: PriceTable;
  usdOn: boolean;
};
