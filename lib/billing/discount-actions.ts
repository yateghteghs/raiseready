"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getStaff } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import { createDiscountCode, DiscountCodeError, discountCodeSchema, setDiscountCodeActive } from "@/lib/billing/discount-codes";
import { formValues, validationFailed, type FormState } from "@/lib/forms";

async function manager() {
  const staff = await getStaff();
  return staff && can(staff.profile.role, "manage_discounts") ? staff : null;
}

export async function createDiscountCodeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await manager();
  if (!staff) return { status: "error", message: "Only a super admin can create discount codes." };
  const values = formValues(formData);
  const parsed = discountCodeSchema.safeParse({ ...values, products: formData.getAll("products") });
  if (!parsed.success) return validationFailed(parsed.error, values);
  try {
    await createDiscountCode(staff, parsed.data);
  } catch (error) {
    if (error instanceof DiscountCodeError) return { status: "error", message: error.message, values };
    console.error("[discounts] create failed:", error);
    return { status: "error", message: "Something went wrong. The code wasn't created.", values };
  }
  revalidatePath("/admin/discounts");
  return { status: "success", message: `${parsed.data.code} created. Founders can use it now.` };
}

export async function toggleDiscountCodeAction(id: string, active: boolean): Promise<void> {
  const staff = await manager();
  if (!staff || !z.uuid().safeParse(id).success) return;
  await setDiscountCodeActive(staff, id, active);
  revalidatePath("/admin/discounts");
}
