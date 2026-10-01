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

export function revenueSummary(payments: { amount_kobo: number; product: string; status: string; created_at: string }[], monthStartIso: string) {
  const paid = payments.filter((p) => p.status === "success");
  const sum = (rows: typeof paid) => rows.reduce((s, p) => s + p.amount_kobo, 0);
  return {
    allTimeKobo: sum(paid),
    thisMonthKobo: sum(paid.filter((p) => p.created_at >= monthStartIso)),
    byProduct: ["pro_monthly", "credits_3", "credits_10"].map((product) => {
      const rows = paid.filter((p) => p.product === product);
      return { product, count: rows.length, kobo: sum(rows) };
    }),
  };
}
