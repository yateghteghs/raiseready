"use server";

import { cookies } from "next/headers";

import { CONSENT_COOKIE, preferenceMaxAge } from "@/lib/consent";
import { CURRENCY_COOKIE } from "@/lib/currency/server";

/** Remembers whether the visitor wants prices in naira or US dollars. */
export async function setCurrencyAction(currency: string): Promise<void> {
  if (currency !== "NGN" && currency !== "USD") return;
  const jar = await cookies();
  const maxAge = preferenceMaxAge(jar.get(CONSENT_COOKIE)?.value, 365);
  jar.set(CURRENCY_COOKIE, currency, { path: "/", ...(maxAge ? { maxAge } : {}), sameSite: "lax", secure: process.env.NODE_ENV === "production" });
}
