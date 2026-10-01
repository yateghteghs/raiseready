import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { verifyTransaction } from "@/lib/billing/paystack";
import { applyChargeSuccess, transactionUserId } from "@/lib/billing/service";

/**
 * Where Paystack sends the founder after paying. Verifies the transaction with
 * Paystack directly (so the result can't be faked from the browser) and
 * applies it if the webhook hasn't already; both paths are idempotent.
 */
export async function GET(request: NextRequest) {
  const back = (status: string) => NextResponse.redirect(new URL(`/app/billing?payment=${status}`, request.url));
  const reference = request.nextUrl.searchParams.get("reference") ?? request.nextUrl.searchParams.get("trxref");
  const user = await getCurrentUser();
  if (!user || !reference) return back("unknown");

  try {
    const tx = await verifyTransaction(reference);
    if (transactionUserId(tx) !== user.id) return back("unknown");
    if (tx.status === "success") {
      await applyChargeSuccess(tx, { event: "verify", data: tx });
      return back("success");
    }
    return back(tx.status === "abandoned" ? "cancelled" : tx.status === "failed" ? "failed" : "pending");
  } catch (error) {
    console.error("[billing] verify failed:", error);
    return back("pending");
  }
}
