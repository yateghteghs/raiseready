import { createAdminClient } from "@/lib/supabase/admin";

export type AiCallRecord = {
  userId: string;
  purpose: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  success: boolean;
  error?: string | null;
};

/** Records one model call for cost tracking (spec 6.5). Never stores founder content. */
export async function logAiCall(record: AiCallRecord): Promise<void> {
  const { error } = await createAdminClient()
    .from("ai_calls")
    .insert({
      user_id: record.userId,
      purpose: record.purpose,
      model: record.model,
      input_tokens: record.inputTokens,
      output_tokens: record.outputTokens,
      latency_ms: record.latencyMs,
      success: record.success,
      error: record.error ? record.error.slice(0, 500) : null,
    });
  if (error) console.error(`[ai] failed to log AI call: ${error.message}`);
}

/** Per-user limits on AI work, counted from ai_calls. */
export const RATE_LIMITS: Record<string, { max: number; windowMinutes: number }> = {
  extraction: { max: 6, windowMinutes: 60 },
  assessment: { max: 6, windowMinutes: 60 },
  simulation_turn: { max: 80, windowMinutes: 60 },
  simulation_final: { max: 10, windowMinutes: 60 },
};

/** True when the user still has room under the limit for this purpose. */
export async function withinRateLimit(userId: string, purpose: string): Promise<boolean> {
  const limit = RATE_LIMITS[purpose];
  if (!limit) return true;
  const since = new Date(Date.now() - limit.windowMinutes * 60_000).toISOString();
  const { count, error } = await createAdminClient()
    .from("ai_calls")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("purpose", purpose)
    .gte("created_at", since);
  if (error) throw new Error(`Could not check rate limit: ${error.message}`);
  return (count ?? 0) < limit.max;
}
