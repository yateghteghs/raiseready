import { bandFor, DIMENSIONS, RATING_POINTS, type BandId, type DimensionDef, type Rating } from "@/lib/scoring/rubric";

/**
 * Deterministic scoring (spec 6.2): the model only rates indicators; this code
 * turns ratings into dimension and overall scores. Integer arithmetic only, so
 * the same ratings always give exactly the same scores.
 */

export type DimensionScore = {
  id: string;
  name: string;
  weight: number;
  /** Share of the overall score after renormalising, in percent (1 decimal). */
  effectiveWeight: number;
  /** 0–100, or null when the dimension is not scored. */
  score: number | null;
  excludedReason: "needs_simulation" | "all_not_applicable" | null;
};

export type ScoreResult = { overall: number; band: BandId; dimensions: DimensionScore[] };

/** Rounds a / b to the nearest integer, halves rounding up. a, b ≥ 0, b > 0. */
function roundDiv(a: number, b: number): number {
  return Math.floor((2 * a + b) / (2 * b));
}

function scoreDimension(def: DimensionDef, ratings: Record<string, Rating>): number | null {
  let points = 0;
  let possible = 0;
  for (const indicator of def.indicators) {
    const rating = ratings[indicator.id] ?? "not_met";
    if (rating === "not_applicable") continue;
    points += RATING_POINTS[rating];
    possible += RATING_POINTS.met;
  }
  return possible === 0 ? null : roundDiv(100 * points, possible);
}

/**
 * @param ratings indicator id → rating. Missing indicators count as not_met.
 * @param hasSimulation whether the founder has completed a simulation; dimensions
 *   that need one are excluded (and the other weights renormalised) until then.
 */
export function computeScores(
  ratings: Record<string, Rating>,
  { hasSimulation }: { hasSimulation: boolean },
  dimensions: DimensionDef[] = DIMENSIONS,
): ScoreResult {
  const scored = dimensions.map((def) => {
    if (def.requiresSimulation && !hasSimulation) {
      return { def, score: null, excludedReason: "needs_simulation" as const };
    }
    const score = scoreDimension(def, ratings);
    return { def, score, excludedReason: score === null ? ("all_not_applicable" as const) : null };
  });

  const included = scored.filter((s) => s.score !== null);
  const totalWeight = included.reduce((sum, s) => sum + s.def.weight, 0);
  const weighted = included.reduce((sum, s) => sum + s.def.weight * (s.score as number), 0);
  const overall = totalWeight === 0 ? 0 : roundDiv(weighted, totalWeight);

  return {
    overall,
    band: bandFor(overall).id,
    dimensions: scored.map(({ def, score, excludedReason }) => ({
      id: def.id,
      name: def.name,
      weight: def.weight,
      effectiveWeight: score === null || totalWeight === 0 ? 0 : roundDiv(1000 * def.weight, totalWeight) / 10,
      score,
      excludedReason,
    })),
  };
}
