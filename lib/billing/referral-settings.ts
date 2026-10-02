import { z } from "zod";

import type { Staff } from "@/lib/admin/auth";
import { DEFAULT_REFERRAL, type ReferralSettings } from "@/lib/billing/prices";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The live referral programme. Falls back to the defaults if the settings row
 * can't be read, so checkout never fails over it.
 */
export async function getReferralSettings(): Promise<ReferralSettings> {
  try {
    const { data } = await createAdminClient()
      .from("referral_settings")
      .select("enabled, friend_percent_off, referrer_credits")
      .eq("id", 1)
      .maybeSingle();
    if (!data) return DEFAULT_REFERRAL;
    return { enabled: data.enabled, friendPercentOff: data.friend_percent_off, referrerCredits: data.referrer_credits };
  } catch {
    return DEFAULT_REFERRAL;
  }
}

export const referralSettingsSchema = z.object({
  enabled: z.preprocess((v) => v === "on", z.boolean()),
  friend_percent_off: z.coerce
    .number({ error: "Enter a percentage." })
    .int({ error: "Use a whole number." })
    .min(0, { error: "At least 0%." })
    .max(100, { error: "At most 100%." }),
  referrer_credits: z.coerce
    .number({ error: "Enter a number." })
    .int({ error: "Use a whole number." })
    .min(0, { error: "At least 0." })
    .max(50, { error: "At most 50." }),
});

export type ReferralSettingsInput = z.infer<typeof referralSettingsSchema>;

/** Saves the programme. Applies to checkouts and rewards from now on. */
export async function saveReferralSettings(staff: Staff, input: ReferralSettingsInput): Promise<void> {
  const admin = createAdminClient();
  const before = await getReferralSettings();
  const { error } = await admin.from("referral_settings").upsert({ id: 1, ...input, updated_by: staff.id });
  if (error) throw new Error(`Could not save referral settings: ${error.message}`);
  await admin.from("audit_logs").insert({
    actor_id: staff.id,
    action: "admin.referral_settings_updated",
    target_type: "settings",
    metadata: {
      before: { enabled: before.enabled, friend_percent_off: before.friendPercentOff, referrer_credits: before.referrerCredits },
      after: input,
    },
  });
}
