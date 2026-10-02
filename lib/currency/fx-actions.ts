"use server";

import { revalidatePath } from "next/cache";

import { getStaff } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import { deleteFxRate, fxRateSchema, saveFxRate } from "@/lib/currency/fx";
import { formValues, validationFailed, type FormState } from "@/lib/forms";

const PAGES = ["/", "/pricing", "/app/billing", "/admin/prices"];

export async function saveFxRateAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await getStaff();
  if (!staff || !can(staff.profile.role, "manage_discounts")) return { status: "error", message: "Only a super admin can change exchange rates." };
  const values = formValues(formData);
  const parsed = fxRateSchema.safeParse(values);
  if (!parsed.success) return validationFailed(parsed.error, values);
  try {
    await saveFxRate(staff, parsed.data);
  } catch (error) {
    console.error("[fx] save failed:", error);
    return { status: "error", message: "Something went wrong. The rate wasn't saved.", values };
  }
  for (const path of PAGES) revalidatePath(path);
  return { status: "success", message: `Saved: 1 US dollar = ${parsed.data.per_usd} ${parsed.data.currency}.` };
}

export async function deleteFxRateAction(currency: string): Promise<{ error?: string }> {
  const staff = await getStaff();
  if (!staff || !can(staff.profile.role, "manage_discounts")) return { error: "Only a super admin can change exchange rates." };
  if (!/^[A-Z]{3}$/.test(currency)) return { error: "Unknown currency." };
  await deleteFxRate(staff, currency);
  for (const path of PAGES) revalidatePath(path);
  return {};
}
