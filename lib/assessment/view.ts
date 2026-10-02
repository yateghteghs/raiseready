import type { Action, StoredDimensionScores, Strength, Weakness } from "@/lib/assessment/service";
import { bandFor, dimensionById } from "@/lib/scoring/rubric";
import type { Tables } from "@/lib/supabase/database.types";

/** Typed, display-ready view of a stored assessment row. */
export function assessmentView(row: Tables<"assessments">) {
  const stored = row.dimension_scores as unknown as StoredDimensionScores;
  return {
    id: row.id,
    score: row.overall_score,
    band: bandFor(row.overall_score),
    createdAt: row.created_at,
    rubricVersion: row.rubric_version,
    dimensions: stored?.dimensions ?? [],
    strengths: (row.strengths as unknown as Strength[]) ?? [],
    weaknesses: (row.weaknesses as unknown as Weakness[]) ?? [],
    actions: (row.recommended_actions as unknown as Action[]) ?? [],
  };
}

export type AssessmentView = ReturnType<typeof assessmentView>;

const PERSONA_LABELS = { seed_vc: "Seed VC", angel: "Angel", grant_evaluator: "Grant Evaluator" } as const;

/** Which Investor Room session would help most, based on the biggest weakness. */
export function recommendedSimulation(view: AssessmentView) {
  const target = view.weaknesses[0] ?? null;
  const def = target ? dimensionById(target.dimension_id) : undefined;
  if (!target || !def) return null;
  return {
    personaId: def.practise.persona,
    difficultyId: target.score < 50 ? ("friendly" as const) : ("analytical" as const),
    persona: PERSONA_LABELS[def.practise.persona],
    focus: def.practise.focus,
    difficulty: target.score < 50 ? "Friendly" : "Analytical",
    reason: target.name,
  };
}
