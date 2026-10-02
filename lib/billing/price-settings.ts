import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { Staff } from "@/lib/admin/auth";
import { CURRENCIES, DEFAULT_PRICES, PRICE_LIMITS, PRICED_PRODUCTS, type PriceTable } from "@/lib/billing/prices";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

/**
 * The live prices: the defaults in code, overridden by whatever super admins
 * have set. Never throws; falls back to the defaults if the database can't be
 * read, so pages and checkout keep working.
 */
export async function getPrices(): Promise<PriceTable> {
  const prices: PriceTable = { NGN: { ...DEFAULT_PRICES.NGN }, USD: { ...DEFAULT_PRICES.USD } };
  try {
    const { data, error } = await createAdminClient().from("price_settings").select("product, currency, amount");
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      if (row.currency in prices && row.product in prices[row.currency]) prices[row.currency][row.product] = row.amount;
    }
  } catch (error) {
    console.error(`[prices] using defaults: ${error instanceof Error ? error.message : error}`);
  }
  return prices;
}

/** Form fields are named like "NGN.pro_monthly" and hold whole naira or dollars. */
export const priceFormSchema = z.object(
  Object.fromEntries(
    CURRENCIES.flatMap((currency) =>
      PRICED_PRODUCTS.map((product) => [
        `${currency}.${product}`,
        z.coerce
          .number({ error: "Enter a whole number." })
          .int({ error: "Use a whole number, without kobo or cents." })
          .min(PRICE_LIMITS[currency].min / 100, { error: `At least ${currency === "NGN" ? "₦" : "$"}${PRICE_LIMITS[currency].min / 100}.` })
          .max(PRICE_LIMITS[currency].max / 100, { error: "That's too high." }),
      ]),
    ),
  ),
);

export function tableFromForm(values: Record<string, number>): PriceTable {
  const table: PriceTable = { NGN: { ...DEFAULT_PRICES.NGN }, USD: { ...DEFAULT_PRICES.USD } };
  for (const currency of CURRENCIES) for (const product of PRICED_PRODUCTS) table[currency][product] = values[`${currency}.${product}`] * 100;
  return table;
}

/** Saves every price, audit-logs what changed, and refreshes the price pages. */
export async function savePrices(staff: Staff, next: PriceTable): Promise<{ changed: number }> {
  const current = await getPrices();
  const changes = CURRENCIES.flatMap((currency) =>
    PRICED_PRODUCTS.filter((product) => current[currency][product] !== next[currency][product]).map((product) => ({
      product,
      currency,
      from: current[currency][product],
      to: next[currency][product],
    })),
  );
  if (!changes.length) return { changed: 0 };
  const admin = createAdminClient();
  const { error } = await admin.from("price_settings").upsert(
    changes.map((c) => ({ product: c.product, currency: c.currency, amount: c.to, updated_by: staff.id, updated_at: new Date().toISOString() })),
    { onConflict: "product,currency" },
  );
  if (error) throw new Error(`Could not save prices: ${error.message}`);
  await admin.from("audit_logs").insert({
    actor_id: staff.id,
    action: "admin.prices_changed",
    target_type: "price_settings",
    target_id: null,
    metadata: { changes } as unknown as Json,
  });
  for (const path of ["/", "/pricing", "/app/billing", "/admin/prices"]) revalidatePath(path);
  return { changed: changes.length };
}
