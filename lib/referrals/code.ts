/** Cookie that remembers which invite link a visitor arrived through. */
export const REFERRAL_COOKIE = "rr_ref";
export const REFERRAL_COOKIE_DAYS = 30;

/** Invite codes: 8 characters, no 0/O or 1/I so they read cleanly. */
export const REFERRAL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function isReferralCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-HJ-NP-Z2-9]{8}$/.test(value);
}
