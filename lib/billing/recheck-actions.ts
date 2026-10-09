"use server";

import { revalidatePath } from "next/cache";

import { getStaff } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import { recheckPayment } from "@/lib/billing/service";

const MESSAGES = {
  granted: "Paystack confirmed the payment. The purchase has been added and a receipt sent.",
  already_paid: "This payment is already marked as paid.",
  not_paid: "Paystack says this payment didn't go through, so nothing was added.",
  mismatch: "Paystack's amount doesn't match the price. Nothing was added. Check the payment in Paystack.",
  unknown: "No payment with that reference.",
} as const;

/** "Check with Paystack" on Admin → Payments. */
export async function recheckPaymentAction(reference: string): Promise<{ ok: boolean; message: string }> {
  const staff = await getStaff();
  if (!staff || !can(staff.profile.role, "grant_credits")) return { ok: false, message: "Only a super admin can do this." };
  try {
    const outcome = await recheckPayment(String(reference), staff.id);
    revalidatePath("/admin/payments");
    return { ok: outcome === "granted" || outcome === "already_paid", message: MESSAGES[outcome] };
  } catch (error) {
    console.error("[billing] recheck failed:", error);
    return { ok: false, message: "Couldn't reach Paystack. Try again in a minute." };
  }
}
