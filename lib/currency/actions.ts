"use server";

import { cookies } from "next/headers";

import { CURRENCY_COOKIE } from "@/lib/currency/server";

/** Remembers whether the visitor wants prices in naira or US dollars. */
export async function setCurrencyAction(currency: string): Promise<void> {
  if (currency !== "NGN" && currency !== "USD") return;
  (await cookies()).set(CURRENCY_COOKIE, currency, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
}
