import { cookies, headers } from "next/headers";

import { getPrices } from "@/lib/billing/price-settings";
import { usdEnabled } from "@/lib/billing/prices";
import { countryCode } from "@/lib/currency/countries";
import { displayCurrency, localCurrency, type PriceContext } from "@/lib/currency/display";
import { getFxRates } from "@/lib/currency/fx";

export const CURRENCY_COOKIE = "rr_currency";

/**
 * Everything needed to show prices to this visitor: the live prices, the
 * currency they'll be charged in, and their local currency for estimates.
 * The country comes from their profile when known, otherwise from where
 * Vercel says the request came from.
 */
export async function getPriceContext(profileCountry?: string | null): Promise<PriceContext & { country: string | null }> {
  const [prices, rates, jar, head] = await Promise.all([getPrices(), getFxRates(), cookies(), headers()]);
  const country = countryCode(profileCountry) ?? countryCode(head.get("x-vercel-ip-country"));
  const usdOn = usdEnabled();
  const currency = displayCurrency({ country, chosen: jar.get(CURRENCY_COOKIE)?.value, usdOn });
  return { prices, rates, usdOn, currency, local: localCurrency(country, currency), country };
}
