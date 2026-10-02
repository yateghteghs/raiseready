"use server";

import { getStaff } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import { priceFormSchema, savePrices, tableFromForm } from "@/lib/billing/price-settings";
import { formValues, validationFailed, type FormState } from "@/lib/forms";

export async function savePricesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await getStaff();
  if (!staff || !can(staff.profile.role, "manage_discounts")) return { status: "error", message: "Only a super admin can change prices." };
  const values = formValues(formData);
  const parsed = priceFormSchema.safeParse(values);
  if (!parsed.success) return validationFailed(parsed.error, values);
  try {
    const { changed } = await savePrices(staff, tableFromForm(parsed.data as Record<string, number>));
    return {
      status: "success",
      message: changed ? `Saved ${changed} price${changed === 1 ? "" : "s"}. New prices apply to new purchases from now on.` : "Nothing changed.",
    };
  } catch (error) {
    console.error("[prices] save failed:", error);
    return { status: "error", message: "Something went wrong. Prices weren't changed.", values };
  }
}
