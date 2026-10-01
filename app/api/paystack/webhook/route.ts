import { isValidSignature } from "@/lib/billing/paystack";
import { handlePaystackEvent } from "@/lib/billing/service";

/**
 * Paystack webhook: the source of truth for payments (spec section 7).
 * The body is only trusted after its HMAC-SHA512 signature checks out.
 * Handling is idempotent, so Paystack's retries are safe.
 */
export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY ?? "";
  const raw = await request.text();
  if (!isValidSignature(raw, request.headers.get("x-paystack-signature"), secret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: { event?: string; data?: Record<string, unknown> };
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  try {
    await handlePaystackEvent(payload);
  } catch (error) {
    console.error(`[billing] webhook ${payload.event} failed:`, error);
    return new Response("Error", { status: 500 }); // Paystack will retry
  }
  return new Response("OK");
}
