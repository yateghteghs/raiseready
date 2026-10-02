import { unlockProgress } from "@/lib/billing/prices";
import { getReferralSettings } from "@/lib/billing/referral-settings";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

async function audit(action: string, targetId: string, metadata: Record<string, unknown>) {
  await createAdminClient()
    .from("audit_logs")
    .insert({ actor_id: null, action, target_type: "profile", target_id: targetId, metadata: metadata as Json });
}

/** What a founder has paid us in total, per currency (smallest units). Free (100%-off) purchases don't count. */
export async function amountSpent(userId: string): Promise<{ currency: string; amount: number }[]> {
  const { data } = await createAdminClient().from("payments").select("currency, amount_kobo").eq("user_id", userId).eq("status", "success");
  const totals = new Map<string, number>();
  for (const p of data ?? []) totals.set(p.currency, (totals.get(p.currency) ?? 0) + p.amount_kobo);
  return [...totals.entries()].map(([currency, amount]) => ({ currency, amount }));
}

/** Whether this founder's own spending has unlocked their referral credits. */
export async function hasUnlockedReferralCredits(userId: string): Promise<boolean> {
  const [spent, settings] = await Promise.all([amountSpent(userId), getReferralSettings()]);
  return unlockProgress(spent, settings) >= 1;
}

/**
 * Gives a founder any referral credits that were waiting for them to reach
 * the minimum spend. Safe to call any time: each locked reward is released
 * exactly once (the status check guards against double-granting).
 */
export async function releaseLockedRewards(userId: string): Promise<number> {
  const admin = createAdminClient();
  const { data: locked } = await admin.from("referral_rewards").select("id, credits").eq("referrer_id", userId).eq("status", "locked");
  if (!locked?.length || !(await hasUnlockedReferralCredits(userId))) return 0;
  let released = 0;
  for (const reward of locked) {
    const { data: flipped } = await admin
      .from("referral_rewards")
      .update({ status: "released", released_at: new Date().toISOString() })
      .eq("id", reward.id)
      .eq("status", "locked")
      .select("id");
    if (!flipped?.length) continue;
    const { error } = await admin.rpc("add_credits", { p_user_id: userId, p_amount: reward.credits });
    if (error) throw new Error(`Could not add referral credits: ${error.message}`);
    released += reward.credits;
  }
  if (released) await audit("billing.referral_released", userId, { credits: released });
  return released;
}

/** After the minimum changes, releases credits for every inviter who now qualifies. */
export async function releaseAllQualifying(): Promise<void> {
  const { data } = await createAdminClient().from("referral_rewards").select("referrer_id").eq("status", "locked").limit(5000);
  const referrers = [...new Set((data ?? []).map((r) => r.referrer_id).filter((id): id is string => Boolean(id)))];
  for (const id of referrers) await releaseLockedRewards(id);
}
