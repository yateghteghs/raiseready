import { createHmac, timingSafeEqual } from "node:crypto";

import { serverEnv } from "@/lib/env";
import { CURRENCY, PRO_PLAN } from "@/lib/billing/plans";

/** Minimal Paystack API client (https://paystack.com/docs/api). Server-only. */

const BASE_URL = "https://api.paystack.co";

export class PaystackError extends Error {}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const { PAYSTACK_SECRET_KEY } = serverEnv("PAYSTACK_SECRET_KEY");
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null;
  if (!res.ok || !json?.status) {
    throw new PaystackError(`Paystack ${method} ${path} failed (${res.status}): ${json?.message ?? "no message"}`);
  }
  return json.data as T;
}

export type PaystackCustomer = { email?: string; customer_code?: string };
export type PaystackTransaction = {
  id: number;
  status: string;
  reference: string;
  amount: number;
  currency: string;
  paid_at?: string | null;
  metadata?: Record<string, unknown> | string | null;
  customer?: PaystackCustomer;
  plan?: { plan_code?: string } | string | null;
};

export async function initializeTransaction(input: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, string>;
  planCode?: string;
}): Promise<{ authorization_url: string; reference: string }> {
  return call("POST", "/transaction/initialize", {
    email: input.email,
    amount: input.amountKobo,
    currency: CURRENCY,
    reference: input.reference,
    callback_url: input.callbackUrl,
    metadata: input.metadata,
    ...(input.planCode ? { plan: input.planCode } : {}),
  });
}

export async function verifyTransaction(reference: string): Promise<PaystackTransaction> {
  return call("GET", `/transaction/verify/${encodeURIComponent(reference)}`);
}

let cachedPlanCode: string | null = null;

/** The Paystack plan for Pro, found by name and price or created on first use. */
export async function ensureProPlan(): Promise<string> {
  if (cachedPlanCode) return cachedPlanCode;
  const name = "RaiseReady Pro";
  const plans = await call<{ plan_code: string; name: string; amount: number; interval: string; currency: string; is_deleted?: boolean }[]>(
    "GET",
    `/plan?perPage=100&interval=monthly&amount=${PRO_PLAN.priceKobo}`,
  );
  const existing = plans.find(
    (p) => p.name === name && p.amount === PRO_PLAN.priceKobo && p.currency === CURRENCY && !p.is_deleted,
  );
  if (existing) return (cachedPlanCode = existing.plan_code);
  const created = await call<{ plan_code: string }>("POST", "/plan", {
    name,
    interval: "monthly",
    amount: PRO_PLAN.priceKobo,
    currency: CURRENCY,
  });
  return (cachedPlanCode = created.plan_code);
}

/** A Paystack-hosted page where the customer can cancel or update their subscription. */
export async function subscriptionManageLink(subscriptionCode: string): Promise<string> {
  const data = await call<{ link: string }>("GET", `/subscription/${encodeURIComponent(subscriptionCode)}/manage/link`);
  return data.link;
}

/**
 * Stops a subscription from renewing. Paystack needs the subscription's email
 * token, so we fetch it first. Already-ended or non-renewing ones are left alone.
 */
export async function disableSubscription(subscriptionCode: string): Promise<void> {
  const sub = await call<{ status: string; email_token: string }>("GET", `/subscription/${encodeURIComponent(subscriptionCode)}`);
  if (["cancelled", "complete", "completed", "non-renewing"].includes(sub.status)) return;
  await call("POST", "/subscription/disable", { code: subscriptionCode, token: sub.email_token });
}

/** Checks the x-paystack-signature header: HMAC-SHA512 of the raw body with the secret key. */
export function isValidSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim().toLowerCase(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function planCodeOf(plan: PaystackTransaction["plan"]): string | null {
  if (!plan) return null;
  if (typeof plan === "string") return plan || null;
  return plan.plan_code ?? null;
}

export function metadataOf(tx: PaystackTransaction): Record<string, unknown> {
  if (!tx.metadata) return {};
  if (typeof tx.metadata === "string") {
    try {
      return JSON.parse(tx.metadata) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return tx.metadata;
}
