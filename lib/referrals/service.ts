import { randomInt } from "node:crypto";

import { isReferralCode, REFERRAL_ALPHABET as ALPHABET } from "@/lib/referrals/code";
import { createAdminClient } from "@/lib/supabase/admin";

export { isReferralCode, REFERRAL_COOKIE, REFERRAL_COOKIE_DAYS } from "@/lib/referrals/code";

function newCode(): string {
  return Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

/** The founder's invite code, created on first use. */
export async function ensureReferralCode(userId: string): Promise<string> {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("referral_code").eq("id", userId).maybeSingle();
  if (profile?.referral_code) return profile.referral_code;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    const { data, error } = await admin
      .from("profiles")
      .update({ referral_code: code })
      .eq("id", userId)
      .is("referral_code", null)
      .select("referral_code");
    if (!error && data?.length) return code;
    if (!error) {
      // Someone else set it first (e.g. two tabs): use theirs.
      const { data: again } = await admin.from("profiles").select("referral_code").eq("id", userId).maybeSingle();
      if (again?.referral_code) return again.referral_code;
    }
  }
  throw new Error("Could not create a referral code.");
}

/** Links a new founder to the founder whose invite link they used. Never throws. */
export async function linkReferral(newUserId: string, code: string): Promise<void> {
  if (!isReferralCode(code)) return;
  try {
    const admin = createAdminClient();
    const { data: referrer } = await admin.from("profiles").select("id").eq("referral_code", code).maybeSingle();
    if (!referrer || referrer.id === newUserId) return;
    await admin.from("profiles").update({ referred_by: referrer.id }).eq("id", newUserId).is("referred_by", null);
  } catch (error) {
    console.error("Could not link referral:", error);
  }
}

/** How a founder's invites are doing. */
export async function referralStats(userId: string) {
  const admin = createAdminClient();
  const [joined, rewards] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("referred_by", userId),
    admin.from("referral_rewards").select("credits").eq("referrer_id", userId),
  ]);
  const rows = rewards.data ?? [];
  return { joined: joined.count ?? 0, paid: rows.length, creditsEarned: rows.reduce((s, r) => s + r.credits, 0) };
}
