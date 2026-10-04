"use server";

import { cookies } from "next/headers";

import { CONSENT_COOKIE, CONSENT_DAYS, isConsent, PREFERENCE_COOKIES, preferenceMaxAge } from "@/lib/consent";

const base = { path: "/", sameSite: "lax" as const, secure: process.env.NODE_ENV === "production" };

/** Saves the visitor's choice and re-saves existing preference cookies to match it. */
export async function setConsentAction(choice: string): Promise<void> {
  if (!isConsent(choice)) return;
  const jar = await cookies();
  jar.set(CONSENT_COOKIE, choice, { ...base, maxAge: CONSENT_DAYS * 24 * 60 * 60 });
  for (const [name, days] of Object.entries(PREFERENCE_COOKIES)) {
    const current = jar.get(name);
    if (!current) continue;
    const maxAge = preferenceMaxAge(choice, days);
    // The invite cookie is read only by the server.
    jar.set(name, current.value, { ...base, ...(name === "rr_ref" ? { httpOnly: true } : {}), ...(maxAge ? { maxAge } : {}) });
  }
}

/** "Cookie settings": forget the choice so the notice shows again. */
export async function resetConsentAction(): Promise<void> {
  (await cookies()).delete(CONSENT_COOKIE);
}
