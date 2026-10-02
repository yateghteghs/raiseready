import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeDb } from "../../test/fake-supabase";

const fake = createFakeDb();
const db = fake.tables;
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fake.client }));
// The founder's own client: RLS would hide other founders' reports.
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const q = fake.client.from(table);
      return table === "reports" ? q.select("id").eq("startup_id", "s1") : q;
    },
  }),
}));
vi.mock("@/lib/images/service", () => ({ imageLink: async () => "https://signed.example/logo.png" }));

const { createShare, openShare, revokeShare, isShareToken, MAX_ACTIVE_SHARES } = await import("@/lib/reports/shares");

const content = {
  version: 1,
  generated_at: "2026-10-01T12:00:00Z",
  startup: { name: "Kolo", stage: "Seed", industry: "Logistics", country: "Nigeria" },
  readiness: { score: 60, band: "Getting there", assessed_at: "2026-10-01T10:00:00Z", rubric_version: "v1", dimensions: [{ name: "Traction", score: 60 }] },
  simulation: null,
  executive_summary: "Summary.",
  strengths: [],
  risks: [{ risk: "Runway", why_it_matters: "Investors ask." }],
  red_flags: [],
  questions_to_prepare: [{ question: "Q?", guidance: "G." }],
  next_steps: ["Do it."],
};

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  db.reports = [{ id: "r1", startup_id: "s1", content }];
  db.startups = [{ id: "s1", owner_id: "u1", logo_path: "u1/logo-1.png" }];
  db.profiles = [{ id: "u1", status: "active" }];
  db.report_shares = [];
});

describe("report share links", () => {
  it("creates a long random link and stores only its hash", async () => {
    const token = await createShare("u1", "r1", 30);
    expect(isShareToken(token)).toBe(true);
    expect(db.report_shares[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(db.report_shares)).not.toContain(token);
  });

  it("opens a live link and counts the view", async () => {
    const token = await createShare("u1", "r1", 7);
    const shared = await openShare(token);
    expect(shared?.content.startup.name).toBe("Kolo");
    expect(shared?.logoUrl).toContain("logo");
    expect(db.report_shares[0].views).toBe(1);
  });

  it("stops working when turned off, expired, or the founder is suspended", async () => {
    const token = await createShare("u1", "r1", 7);
    await revokeShare("u1", db.report_shares[0].id as string);
    expect(await openShare(token)).toBeNull();

    const token2 = await createShare("u1", "r1", 7);
    db.report_shares[1].expires_at = "2020-01-01T00:00:00Z";
    expect(await openShare(token2)).toBeNull();

    const token3 = await createShare("u1", "r1", 7);
    db.profiles[0].status = "suspended";
    expect(await openShare(token3)).toBeNull();
  });

  it("ignores guesses and malformed links", async () => {
    await createShare("u1", "r1", 7);
    expect(await openShare("A".repeat(32))).toBeNull();
    expect(await openShare("../../etc")).toBeNull();
  });

  it("refuses other founders' reports and too many live links", async () => {
    db.reports.push({ id: "r2", startup_id: "s2", content });
    await expect(createShare("u1", "r2", 7)).rejects.toThrow(/not found/);
    for (let i = 0; i < MAX_ACTIVE_SHARES; i++) await createShare("u1", "r1", 7);
    await expect(createShare("u1", "r1", 7)).rejects.toThrow(/live links/);
  });

  it("only lets the creator turn a link off", async () => {
    const token = await createShare("u1", "r1", 7);
    await revokeShare("someone-else", db.report_shares[0].id as string);
    expect(await openShare(token)).not.toBeNull();
  });
});
