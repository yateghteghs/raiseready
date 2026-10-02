import { z } from "zod";

import type { Staff } from "@/lib/admin/auth";
import { normaliseCode } from "@/lib/billing/prices";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PaymentProduct } from "@/lib/supabase/database.types";

export class DiscountCodeError extends Error {}

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const discountCodeSchema = z.object({
  code: z
    .string()
    .transform(normaliseCode)
    .pipe(z.string().regex(/^[A-Z0-9][A-Z0-9_-]{2,31}$/, { error: "Use 3–32 letters, digits, - or _." })),
  description: z.preprocess(blank, z.string().trim().max(200).optional()),
  percent_off: z.coerce.number({ error: "Enter a percentage." }).int().min(1, { error: "At least 1%." }).max(100, { error: "At most 100%." }),
  products: z
    .array(z.enum(["pro_monthly", "credits_3", "credits_10", "deck_builder"]))
    .min(1, { error: "Choose at least one product." }),
  max_redemptions: z.preprocess(blank, z.coerce.number().int().min(1, { error: "At least 1, or leave empty." }).optional()),
  expires_on: z.preprocess(blank, z.iso.date({ error: "Pick a date." }).optional()),
});

export type DiscountCodeInput = z.infer<typeof discountCodeSchema>;

export async function listDiscountCodes() {
  const admin = createAdminClient();
  const [codes, redemptions] = await Promise.all([
    admin.from("discount_codes").select("*").order("created_at", { ascending: false }).limit(200),
    admin.from("discount_redemptions").select("code_id").limit(20_000),
  ]);
  if (codes.error) throw new Error(`Could not load discount codes: ${codes.error.message}`);
  const used = new Map<string, number>();
  for (const r of redemptions.data ?? []) used.set(r.code_id, (used.get(r.code_id) ?? 0) + 1);
  const now = Date.now();
  return (codes.data ?? []).map((c) => {
    const uses = used.get(c.id) ?? 0;
    const status = !c.active
      ? "Off"
      : c.expires_at && Date.parse(c.expires_at) < now
        ? "Expired"
        : c.max_redemptions && uses >= c.max_redemptions
          ? "Used up"
          : "Active";
    return { ...c, used: uses, status };
  });
}

export async function createDiscountCode(staff: Staff, input: DiscountCodeInput): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("discount_codes")
    .insert({
      code: input.code,
      description: input.description ?? null,
      percent_off: input.percent_off,
      products: input.products as PaymentProduct[],
      max_redemptions: input.max_redemptions ?? null,
      // Valid to the end of that day in Lagos.
      expires_at: input.expires_on ? new Date(`${input.expires_on}T23:59:59+01:00`).toISOString() : null,
      created_by: staff.id,
    })
    .select("id")
    .single();
  if (error?.code === "23505") throw new DiscountCodeError("That code already exists.");
  if (error) throw new Error(`Could not create code: ${error.message}`);
  await admin.from("audit_logs").insert({
    actor_id: staff.id,
    action: "admin.discount_created",
    target_type: "discount_code",
    target_id: data.id,
    metadata: { code: input.code, percent_off: input.percent_off },
  });
}

export async function setDiscountCodeActive(staff: Staff, id: string, active: boolean): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("discount_codes").update({ active }).eq("id", id);
  if (error) throw new Error(`Could not update code: ${error.message}`);
  await admin.from("audit_logs").insert({
    actor_id: staff.id,
    action: active ? "admin.discount_enabled" : "admin.discount_disabled",
    target_type: "discount_code",
    target_id: id,
    metadata: {},
  });
}
