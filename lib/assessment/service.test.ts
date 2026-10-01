import { beforeEach, describe, expect, it, vi } from "vitest";

import { ALL_INDICATOR_IDS, DIMENSIONS } from "@/lib/scoring/rubric";

// ---- In-memory stand-in for the parts of the Supabase client the service uses.
type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};
let idCounter = 0;

function query(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let order: { col: string; asc: boolean } | null = null;
  let limitN: number | null = null;
  let head = false;
  let pendingInsert: Row | null = null;
  const rows = () => {
    let out = (db[table] ?? []).filter((r) => filters.every((f) => f(r)));
    if (order) {
      const { col, asc } = order;
      out = [...out].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (asc ? 1 : -1));
    }
    return limitN === null ? out : out.slice(0, limitN);
  };
  const builder = {
    select(_cols?: string, opts?: { head?: boolean }) {
      head = Boolean(opts?.head);
      return builder;
    },
    eq(col: string, v: unknown) {
      filters.push((r) => r[col] === v);
      return builder;
    },
    gte(col: string, v: string) {
      filters.push((r) => String(r[col]) >= v);
      return builder;
    },
    order(col: string, { ascending }: { ascending: boolean }) {
      order = { col, asc: ascending };
      return builder;
    },
    limit(n: number) {
      limitN = n;
      return builder;
    },
    insert(row: Row) {
      pendingInsert = {
        id: `row-${++idCounter}`,
        created_at: new Date(Date.UTC(2026, 9, 1, 0, 0, idCounter)).toISOString(),
        ...row,
      };
      (db[table] ??= []).push(pendingInsert);
      return builder;
    },
    async maybeSingle() {
      return { data: rows()[0] ?? null, error: null };
    },
    async single() {
      return { data: pendingInsert ?? rows()[0], error: null };
    },
    then(resolve: (v: unknown) => void) {
      const r = rows();
      resolve({ data: head ? null : r, count: r.length, error: null });
    },
  };
  return builder;
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: query }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: query }) }));
vi.mock("@/lib/ai/usage", () => ({ withinRateLimit: async () => true }));

// The model rates the first half of each dimension's indicators met, the rest not met.
const callStructured = vi.fn(async (opts: { check?: (o: unknown) => string[] }) => {
  const output = {
    dimensions: DIMENSIONS.filter((d) => !d.requiresSimulation).map((d) => ({
      dimension_id: d.id,
      indicators: d.indicators.map((i, n) => ({
        indicator_id: i.id,
        rating: n < d.indicators.length / 2 ? "met" : "not_met",
        reason: "Because.",
      })),
      feedback: { why_weak: "Gap.", investor_question: "Why?", fix: "Do X." },
    })),
  };
  expect(opts.check?.(output)).toEqual([]);
  return output;
});
vi.mock("@/lib/ai/structured", () => ({
  callStructured: (o: never) => callStructured(o),
  AiCallError: class extends Error {},
}));

const { assessmentInputHash, runAssessment, summarise } = await import("@/lib/assessment/service");

const startup = {
  id: "s1",
  owner_id: "u1",
  name: "PayLink",
  stage: "seed",
  raising: true,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
} as never;

describe("runAssessment", () => {
  beforeEach(() => {
    for (const k of Object.keys(db)) delete db[k];
    callStructured.mockClear();
    db.knowledge_profiles = [{ id: "kp1", startup_id: "s1", version: 1, data: { problem: null } }];
    db.simulations = [];
  });

  it("gives the same score when run twice on unchanged data, without a second AI call", async () => {
    const first = await runAssessment("u1", startup);
    const second = await runAssessment("u1", startup);
    expect(first.reused).toBe(false);
    expect(second.reused).toBe(true);
    expect(second.assessment.overall_score).toBe(first.assessment.overall_score);
    expect(second.assessment.id).toBe(first.assessment.id);
    expect(callStructured).toHaveBeenCalledTimes(1);
    expect(db.assessments).toHaveLength(1);
  });

  it("computes the score in code from the ratings", async () => {
    const { assessment } = await runAssessment("u1", startup);
    // 5-indicator dimensions score 60 (3 of 5 met), 6-indicator ones 50 (3 of 6).
    // Weighted: (10*60 + 10*60 + 10*50 + 15*50 + 10*60 + 15*50 + 10*60 + 10*60 + 5*60) / 95 = 55.8 -> 56.
    expect(assessment.overall_score).toBe(56);
    expect(assessment.band).toBe("getting_there");
  });

  it("re-assesses when the documents are re-analysed", async () => {
    await runAssessment("u1", startup);
    db.knowledge_profiles.push({ id: "kp2", startup_id: "s1", version: 2, data: {} });
    const again = await runAssessment("u1", startup);
    expect(again.reused).toBe(false);
    expect(callStructured).toHaveBeenCalledTimes(2);
  });

  it("re-assesses when the founder edits the startup profile", async () => {
    await runAssessment("u1", startup);
    const again = await runAssessment("u1", { ...(startup as object), stage: "series_a" } as never);
    expect(again.reused).toBe(false);
  });

  it("refuses to run without analysed documents", async () => {
    db.knowledge_profiles = [];
    await expect(runAssessment("u1", startup)).rejects.toThrow(/Analyse your documents/);
  });
});

describe("assessmentInputHash", () => {
  it("ignores key order but not values", () => {
    const a = assessmentInputHash({ knowledgeProfileId: "kp", form: { a: 1, b: 2 }, hasSimulation: false });
    const b = assessmentInputHash({ knowledgeProfileId: "kp", form: { b: 2, a: 1 }, hasSimulation: false });
    const c = assessmentInputHash({ knowledgeProfileId: "kp", form: { a: 1, b: 3 }, hasSimulation: false });
    const d = assessmentInputHash({ knowledgeProfileId: "kp", form: { a: 1, b: 2 }, hasSimulation: true });
    expect(a).toBe(b);
    expect(new Set([a, c, d]).size).toBe(3);
  });
});

describe("summarise", () => {
  it("ranks weaknesses by how many points fixing them could add", () => {
    const dim = (id: string, score: number | null, effectiveWeight: number) =>
      ({ id, name: id, weight: effectiveWeight, effectiveWeight, score, excludedReason: null, indicators: [], feedback: { why_weak: `${id} gap`, investor_question: "?", fix: `fix ${id}` } }) as never;
    const { strengths, weaknesses, actions } = summarise([
      dim("traction", 40, 15.8),
      dim("team", 20, 10.5),
      dim("problem", 90, 10.5),
      dim("fundraising", 60, 5.3),
      dim("communication", null, 0),
    ]);
    expect(strengths.map((s) => s.dimension_id)).toEqual(["problem"]);
    expect(weaknesses.map((w) => w.dimension_id)).toEqual(["traction", "team", "fundraising"]);
    expect(actions[0]).toEqual({ dimension_id: "traction", name: "traction", action: "fix traction", potential_points: 9 });
  });
});

describe("rubric coverage", () => {
  it("has an indicator list the model can rate", () => {
    expect(ALL_INDICATOR_IDS.length).toBeGreaterThan(40);
  });
});
