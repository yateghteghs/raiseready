"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { PaystackError } from "@/lib/billing/paystack";
import { BillingError, manageSubscriptionLink, startCheckout } from "@/lib/billing/service";
import { getSiteUrl } from "@/lib/site-url";

const productSchema = z.enum(["pro_monthly", "credits_3", "credits_10"]);

export async function checkoutAction(product: string): Promise<{ error: string } | void> {
  const parsed = productSchema.safeParse(product);
  if (!parsed.success) return { error: "Choose a plan or credit pack." };
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has ended. Please log in again." };

  let url: string;
  try {
    url = await startCheckout(user, parsed.data, `${await getSiteUrl()}/app/billing/callback`);
  } catch (error) {
    if (error instanceof BillingError) return { error: error.message };
    console.error("[billing] checkout failed:", error);
    return {
      error:
        error instanceof PaystackError || (error instanceof Error && /PAYSTACK/.test(error.message))
          ? "Payments aren't available right now. Please try again later."
          : "Something went wrong. Please try again.",
    };
  }
  redirect(url);
}

export async function manageSubscriptionAction(): Promise<{ error: string } | void> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has ended. Please log in again." };
  let url: string;
  try {
    url = await manageSubscriptionLink(user.id);
  } catch (error) {
    if (error instanceof BillingError) return { error: error.message };
    console.error("[billing] manage link failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
  redirect(url);
}
