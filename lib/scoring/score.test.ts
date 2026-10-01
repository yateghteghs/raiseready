import { describe, expect, it } from "vitest";

import { ALL_INDICATOR_IDS, bandFor, DIMENSIONS, RUBRIC_VERSION, type Rating } from "@/lib/scoring/rubric";
import { computeScores } from "@/lib/scoring/score";

const all = (rating: Rating) => Object.fromEntries(ALL_INDICATOR_IDS.map((id) => [id, rating]));

describe("rubric", () => {
  it("has the spec's weights, summing to 100", () => {
    expect(DIMENSIONS.reduce((s, d) => s + d.weight, 0)).toBe(100);
    expect(Object.fromEntries(DIMENSIONS.map((d) => [d.id, d.weight]))).toEqual({
      problem: 10, solution: 10, market: 10, traction: 15, business_model: 10,
      financials: 15, competition: 10, team: 10, fundraising: 5, communication: 5,
    });
  });

  it("gives every dimension 4–6 indicators with unique ids", () => {
    for (const d of DIMENSIONS) expect(d.indicators.length).toBeGreaterThanOrEqual(4);
    for (const d of DIMENSIONS) expect(d.indicators.length).toBeLessThanOrEqual(6);
    expect(new Set(ALL_INDICATOR_IDS).size).toBe(ALL_INDICATOR_IDS.length);
  });

  it("has a version", () => {
    expect(RUBRIC_VERSION).toMatch(/v\d+$/);
  });
});

describe("bands", () => {
  it.each([
    [0, "not_ready"], [49, "not_ready"], [50, "getting_there"], [69, "getting_there"],
    [70, "nearly_ready"], [84, "nearly_ready"], [85, "investor_ready"], [100, "investor_ready"],
  ])("%i is %s", (score, band) => {
    expect(bandFor(score).id).toBe(band);
  });
});

describe("computeScores", () => {
  it("scores everything met as 100 and nothing met as 0", () => {
    expect(computeScores(all("met"), { hasSimulation: true }).overall).toBe(100);
    expect(computeScores(all("not_met"), { hasSimulation: true }).overall).toBe(0);
  });

  it("counts partial as half", () => {
    expect(computeScores(all("partial"), { hasSimulation: false }).overall).toBe(50);
  });

  it("is deterministic for the same ratings", () => {
    const ratings = Object.fromEntries(
      ALL_INDICATOR_IDS.map((id, i) => [id, (["met", "partial", "not_met", "not_applicable"] as Rating[])[i % 4]]),
    );
    const a = computeScores(ratings, { hasSimulation: false });
    const b = computeScores({ ...ratings }, { hasSimulation: false });
    expect(b).toEqual(a);
  });

  it("excludes Communication until a simulation and renormalises the rest", () => {
    const traction = DIMENSIONS.find((d) => d.id === "traction")!.indicators.map((i) => [i.id, "met"]);
    const ratings = { ...all("not_met"), ...(Object.fromEntries(traction) as Record<string, Rating>) };
    const result = computeScores(ratings, { hasSimulation: false });
    const comm = result.dimensions.find((d) => d.id === "communication")!;
    expect(comm).toMatchObject({ score: null, excludedReason: "needs_simulation", effectiveWeight: 0 });
    // Traction is 15 of the remaining 95 points: 15/95 = 15.8%, so overall rounds to 16.
    expect(result.overall).toBe(16);
    expect(result.dimensions.find((d) => d.id === "traction")!.effectiveWeight).toBe(15.8);
    const total = result.dimensions.reduce((s, d) => s + d.effectiveWeight, 0);
    expect(Math.round(total)).toBe(100);
  });

  it("includes Communication once a simulation exists", () => {
    const result = computeScores(all("met"), { hasSimulation: true });
    expect(result.dimensions.find((d) => d.id === "communication")!.score).toBe(100);
  });

  it("leaves not-applicable indicators out of a dimension", () => {
    const team = DIMENSIONS.find((d) => d.id === "team")!.indicators.map((i) => i.id);
    const ratings = { ...all("met"), [team[0]]: "not_met" as Rating, [team[4]]: "not_applicable" as Rating };
    // 3 of 4 applicable indicators met.
    expect(computeScores(ratings, { hasSimulation: false }).dimensions.find((d) => d.id === "team")!.score).toBe(75);
  });

  it("treats missing ratings as not met", () => {
    expect(computeScores({}, { hasSimulation: false }).overall).toBe(0);
  });

  it("excludes a dimension whose indicators are all not applicable", () => {
    const team = DIMENSIONS.find((d) => d.id === "team")!.indicators.map((i) => i.id);
    const ratings = { ...all("met"), ...(Object.fromEntries(team.map((id) => [id, "not_applicable"])) as Record<string, Rating>) };
    const result = computeScores(ratings, { hasSimulation: false });
    expect(result.dimensions.find((d) => d.id === "team")).toMatchObject({ score: null, excludedReason: "all_not_applicable" });
    expect(result.overall).toBe(100);
  });
});
