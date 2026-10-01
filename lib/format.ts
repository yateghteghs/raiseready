/**
 * Money formatting. Amounts are stored with their own currency code; Naira is
 * the default when none is given (spec section 9).
 */
export const DEFAULT_CURRENCY = "NGN";

export function formatMoney(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  options: { compact?: boolean } = {},
): string {
  const code = currency.toUpperCase();
  const formatter = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: code,
    currencyDisplay: "narrowSymbol",
    notation: options.compact ? "compact" : "standard",
    minimumFractionDigits: options.compact || Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: options.compact ? 1 : Number.isInteger(amount) ? 0 : 2,
  });
  return formatter.format(amount);
}

/** Paystack amounts are in kobo (1/100 of a Naira). */
export function koboToNaira(kobo: number): number {
  return kobo / 100;
}
