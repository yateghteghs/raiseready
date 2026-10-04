/**
 * Cookie consent. RaiseReady sets no advertising or tracking cookies; the
 * choice decides how long preferences are remembered:
 * - "all": language and currency for a year, an invite for 30 days;
 * - "essential": the same cookies, but only for the visit (no expiry date),
 *   so nothing is kept after the browser closes except sign-in.
 * The consent cookie itself is strictly necessary (it records the choice).
 */
export const CONSENT_COOKIE = "rr_consent";
export type Consent = "all" | "essential";

export const isConsent = (value: unknown): value is Consent => value === "all" || value === "essential";

/** `maxAge` (seconds) for a preference cookie: kept only with consent, otherwise for the visit. */
export function preferenceMaxAge(consent: string | undefined, days: number): number | undefined {
  return consent === "all" ? days * 24 * 60 * 60 : undefined;
}

export const CONSENT_DAYS = 365;
/** Preference cookies the choice applies to, and how long each is kept with consent. */
export const PREFERENCE_COOKIES: Record<string, number> = { rr_locale: 365, rr_currency: 365, rr_ref: 30 };
