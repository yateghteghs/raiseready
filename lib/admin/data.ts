import { lagosDay, hashEmail } from "@/lib/activity/service";
import {
  activeUsers,
  assessmentInsights,
  dailyActive,
  funnel,
  redFlagCounts,
  revenueSummary,
  summariseAiCalls,
  type AiCallRow,
} from "@/lib/admin/aggregate";
import { lagosMonthStart } from "@/lib/billing/entitlements";
import { imageLinks } from "@/lib/images/service";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Admin data, read with the service role (spec 5: admins read all via the
 * service role on the server only). Callers must have passed requireStaff().
 */

const MAX_ROWS = 5000;

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

/** Row count from a head-only query. */
async function headCount(query: PromiseLike<{ count: number | null; error: { message: string } | null }>) {
  const { count, error } = await query;
  if (error) throw new Error(`Count failed: ${error.message}`);
  return count ?? 0;
}

/**
 * Rows from a query, or an error. Admin pages must never show "nothing yet"
 * when a query actually failed.
 */
function rowsOf<T>(result: { data: T[] | null; error: { message: string } | null }, what: string): T[] {
  if (result.error) throw new Error(`Could not load ${what}: ${result.error.message}`);
  return result.data ?? [];
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

  const avg = (rows: { overall_score: number | null }[]) => {
    const s = rows.map((r) => r.overall_score).filter((x): x is number => x !== null);
    return s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null;
  };

  return {
    users,
    users7,
    users30,
    onboardingRate: users ? onboarded / users : 0,
    startups,
    analysed,
    assessments: rowsOf(assessments, "assessments").length,
    avgAssessment: avg(rowsOf(assessments, "assessments")),
    simsStarted,
    simsCompleted: rowsOf(simsCompleted, "simulations").length,
    avgSimulation: avg(rowsOf(simsCompleted, "simulations")),
    pro,
    revenue: revenueSummary(rowsOf(payments, "payments"), lagosMonthStart().toISOString()),
    ai: summariseAiCalls(rowsOf(aiCalls, "AI calls") as AiCallRow[]).total,
  };
}

/** Rows per admin list page, and the most rows a CSV export holds. */
export const PAGE_SIZE = 50;
const EXPORT_MAX = 20_000;

export type Paging = { page: number } | { all: true };

function rangeOf(paging: Paging): [number, number] {
  if ("all" in paging) return [0, EXPORT_MAX - 1];
  const from = (Math.max(1, paging.page) - 1) * PAGE_SIZE;
  return [from, from + PAGE_SIZE - 1];
}

/** Users, newest first, with their email and startup. `q` searches email, name and startup name. */
export async function usersList(paging: Paging, q = "") {
  const admin = createAdminClient();
  const emails = await emailsById();
  const term = q.trim().toLowerCase().slice(0, 100);

  let ids: string[] | null = null;
  if (term) {
    const like = `%${term.replace(/[%_\\,()]/g, "")}%`;
    const [byName, byStartup] = await Promise.all([
      admin.from("profiles").select("id").ilike("full_name", like).limit(500),
      admin.from("startups").select("owner_id").ilike("name", like).limit(500),
    ]);
    const matches = new Set<string>([
      ...[...emails.entries()].filter(([, e]) => e.toLowerCase().includes(term)).map(([id]) => id),
      ...rowsOf(byName, "users").map((r) => r.id),
      ...rowsOf(byStartup, "startups").map((r) => r.owner_id),
    ]);
    ids = [...matches].slice(0, 500);
    if (!ids.length) return { rows: [], total: 0 };
  }

  const [from, to] = rangeOf(paging);
  let query = admin.from("profiles").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
  if (ids) query = query.in("id", ids);
  const profiles = await query;
  const rows = rowsOf(profiles, "users");
  const startups = rows.length
    ? rowsOf(await admin.from("startups").select("owner_id, name, stage, country").in("owner_id", rows.map((r) => r.id)), "startups")
    : [];
  const startupOf = new Map(startups.map((s) => [s.owner_id, s]));
  return {
    rows: rows.map((p) => ({ ...p, email: emails.get(p.id) ?? "", startup: startupOf.get(p.id) ?? null })),
    total: profiles.count ?? rows.length,
  };
}

export async function simulationsList(paging: Paging) {
  const admin = createAdminClient();
  const [from, to] = rangeOf(paging);
  const sims = await admin
    .from("simulations")
    .select("id, startup_id, persona, difficulty, mode, status, overall_score, investor_confidence, funded_by, started_at, ended_at", { count: "exact" })
    .order("started_at", { ascending: false })
    .range(from, to);
  const rows = rowsOf(sims, "simulations");
  const startupIds = [...new Set(rows.map((s) => s.startup_id))];
  const startups = startupIds.length ? rowsOf(await admin.from("startups").select("id, name").in("id", startupIds), "startups") : [];
  const name = new Map(startups.map((s) => [s.id, s.name]));
  return { rows: rows.map((s) => ({ ...s, startup: name.get(s.startup_id) ?? "Deleted" })), total: sims.count ?? rows.length };
}

export async function paymentsList(paging: Paging) {
  const admin = createAdminClient();
  const [from, to] = rangeOf(paging);
  const [payments, all, emails] = await Promise.all([
    admin
      .from("payments")
      .select("id, user_id, reference, amount_kobo, currency, product, status, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to),
    // Totals cover every payment, not just this page.
    admin.from("payments").select("amount_kobo, product, status, created_at").limit(EXPORT_MAX),
    emailsById(),
  ]);
  const rows = rowsOf(payments, "payments").map((p) => ({ ...p, email: emails.get(p.user_id) ?? "" }));
  return { rows, total: payments.count ?? rows.length, summary: revenueSummary(rowsOf(all, "payments"), lagosMonthStart().toISOString()) };
}

export async function aiUsage(days: number) {
  const admin = createAdminClient();
  const [calls, emails] = await Promise.all([
    admin.from("ai_calls").select("purpose, model, input_tokens, output_tokens, latency_ms, success, created_at, user_id").gte("created_at", daysAgo(days)).order("created_at", { ascending: false }).limit(MAX_ROWS * 4),
    emailsById(),
  ]);
  const rows = rowsOf(calls, "AI calls") as AiCallRow[];
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
  for (const a of rowsOf(assessments, "assessments")) {
    if (!latest.has(a.startup_id)) latest.set(a.startup_id, (a.dimension_scores ?? { dimensions: [] }) as { dimensions: never[] });
  }
  return {
    startups: latest.size,
    ...assessmentInsights([...latest.values()].map((d) => ({ dimensions: d.dimensions ?? [] }))),
    redFlags: redFlagCounts(rowsOf(flags, "red flags")),
    redFlagTotal: rowsOf(flags, "red flags").length,
  };
}

/** Everything the admin user page shows about one user. Counts and metadata, not documents or answers. */
export async function userDetail(userId: string) {
  const admin = createAdminClient();
  const { data: profile, error } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw new Error(`Could not load user: ${error.message}`);
  if (!profile) return null;

  const [authUser, startups, payments, history] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("startups").select("id, owner_id, name, stage, industry, country, logo_path").eq("owner_id", userId),
    admin.from("payments").select("amount_kobo, status").eq("user_id", userId),
    admin.from("audit_logs").select("action, actor_id, metadata, created_at").eq("target_id", userId).order("created_at", { ascending: false }).limit(20),
  ]);
  const startupRows = rowsOf(startups, "startups");
  const startupIds = startupRows.map((s) => s.id);
  const count = (table: "documents" | "assessments" | "simulations") =>
    startupIds.length ? headCount(admin.from(table).select("id", { count: "exact", head: true }).in("startup_id", startupIds)) : Promise.resolve(0);
  const [documents, assessments, simulations] = await Promise.all([count("documents"), count("assessments"), count("simulations")]);

  const startup = startupRows[0] ?? null;
  const links = await imageLinks([
    { ownerId: userId, path: profile.avatar_path },
    { ownerId: userId, path: startup?.logo_path },
  ]);
  const historyRows = rowsOf(history, "history");
  const actorIds = [...new Set(historyRows.map((h) => h.actor_id).filter((id): id is string => Boolean(id)))];
  const actors = actorIds.length ? await emailsFor(actorIds) : new Map<string, string>();

  return {
    profile,
    email: authUser.data.user?.email ?? "",
    lastSignIn: authUser.data.user?.last_sign_in_at ?? null,
    startup,
    avatarUrl: profile.avatar_path ? (links[profile.avatar_path] ?? null) : null,
    logoUrl: startup?.logo_path ? (links[startup.logo_path] ?? null) : null,
    counts: {
      documents,
      assessments,
      simulations,
      paidKobo: rowsOf(payments, "payments").filter((p) => p.status === "success").reduce((s, p) => s + p.amount_kobo, 0),
    },
    history: historyRows.map((h) => ({ ...h, actor: h.actor_id ? (actors.get(h.actor_id) ?? "Staff") : "System or the user" })),
  };
}

async function emailsFor(ids: string[]): Promise<Map<string, string>> {
  const admin = createAdminClient();
  const results = await Promise.all(ids.map((id) => admin.auth.admin.getUserById(id)));
  return new Map(results.flatMap((r, i) => (r.data.user?.email ? [[ids[i], r.data.user.email] as const] : [])));
}

/** Active founders today/this week/this month, from activity days. */
export async function activeUserMetrics() {
  const today = lagosDay();
  const since = new Date(Date.parse(`${today}T00:00:00Z`) - 29 * 86_400_000).toISOString().slice(0, 10);
  const rows = rowsOf(
    await createAdminClient().from("user_activity_days").select("user_id, day").gte("day", since).limit(MAX_ROWS * 10),
    "activity",
  );
  return { ...activeUsers(rows, today), series: dailyActive(rows, today, 30) };
}

/** Usage analytics: activity, sign-ins, where founders drop off, and which features they use. */
export async function analytics() {
  const admin = createAdminClient();
  const since30 = daysAgo(30);
  const head = { count: "exact" as const, head: true };
  const [active, signIns, failedSignIns, users, onboarded, decks, profiles, assessments, sims, paid, aiCalls, reports] =
    await Promise.all([
      activeUserMetrics(),
      headCount(admin.from("sign_in_events").select("id", head).eq("succeeded", true).gte("created_at", since30)),
      headCount(admin.from("sign_in_events").select("id", head).eq("succeeded", false).gte("created_at", since30)),
      headCount(admin.from("profiles").select("id", head)),
      headCount(admin.from("profiles").select("id", head).eq("onboarding_complete", true)),
      admin.from("documents").select("startup_id").eq("kind", "pitch_deck").limit(MAX_ROWS * 4),
      admin.from("knowledge_profiles").select("startup_id").limit(MAX_ROWS * 4),
      admin.from("assessments").select("startup_id").limit(MAX_ROWS * 4),
      admin.from("simulations").select("startup_id, status, mode").limit(MAX_ROWS * 4),
      admin.from("payments").select("user_id").eq("status", "success").limit(MAX_ROWS * 4),
      admin.from("ai_calls").select("purpose, user_id").gte("created_at", since30).limit(MAX_ROWS * 4),
      headCount(admin.from("reports").select("id", head).gte("created_at", since30)),
    ]);
  const distinct = <T>(rows: T[], key: (r: T) => string | null) => new Set(rows.map(key).filter(Boolean)).size;
  const simRows = rowsOf(sims, "simulations").filter((s) => s.mode === "full");

  const steps = funnel([
    { label: "Signed up", count: users },
    { label: "Finished onboarding", count: onboarded },
    { label: "Uploaded a pitch deck", count: distinct(rowsOf(decks, "documents"), (d) => d.startup_id) },
    { label: "Deck analysed", count: distinct(rowsOf(profiles, "knowledge profiles"), (p) => p.startup_id) },
    { label: "Ran an assessment", count: distinct(rowsOf(assessments, "assessments"), (a) => a.startup_id) },
    { label: "Started a practice meeting", count: distinct(simRows, (s) => s.startup_id) },
    { label: "Finished a practice meeting", count: distinct(simRows.filter((s) => s.status === "completed"), (s) => s.startup_id) },
    { label: "Paid", count: distinct(rowsOf(paid, "payments"), (p) => p.user_id) },
  ]);

  const calls = rowsOf(aiCalls, "AI calls");
  const byPurpose = new Map<string, { uses: number; users: Set<string> }>();
  for (const c of calls) {
    const entry = byPurpose.get(c.purpose) ?? { uses: 0, users: new Set<string>() };
    entry.uses++;
    if (c.user_id) entry.users.add(c.user_id);
    byPurpose.set(c.purpose, entry);
  }
  const features = [...byPurpose.entries()]
    .map(([purpose, v]) => ({ purpose, uses: v.uses, founders: v.users.size }))
    .sort((a, b) => b.founders - a.founders || b.uses - a.uses);

  return { active, signIns, failedSignIns, funnel: steps, features, reports };
}

/** Sign-in history and activity for one user's admin page. */
export async function userActivity(userId: string, email: string) {
  const admin = createAdminClient();
  const since30 = daysAgo(30);
  const [history, failed, days] = await Promise.all([
    admin
      .from("sign_in_events")
      .select("succeeded, surface, failure_code, device, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    email
      ? headCount(
          admin.from("sign_in_events").select("id", { count: "exact", head: true }).eq("email_hash", hashEmail(email)).eq("succeeded", false).gte("created_at", since30),
        )
      : Promise.resolve(0),
    headCount(admin.from("user_activity_days").select("day", { count: "exact", head: true }).eq("user_id", userId).gte("day", since30.slice(0, 10))),
  ]);
  return { history: rowsOf(history, "sign-in history"), failedLast30: failed, activeDaysLast30: days };
}

/** Recent errors for the admin Errors page, optionally filtered by the reference shown to the user. */
export async function recentErrors(reference?: string) {
  let query = createAdminClient()
    .from("app_errors")
    .select("id, source, digest, message, path, route_type, user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (reference) query = query.eq("digest", reference);
  return rowsOf(await query, "errors");
}
