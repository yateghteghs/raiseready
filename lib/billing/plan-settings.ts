import { revalidatePath } from "next/cache";

import type { Staff } from "@/lib/admin/auth";
import { DEFAULT_PLAN_RULES, mergeRules, type PlanRule, type PlanRules } from "@/lib/billing/plan-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json, Plan } from "@/lib/supabase/database.types";

/** The live plan rules. Never throws; falls back to the defaults if the database can't be read. */
export async function getPlanRules(): Promise<PlanRules> {
  try {
    const { data, error } = await createAdminClient().from("plan_settings").select("plan, config");
    if (error) throw new Error(error.message);
    return mergeRules(data ?? []);
  } catch (error) {
    console.error(`[plans] using defaults: ${error instanceof Error ? error.message : error}`);
    return structuredClone(DEFAULT_PLAN_RULES);
  }
}

export async function savePlanRule(staff: Staff, plan: Plan, rule: PlanRule): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("plan_settings")
    .upsert({ plan, config: rule as unknown as Json, updated_by: staff.id, updated_at: new Date().toISOString() }, { onConflict: "plan" });
  if (error) throw new Error(`Could not save plan: ${error.message}`);
  await admin.from("audit_logs").insert({
    actor_id: staff.id,
    action: "admin.plan_changed",
    target_type: "plan_settings",
    target_id: null,
    metadata: { plan, rule } as unknown as Json,
  });
  for (const path of ["/", "/pricing", "/teams", "/app/billing", "/admin/plans"]) revalidatePath(path);
}
