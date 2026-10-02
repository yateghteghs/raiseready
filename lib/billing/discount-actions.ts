"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getStaff } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import { createDiscountCode, DiscountCodeError, discountCodeSchema, setDiscountCodeActive } from "@/lib/billing/discount-codes";
import { referralSettingsSchema, saveReferralSettings } from "@/lib/billing/referral-settings";
import { releaseAllQualifying } from "@/lib/referrals/rewards";
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

export async function saveReferralSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await manager();
  if (!staff) return { status: "error", message: "Only a super admin can change the referral programme." };
  const values = formValues(formData);
  const parsed = referralSettingsSchema.safeParse(values);
  if (!parsed.success) return validationFailed(parsed.error, values);
  try {
    await saveReferralSettings(staff, parsed.data);
    // A lower minimum may unlock credits founders are already waiting for.
    await releaseAllQualifying();
  } catch (error) {
    console.error("[referrals] save failed:", error);
    return { status: "error", message: "Something went wrong. Nothing was saved.", values };
  }
  revalidatePath("/admin/discounts");
  revalidatePath("/app/billing");
  return {
    status: "success",
    message: parsed.data.enabled
      ? `Saved. Invited founders now get ${parsed.data.friend_percent_off}% off; inviters get ${parsed.data.referrer_credits} credits, usable once they've spent ₦${parsed.data.min_spend_naira.toLocaleString("en-NG")} (or $${parsed.data.min_spend_dollars}). Payments already started keep their price.`
      : "Saved. The referral programme is off: no new discounts or rewards.",
  };
}
