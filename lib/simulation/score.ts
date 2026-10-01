import type { Severity } from "@/lib/supabase/database.types";

/**
 * Overall simulation score, computed in code from per-answer ratings (each 0–10
 * for clarity, evidence and consistency) minus red-flag penalties.
 */
export const RED_FLAG_PENALTY: Record<Severity, number> = { low: 0, medium: 2, high: 5 };
export const MAX_RED_FLAG_PENALTY = 20;

export function simulationScore(
  evaluations: { clarity: number; evidence: number; consistency: number }[],
  redFlagSeverities: Severity[],
): number {
  if (evaluations.length === 0) return 0;
  const total = evaluations.reduce((sum, e) => sum + e.clarity + e.evidence + e.consistency, 0);
  // Average of the three ratings, as a percentage: total / (answers × 30) × 100.
  const base = Math.floor((2 * total * 100 + evaluations.length * 30) / (2 * evaluations.length * 30));
  const penalty = Math.min(
    MAX_RED_FLAG_PENALTY,
    redFlagSeverities.reduce((sum, s) => sum + RED_FLAG_PENALTY[s], 0),
  );
  return Math.max(0, Math.min(100, base - penalty));
}
