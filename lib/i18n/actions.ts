"use server";

import { cookies } from "next/headers";

import { CONSENT_COOKIE, preferenceMaxAge } from "@/lib/consent";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";

/** Remembers the visitor's language (for a year with cookie consent, else for the visit). The page re-renders in it. */
export async function setLocaleAction(formData: FormData): Promise<void> {
  const locale = formData.get("locale");
  if (!isLocale(locale)) return;
  const jar = await cookies();
  const maxAge = preferenceMaxAge(jar.get(CONSENT_COOKIE)?.value, 365);
  jar.set(LOCALE_COOKIE, locale, { path: "/", ...(maxAge ? { maxAge } : {}), sameSite: "lax", secure: process.env.NODE_ENV === "production" });
}
