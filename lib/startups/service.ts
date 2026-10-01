import { cache } from "react";

import { getCurrentUser } from "@/lib/auth/session";
import { DataLoadError } from "@/lib/data-errors";
import type { OnboardingInput, StartupInput } from "@/lib/startups/schema";
import { toStartupRow } from "@/lib/startups/schema";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

/**
 * The signed-in founder's startup. V1 supports one startup per founder; the
 * schema allows more, so we take the oldest.
 */
export const getMyStartup = cache(async (): Promise<Tables<"startups"> | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("startups")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new DataLoadError("startup", error.code || "unknown", error.message);
  return data;
});

/** Creates or updates the founder's startup. Runs as the user, so RLS applies. */
export async function saveMyStartup(userId: string, input: StartupInput): Promise<void> {
  const supabase = await createClient();
  const row = toStartupRow(input);

  const { data: existing, error: findError } = await supabase
    .from("startups")
    .select("id")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (findError) throw new Error(`Could not load startup: ${findError.message}`);

  const { error } = existing
    ? await supabase.from("startups").update(row).eq("id", existing.id)
    : await supabase.from("startups").insert({ ...row, owner_id: userId });
  if (error) throw new Error(`Could not save startup: ${error.message}`);
}

/** Saves onboarding answers and marks onboarding complete. */
export async function completeOnboarding(userId: string, input: OnboardingInput): Promise<void> {
  await saveMyStartup(userId, input);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: input.full_name, country: input.country, onboarding_complete: true })
    .eq("id", userId)
    .select("id");
  if (error) throw new Error(`Could not update profile: ${error.message}`);
  if (!data || data.length === 0) throw new Error("Profile not found for the signed-in user.");
}
