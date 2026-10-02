import { z } from "zod";

import type { Staff } from "@/lib/admin/auth";
import type { FxRates } from "@/lib/currency/display";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

/** Exchange rates set by super admins. Never throws; no rates means no estimates. */
export async function getFxRates(): Promise<FxRates> {
  try {
    const { data, error } = await createAdminClient().from("fx_rates").select("currency, per_usd");
    if (error) throw new Error(error.message);
    return Object.fromEntries((data ?? []).map((r) => [r.currency, Number(r.per_usd)]));
  } catch (error) {
    console.error(`[fx] no exchange rates: ${error instanceof Error ? error.message : error}`);
    return {};
  }
}

export const fxRateSchema = z.object({
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, { error: "Use a three-letter currency code, e.g. KES." })
    .refine((c) => c !== "USD", { error: "Rates are per US dollar, so USD doesn't need one." }),
  per_usd: z.coerce.number({ error: "Enter a number." }).positive({ error: "Must be more than 0." }).max(1_000_000),
});

export async function saveFxRate(staff: Staff, input: z.infer<typeof fxRateSchema>): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("fx_rates")
    .upsert({ currency: input.currency, per_usd: input.per_usd, updated_by: staff.id, updated_at: new Date().toISOString() }, { onConflict: "currency" });
  if (error) throw new Error(`Could not save rate: ${error.message}`);
  await admin.from("audit_logs").insert({ actor_id: staff.id, action: "admin.fx_rate_set", target_type: "fx_rates", target_id: null, metadata: input as unknown as Json });
}

export async function deleteFxRate(staff: Staff, currency: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("fx_rates").delete().eq("currency", currency);
  await admin.from("audit_logs").insert({ actor_id: staff.id, action: "admin.fx_rate_removed", target_type: "fx_rates", target_id: null, metadata: { currency } });
}

export async function listFxRates() {
  const { data } = await createAdminClient().from("fx_rates").select("*").order("currency");
  return data ?? [];
}
