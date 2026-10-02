import { describe, expect, it } from "vitest";

import { activeUsers, assessmentInsights, dailyActive, funnel, redFlagCounts, revenueSummary, summariseAiCalls } from "@/lib/admin/aggregate";
import { isStaffProfile } from "@/lib/admin/auth";
import { estimateCostUsd } from "@/lib/ai/pricing";

describe("isStaffProfile", () => {
  it("only admits the admin role", () => {
    expect(isStaffProfile({ role: "admin", status: "active" })).toBe(true);
    expect(isStaffProfile({ role: "viewer", status: "active" })).toBe(true);
    expect(isStaffProfile({ role: "founder", status: "active" })).toBe(false);
    expect(isStaffProfile({ role: "admin", status: "suspended" })).toBe(false);
    expect(isStaffProfile(null)).toBe(false);
  });
});

describe("AI usage", () => {
  const call = (over: Record<string, unknown> = {}) => ({
    purpose: "extraction",
    model: "claude-opus-5-5",
    input_tokens: 100_000,
    output_tokens: 10_000,
    latency_ms: 30_000,
    success: true,
    created_at: "2026-10-01T10:00:00Z",
    user_id: "u1",
    ...over,
  });

  it("estimates cost from token counts and model prices", () => {
    expect(estimateCostUsd("claude-opus-5-5", 1_000_000, 100_000)).toBeCloseTo(6);
    expect(estimateCostUsd("some-future-model", 1, 1)).toBeNull();
  });

  it("totals calls, failures, tokens, latency and cost", () => {
    const s = summariseAiCalls([call(), call({ success: false, latency_ms: 10_000 }), call({ purpose: "assessment", model: "unknown" })]);
    expect(s.total).toMatchObject({ calls: 3, failures: 1, inputTokens: 300_000, outputTokens: 30_000, unpricedCalls: 1, avgLatencyMs: 23_333 });
    expect(s.total.costUsd).toBeCloseTo(1.2);
    expect(s.byPurpose.map((p) => p.key)).toEqual(["extraction", "assessment"]);
    expect(s.byDay).toHaveLength(1);
  });
});

describe("insights", () => {
  it("counts weak dimensions and the indicators most often missing, without any founder text", () => {
    const a = (traction: number, ratings: Record<string, "met" | "not_met">) => ({
      dimensions: [
        { id: "traction", score: traction, indicators: Object.entries(ratings).map(([id, rating]) => ({ id, rating })) },
        { id: "team", score: 90, indicators: [] },
      ],
    });
    const result = assessmentInsights([a(40, { traction_revenue: "not_met", traction_users: "met" }), a(80, { traction_revenue: "not_met", traction_users: "not_met" })]);
    expect(result.dimensions[0]).toMatchObject({ id: "traction", weak: 1, average: 60, assessed: 2 });
    expect(result.indicators[0]).toMatchObject({ id: "traction_revenue", notMet: 2, rate: 1, label: "Revenue with period" });
    expect(JSON.stringify(result)).not.toMatch(/reason|quote|summary/);
  });

  it("counts red flags by type and severity", () => {
    const counts = redFlagCounts([
      { type: "contradiction", severity: "high" },
      { type: "contradiction", severity: "low" },
      { type: "weak_answer", severity: "medium" },
    ]);
    expect(counts[0]).toEqual({ type: "contradiction", total: 2, high: 1, medium: 0, low: 1 });
  });
});

describe("revenue", () => {
  it("counts only successful payments", () => {
    const r = revenueSummary(
      [
        { amount_kobo: 1_500_000, product: "pro_monthly", status: "success", created_at: "2026-10-02T00:00:00Z" },
        { amount_kobo: 500_000, product: "credits_3", status: "success", created_at: "2026-09-20T00:00:00Z" },
        { amount_kobo: 999, product: "credits_3", status: "failed", created_at: "2026-10-03T00:00:00Z" },
      ],
      "2026-09-30T23:00:00.000Z",
    );
    expect(r).toMatchObject({ allTimeKobo: 2_000_000, thisMonthKobo: 1_500_000 });
    expect(r.byProduct.find((p) => p.product === "credits_3")).toEqual({ product: "credits_3", count: 1, kobo: 500_000 });
  });
});

describe("usage analytics", () => {
  const rows = [
    { user_id: "a", day: "2026-10-02" },
    { user_id: "b", day: "2026-10-02" },
    { user_id: "a", day: "2026-09-30" },
    { user_id: "c", day: "2026-09-26" },
    { user_id: "d", day: "2026-09-10" },
    { user_id: "e", day: "2026-08-01" },
  ];

  it("counts daily, weekly and monthly active founders", () => {
    expect(activeUsers(rows, "2026-10-02")).toEqual({ daily: 2, weekly: 3, monthly: 4 });
  });

  it("zero-fills a daily series, oldest first", () => {
    const series = dailyActive(rows, "2026-10-02", 3);
    expect(series).toEqual([
      { day: "2026-09-30", users: 1 },
      { day: "2026-10-01", users: 0 },
      { day: "2026-10-02", users: 2 },
    ]);
  });

  it("shows where founders drop off", () => {
    const f = funnel([
      { label: "Signed up", count: 100 },
      { label: "Onboarded", count: 80 },
      { label: "Deck analysed", count: 40 },
      { label: "Paid", count: 0 },
    ]);
    expect(f[1]).toMatchObject({ ofSignups: 0.8, fromPrevious: 0.8 });
    expect(f[2]).toMatchObject({ ofSignups: 0.4, fromPrevious: 0.5 });
    expect(f[3]).toMatchObject({ ofSignups: 0, fromPrevious: 0 });
    expect(funnel([{ label: "Signed up", count: 0 }])[0].ofSignups).toBe(0);
  });
});
