import { assessmentInsights, redFlagCounts, revenueSummary, summariseAiCalls, type AiCallRow } from "@/lib/admin/aggregate";
import { lagosMonthStart } from "@/lib/billing/entitlements";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Admin data, read with the service role (spec 5: admins read all via the
 * service role on the server only). Callers must have passed requireAdmin().
 */

const MAX_ROWS = 5000;

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

/** Row count from a head-only query. */
async function headCount(query: PromiseLike<{ count: number | null; error: { message: string } | null }>) {
  const { count, error } = await query;
  if (error) throw new Error(`Count failed: ${error.message}`);
  return count ?? 0;
}

/** Email addresses for user ids, from Supabase Auth. */
export async function emailsById(): Promise<Map<string, string>> {
  const admin = createAdminClient();
  const map = new Map<string, string>();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Could not list users: ${error.message}`);
    for (const u of data.users) map.set(u.id, u.email ?? "");
    if (data.users.length < 1000) break;
  }
  return map;
}

export async function overviewMetrics() {
  const admin = createAdminClient();
  const head = { count: "exact" as const, head: true };
  const [users, users7, users30, onboarded, startups, analysed, assessments, simsStarted, simsCompleted, pro, payments, aiCalls] =
    await Promise.all([
      headCount(admin.from("profiles").select("id", head)),
      headCount(admin.from("profiles").select("id", head).gte("created_at", daysAgo(7))),
      headCount(admin.from("profiles").select("id", head).gte("created_at", daysAgo(30))),
      headCount(admin.from("profiles").select("id", head).eq("onboarding_complete", true)),
      headCount(admin.from("startups").select("id", head)),
      headCount(admin.from("knowledge_profiles").select("id", head)),
      admin.from("assessments").select("overall_score").limit(MAX_ROWS),
      headCount(admin.from("simulations").select("id", head).eq("mode", "full")),
      admin.from("simulations").select("overall_score").eq("mode", "full").eq("status", "completed").limit(MAX_ROWS),
      headCount(admin.from("profiles").select("id", head).eq("plan", "pro")),
      admin.from("payments").select("amount_kobo, product, status, created_at").limit(MAX_ROWS),
      admin
        .from("ai_calls")
        .select("purpose, model, input_tokens, output_tokens, latency_ms, success, created_at, user_id")
        .gte("created_at", daysAgo(30))
        .limit(MAX_ROWS),
    ]);

  const avg = (rows: { overall_score: number | null }[] | null) => {
    const s = (rows ?? []).map((r) => r.overall_score).filter((x): x is number => x !== null);
    return s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null;
  };

  return {
    users,
    users7,
    users30,
    onboardingRate: users ? onboarded / users : 0,
    startups,
    analysed,
    assessments: assessments.data?.length ?? 0,
    avgAssessment: avg(assessments.data),
    simsStarted,
    simsCompleted: simsCompleted.data?.length ?? 0,
    avgSimulation: avg(simsCompleted.data),
    pro,
    revenue: revenueSummary(payments.data ?? [], lagosMonthStart().toISOString()),
    ai: summariseAiCalls((aiCalls.data ?? []) as AiCallRow[]).total,
  };
}

export async function usersList() {
  const admin = createAdminClient();
  const [profiles, startups, emails] = await Promise.all([
    admin.from("profiles").select("*").order("created_at", { ascending: false }).limit(500),
    admin.from("startups").select("owner_id, name, stage, country").limit(MAX_ROWS),
    emailsById(),
  ]);
  const startupOf = new Map((startups.data ?? []).map((s) => [s.owner_id, s]));
  return (profiles.data ?? []).map((p) => ({ ...p, email: emails.get(p.id) ?? "", startup: startupOf.get(p.id) ?? null }));
}

export async function simulationsList() {
  const admin = createAdminClient();
  const [sims, startups] = await Promise.all([
    admin.from("simulations").select("id, startup_id, persona, difficulty, mode, status, overall_score, investor_confidence, funded_by, started_at, ended_at").order("started_at", { ascending: false }).limit(200),
    admin.from("startups").select("id, name").limit(MAX_ROWS),
  ]);
  const name = new Map((startups.data ?? []).map((s) => [s.id, s.name]));
  return (sims.data ?? []).map((s) => ({ ...s, startup: name.get(s.startup_id) ?? "Deleted" }));
}

export async function paymentsList() {
  const admin = createAdminClient();
  const [payments, emails] = await Promise.all([
    admin.from("payments").select("id, user_id, reference, amount_kobo, currency, product, status, created_at").order("created_at", { ascending: false }).limit(500),
    emailsById(),
  ]);
  const rows = (payments.data ?? []).map((p) => ({ ...p, email: emails.get(p.user_id) ?? "" }));
  return { rows, summary: revenueSummary(rows, lagosMonthStart().toISOString()) };
}

export async function aiUsage(days: number) {
  const admin = createAdminClient();
  const [calls, emails] = await Promise.all([
    admin.from("ai_calls").select("purpose, model, input_tokens, output_tokens, latency_ms, success, created_at, user_id").gte("created_at", daysAgo(days)).order("created_at", { ascending: false }).limit(MAX_ROWS * 4),
    emailsById(),
  ]);
  const rows = (calls.data ?? []) as AiCallRow[];
  return { summary: summariseAiCalls(rows), emails, truncated: rows.length >= MAX_ROWS * 4 };
}

/** Aggregated weaknesses and red flags across all startups. Counts only. */
export async function insights() {
  const admin = createAdminClient();
  const [assessments, flags] = await Promise.all([
    admin.from("assessments").select("startup_id, created_at, dimension_scores").order("created_at", { ascending: false }).limit(MAX_ROWS),
    admin.from("red_flags").select("type, severity").limit(MAX_ROWS * 4),
  ]);
  // Latest assessment per startup only, so one founder re-running doesn't skew the picture.
  const latest = new Map<string, { dimensions: never[] }>();
  for (const a of assessments.data ?? []) {
    if (!latest.has(a.startup_id)) latest.set(a.startup_id, (a.dimension_scores ?? { dimensions: [] }) as { dimensions: never[] });
  }
  return {
    startups: latest.size,
    ...assessmentInsights([...latest.values()].map((d) => ({ dimensions: d.dimensions ?? [] }))),
    redFlags: redFlagCounts(flags.data ?? []),
    redFlagTotal: flags.data?.length ?? 0,
  };
}
