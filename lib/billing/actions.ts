"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { PaystackError } from "@/lib/billing/paystack";
import { isCurrency } from "@/lib/billing/prices";
import { BillingError, manageSubscriptionLink, quote, startCheckout } from "@/lib/billing/service";
import type { PaymentProduct } from "@/lib/supabase/database.types";
import { getSiteUrl } from "@/lib/site-url";

const productSchema = z.enum(["pro_monthly", "pro_plus_monthly", "credits_3", "credits_10", "deck_builder"]);

const optionsSchema = z
  .object({ currency: z.enum(["NGN", "USD"]).optional(), code: z.string().max(40).optional() })
  .optional();

export async function checkoutAction(product: string, options?: { currency?: string; code?: string }): Promise<{ error: string } | void> {
  const parsed = productSchema.safeParse(product);
  const opts = optionsSchema.safeParse(options);
  if (!opts.success) return { error: "Something went wrong. Please try again." };
  if (!parsed.success) return { error: "Choose a plan or credit pack." };
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has ended. Please log in again." };

  let url: string;
  try {
    url = await startCheckout(user, parsed.data, `${await getSiteUrl()}/app/billing/callback`, opts.data ?? {});
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

export type CodePreview = { ok: true; prices: Partial<Record<PaymentProduct, { amount: number; list: number }>>; percentOff: number } | { ok: false; error: string };

/** Shows what each product would cost with a discount code, before paying. */
export async function checkCodeAction(code: string, currency: string): Promise<CodePreview> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session has ended. Please log in again." };
  if (typeof code !== "string" || !code.trim() || code.length > 40) return { ok: false, error: "Enter a code." };
  if (!isCurrency(currency)) return { ok: false, error: "Something went wrong. Please try again." };
  const prices: Extract<CodePreview, { ok: true }>["prices"] = {};
  let percentOff = 0;
  let firstError: string | null = null;
  for (const product of productSchema.options) {
    try {
      const q = await quote(user.id, product, currency, code);
      prices[product] = { amount: q.amount, list: q.list };
      percentOff = Math.max(percentOff, q.percentOff);
    } catch (error) {
      if (!(error instanceof BillingError)) throw error;
      firstError ??= error.message;
    }
  }
  if (!Object.keys(prices).length) return { ok: false, error: firstError ?? "That code isn't valid." };
  return { ok: true, prices, percentOff };
}
