import { estimateCostUsd } from "@/lib/ai/pricing";
import { DIMENSIONS, WEAK_THRESHOLD, type Rating } from "@/lib/scoring/rubric";

/**
 * Pure aggregations for the admin dashboard. They take rows already loaded on
 * the server and return counts and averages only, never founder text.
 */

export type AiCallRow = {
  purpose: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number | null;
  success: boolean;
  created_at: string;
  user_id: string | null;
};

type Bucket = { calls: number; failures: number; inputTokens: number; outputTokens: number; latencyTotal: number; latencyCount: number; costUsd: number; unpricedCalls: number };

const emptyBucket = (): Bucket => ({ calls: 0, failures: 0, inputTokens: 0, outputTokens: 0, latencyTotal: 0, latencyCount: 0, costUsd: 0, unpricedCalls: 0 });

function add(bucket: Bucket, c: AiCallRow) {
  bucket.calls++;
  if (!c.success) bucket.failures++;
  bucket.inputTokens += c.input_tokens;
  bucket.outputTokens += c.output_tokens;
  if (c.latency_ms !== null) {
    bucket.latencyTotal += c.latency_ms;
    bucket.latencyCount++;
  }
  const cost = estimateCostUsd(c.model, c.input_tokens, c.output_tokens);
  if (cost === null) bucket.unpricedCalls++;
  else bucket.costUsd += cost;
}

export type UsageSummary = Bucket & { key: string; avgLatencyMs: number | null; failureRate: number };

function finish(key: string, b: Bucket): UsageSummary {
  return {
    key,
    ...b,
    avgLatencyMs: b.latencyCount ? Math.round(b.latencyTotal / b.latencyCount) : null,
    failureRate: b.calls ? b.failures / b.calls : 0,
  };
}

function groupBy(calls: AiCallRow[], keyOf: (c: AiCallRow) => string): UsageSummary[] {
  const groups = new Map<string, Bucket>();
  for (const c of calls) {
    const key = keyOf(c);
    if (!groups.has(key)) groups.set(key, emptyBucket());
    add(groups.get(key)!, c);
  }
  return [...groups.entries()].map(([k, b]) => finish(k, b));
}

export function summariseAiCalls(calls: AiCallRow[]) {
  const total = emptyBucket();
  for (const c of calls) add(total, c);
  return {
    total: finish("total", total),
    byPurpose: groupBy(calls, (c) => c.purpose).sort((a, b) => b.costUsd - a.costUsd),
    byModel: groupBy(calls, (c) => c.model).sort((a, b) => b.calls - a.calls),
    byDay: groupBy(calls, (c) => c.created_at.slice(0, 10)).sort((a, b) => (a.key < b.key ? 1 : -1)),
    byUser: groupBy(calls, (c) => c.user_id ?? "deleted").sort((a, b) => b.costUsd - a.costUsd),
  };
}

type StoredDimension = { id: string; score: number | null; indicators?: { id: string; rating: Rating }[] };

/**
 * What startups most often lack, from each startup's latest assessment:
 * per-dimension weakness counts and averages, and the indicators most often
 * not met.
 */
export function assessmentInsights(latestPerStartup: { dimensions: StoredDimension[] }[]) {
  const dims = DIMENSIONS.map((def) => {
    const scores = latestPerStartup
      .map((a) => a.dimensions.find((d) => d.id === def.id)?.score)
      .filter((s): s is number => typeof s === "number");
    return {
      id: def.id,
      name: def.name,
      assessed: scores.length,
      weak: scores.filter((s) => s < WEAK_THRESHOLD).length,
      average: scores.length ? Math.round(scores.reduce((x, y) => x + y, 0) / scores.length) : null,
    };
  }).sort((a, b) => b.weak - a.weak || (a.average ?? 100) - (b.average ?? 100));

  const indicatorStats = new Map<string, { rated: number; notMet: number }>();
  for (const a of latestPerStartup) {
    for (const d of a.dimensions) {
      for (const i of d.indicators ?? []) {
        if (i.rating === "not_applicable") continue;
        const s = indicatorStats.get(i.id) ?? { rated: 0, notMet: 0 };
        s.rated++;
        if (i.rating === "not_met") s.notMet++;
        indicatorStats.set(i.id, s);
      }
    }
  }
  const labels = new Map(DIMENSIONS.flatMap((d) => d.indicators.map((i) => [i.id, { label: i.label, dimension: d.name }] as const)));
  const indicators = [...indicatorStats.entries()]
    .map(([id, s]) => ({ id, ...labels.get(id)!, rated: s.rated, notMet: s.notMet, rate: s.rated ? s.notMet / s.rated : 0 }))
    .filter((i) => i.label)
    .sort((a, b) => b.rate - a.rate || b.notMet - a.notMet);

  return { dimensions: dims, indicators };
}

export function redFlagCounts(flags: { type: string; severity: string }[]) {
  const types = ["contradiction", "unsupported_claim", "weak_answer", "missing_info"];
  return types.map((type) => {
    const ofType = flags.filter((f) => f.type === type);
    return {
      type,
      total: ofType.length,
      high: ofType.filter((f) => f.severity === "high").length,
      medium: ofType.filter((f) => f.severity === "medium").length,
      low: ofType.filter((f) => f.severity === "low").length,
    };
  });
}

/** Revenue in one currency (amounts in its smallest unit). Payments without a currency count as naira. */
export function revenueSummary(
  payments: { amount_kobo: number; product: string; status: string; created_at: string; currency?: string | null }[],
  monthStartIso: string,
  currency: "NGN" | "USD" = "NGN",
) {
  const paid = payments.filter((p) => p.status === "success" && (p.currency ?? "NGN") === currency);
  const sum = (rows: typeof paid) => rows.reduce((s, p) => s + p.amount_kobo, 0);
  return {
    allTimeKobo: sum(paid),
    thisMonthKobo: sum(paid.filter((p) => p.created_at >= monthStartIso)),
    byProduct: ["pro_monthly", "pro_plus_monthly", "credits_3", "credits_10", "deck_builder"].map((product) => {
      const rows = paid.filter((p) => p.product === product);
      return { product, count: rows.length, kobo: sum(rows) };
    }),
  };
}

/** Daily, weekly and monthly active founders from activity days ("YYYY-MM-DD"), counted back from `today`. */
export function activeUsers(rows: { user_id: string; day: string }[], today: string) {
  const t = Date.parse(`${today}T00:00:00Z`);
  const within = (n: number) =>
    new Set(rows.filter((r) => t - Date.parse(`${r.day}T00:00:00Z`) < n * 86_400_000 && r.day <= today).map((r) => r.user_id)).size;
  return { daily: within(1), weekly: within(7), monthly: within(30) };
}

/** Active founders per day for the last `days` days, oldest first, zero-filled. */
export function dailyActive(rows: { user_id: string; day: string }[], today: string, days = 30) {
  const t = Date.parse(`${today}T00:00:00Z`);
  const byDay = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!byDay.has(r.day)) byDay.set(r.day, new Set());
    byDay.get(r.day)!.add(r.user_id);
  }
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(t - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    return { day, users: byDay.get(day)?.size ?? 0 };
  });
}

/** Funnel steps with the share of sign-ups reaching each one and the drop from the step before. */
export function funnel(steps: { label: string; count: number }[]) {
  const top = steps[0]?.count ?? 0;
  return steps.map((s, i) => ({
    ...s,
    ofSignups: top ? s.count / top : 0,
    fromPrevious: i === 0 ? 1 : steps[i - 1].count ? s.count / steps[i - 1].count : 0,
  }));
}
