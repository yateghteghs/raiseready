import { createHash } from "node:crypto";

import { AiCallError, callStructured } from "@/lib/ai/structured";
import {
  ASSESSMENT_PROMPT_VERSION,
  ASSESSMENT_SYSTEM_PROMPT,
  buildAssessmentContent,
} from "@/lib/ai/prompts/assessment.v1";
import {
  assessmentOutputSchema,
  checkAssessmentOutput,
  type DimensionFeedback,
} from "@/lib/ai/schemas/assessment";
import { withinRateLimit } from "@/lib/ai/usage";
import { assessmentAccess } from "@/lib/billing/entitlements";
import { PlanLimitError } from "@/lib/billing/limits";
import { getUsage } from "@/lib/billing/service";
import { DIMENSIONS, RUBRIC_VERSION, WEAK_THRESHOLD, type Rating } from "@/lib/scoring/rubric";
import { computeScores, type DimensionScore } from "@/lib/scoring/score";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json, Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export const ASSESSMENT_PURPOSE = "assessment";

export class AssessmentError extends Error {}

export type IndicatorResult = { id: string; label: string; rating: Rating; reason: string };
export type DimensionResult = DimensionScore & { indicators: IndicatorResult[]; feedback: DimensionFeedback | null };

/** What is stored in assessments.dimension_scores. */
export type StoredDimensionScores = {
  input_hash: string;
  prompt_version: string;
  dimensions: DimensionResult[];
};

export type Strength = { dimension_id: string; name: string; score: number };
export type Weakness = Strength & { why_weak: string; investor_question: string };
export type Action = { dimension_id: string; name: string; action: string; potential_points: number };

/** Founder-entered fields that feed the assessment (timestamps and ids excluded). */
export function formFields(startup: Tables<"startups">) {
  const { id: _id, owner_id: _owner, created_at: _c, updated_at: _u, ...fields } = startup;
  void _id;
  void _owner;
  void _c;
  void _u;
  return fields;
}

/** Fingerprint of everything an assessment depends on. Same inputs, same hash. */
export function assessmentInputHash(input: {
  knowledgeProfileId: string;
  form: Record<string, unknown>;
  /** The latest completed simulation, which provides Communication/defence evidence. */
  simulationId: string | null;
}): string {
  const sortedForm = Object.fromEntries(Object.entries(input.form).sort(([a], [b]) => a.localeCompare(b)));
  return createHash("sha256")
    .update(
      JSON.stringify({
        rubric: RUBRIC_VERSION,
        prompt: ASSESSMENT_PROMPT_VERSION,
        profile: input.knowledgeProfileId,
        form: sortedForm,
        simulation: input.simulationId,
      }),
    )
    .digest("hex");
}

/** Turns scores plus feedback into ranked strengths, weaknesses and actions. */
export function summarise(dimensions: DimensionResult[]) {
  const scored = dimensions.filter((d): d is DimensionResult & { score: number } => d.score !== null);
  const strengths: Strength[] = scored
    .filter((d) => d.score >= WEAK_THRESHOLD)
    .sort((a, b) => b.score - a.score || b.weight - a.weight)
    .slice(0, 3)
    .map((d) => ({ dimension_id: d.id, name: d.name, score: d.score }));

  // Rank gaps by how many overall points closing them could add.
  const weak = scored
    .filter((d) => d.score < WEAK_THRESHOLD)
    .map((d) => ({ d, potential: Math.round((d.effectiveWeight * (100 - d.score)) / 100) }))
    .sort((a, b) => b.potential - a.potential || a.d.score - b.d.score);

  const weaknesses: Weakness[] = weak.map(({ d }) => ({
    dimension_id: d.id,
    name: d.name,
    score: d.score,
    why_weak: d.feedback?.why_weak ?? "",
    investor_question: d.feedback?.investor_question ?? "",
  }));
  const actions: Action[] = weak.slice(0, 5).map(({ d, potential }) => ({
    dimension_id: d.id,
    name: d.name,
    action: d.feedback?.fix ?? "",
    potential_points: potential,
  }));
  return { strengths, weaknesses, actions };
}

/** Evidence about how the founder defends their pitch, from their latest completed simulation. */
async function latestSimulationEvidence(startupId: string): Promise<{ id: string; text: string } | null> {
  const admin = createAdminClient();
  const { data: sim, error } = await admin
    .from("simulations")
    .select("id, persona, difficulty, overall_score, investor_confidence, final_evaluation")
    .eq("startup_id", startupId)
    .eq("status", "completed")
    .eq("mode", "full")
    .order("ended_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not load simulations: ${error.message}`);
  if (!sim) return null;

  const [{ data: turns }, { data: flags }] = await Promise.all([
    admin.from("simulation_turns").select("role, evaluation").eq("simulation_id", sim.id),
    admin.from("red_flags").select("type, severity, description").eq("simulation_id", sim.id),
  ]);
  const evals = (turns ?? [])
    .filter((t) => t.role === "founder" && t.evaluation)
    .map((t) => t.evaluation as { clarity: number; evidence: number; consistency: number });
  const avg = (k: "clarity" | "evidence" | "consistency") =>
    evals.length ? (evals.reduce((s, e) => s + e[k], 0) / evals.length).toFixed(1) : "n/a";
  const final = (sim.final_evaluation ?? {}) as { summary?: string; strengths?: string[]; weaknesses?: string[] };

  return {
    id: sim.id,
    text: [
      `Latest Investor Room session: ${sim.persona}, ${sim.difficulty}. Meeting score ${sim.overall_score}/100, investor confidence ${sim.investor_confidence}.`,
      `Average answer ratings (0-10): clarity ${avg("clarity")}, evidence ${avg("evidence")}, consistency ${avg("consistency")} over ${evals.length} answers.`,
      final.summary ? `Investor summary: ${final.summary}` : "",
      final.strengths?.length ? `Strengths: ${final.strengths.join("; ")}` : "",
      final.weaknesses?.length ? `Weaknesses: ${final.weaknesses.join("; ")}` : "",
      `Red flags raised: ${(flags ?? []).map((f) => `${f.severity} ${f.type}: ${f.description}`).join(" | ") || "none"}`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

/**
 * Runs (or reuses) the readiness assessment for a founder's startup. If nothing
 * the assessment depends on has changed since the latest one, that assessment
 * is returned as is: same inputs always give the same score, at no AI cost.
 */
export async function runAssessment(
  userId: string,
  startup: Tables<"startups">,
): Promise<{ assessment: Tables<"assessments">; reused: boolean }> {
  const admin = createAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("knowledge_profiles")
    .select("id, data")
    .eq("startup_id", startup.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (profileError) throw new Error(`Could not load knowledge profile: ${profileError.message}`);
  if (!profile) throw new AssessmentError("Analyse your documents first. The assessment uses what we find in them.");

  const simulation = await latestSimulationEvidence(startup.id);
  const hasSimulation = simulation !== null;
  const form = formFields(startup);
  const inputHash = assessmentInputHash({ knowledgeProfileId: profile.id, form, simulationId: simulation?.id ?? null });

  const { data: latest, error: latestError } = await admin
    .from("assessments")
    .select("*")
    .eq("startup_id", startup.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw new Error(`Could not load assessments: ${latestError.message}`);
  if (latest && (latest.dimension_scores as StoredDimensionScores | null)?.input_hash === inputHash) {
    return { assessment: latest, reused: true };
  }

  const access = assessmentAccess(await getUsage(userId, startup.id));
  if (!access.ok) throw new PlanLimitError(access.reason);

  if (!(await withinRateLimit(userId, ASSESSMENT_PURPOSE))) {
    throw new AssessmentError("You've run several assessments in the last hour. Please try again later.");
  }

  // Communication / defence is rated from Investor Room evidence; until the
  // founder completes a simulation it is excluded from the prompt and the score.
  const rated = DIMENSIONS.filter((d) => !d.requiresSimulation || hasSimulation);
  const { _meta: _ignored, ...profileData } = (profile.data ?? {}) as Record<string, unknown>;
  void _ignored;

  let output;
  try {
    output = await callStructured({
      userId,
      purpose: ASSESSMENT_PURPOSE,
      system: ASSESSMENT_SYSTEM_PROMPT,
      buildContent: (retryNote) =>
        buildAssessmentContent({
          profileJson: JSON.stringify(profileData, null, 1),
          formJson: JSON.stringify(form, null, 1),
          simulationSummary: simulation?.text ?? null,
          dimensions: rated,
          retryNote,
        }),
      schema: assessmentOutputSchema,
      check: (o) => checkAssessmentOutput(o, rated),
      effort: "high",
    });
  } catch (error) {
    if (error instanceof AiCallError) throw new AssessmentError(error.userMessage);
    throw error;
  }

  const ratings: Record<string, Rating> = {};
  const reasons: Record<string, string> = {};
  for (const d of output.dimensions) {
    for (const r of d.indicators) {
      ratings[r.indicator_id] = r.rating;
      reasons[r.indicator_id] = r.reason;
    }
  }
  const feedback = new Map(output.dimensions.map((d) => [d.dimension_id, d.feedback]));
  const scores = computeScores(ratings, { hasSimulation });

  const dimensions: DimensionResult[] = scores.dimensions.map((s) => {
    const def = DIMENSIONS.find((d) => d.id === s.id)!;
    return {
      ...s,
      indicators:
        s.excludedReason === "needs_simulation"
          ? []
          : def.indicators.map((i) => ({
              id: i.id,
              label: i.label,
              rating: ratings[i.id] ?? "not_met",
              reason: reasons[i.id] ?? "",
            })),
      feedback: feedback.get(s.id) ?? null,
    };
  });
  const { strengths, weaknesses, actions } = summarise(dimensions);
  const stored: StoredDimensionScores = { input_hash: inputHash, prompt_version: ASSESSMENT_PROMPT_VERSION, dimensions };

  const { data: assessment, error } = await admin
    .from("assessments")
    .insert({
      startup_id: startup.id,
      knowledge_profile_id: profile.id,
      overall_score: scores.overall,
      band: scores.band,
      dimension_scores: stored as unknown as Json,
      strengths: strengths as unknown as Json,
      weaknesses: weaknesses as unknown as Json,
      recommended_actions: actions as unknown as Json,
      rubric_version: RUBRIC_VERSION,
    })
    .select("*")
    .single();
  if (error) throw new Error(`Could not save assessment: ${error.message}`);
  return { assessment, reused: false };
}

/** The founder's assessments, newest first. Runs as the user (RLS applies). */
export async function listAssessments(startupId: string, limit = 20): Promise<Tables<"assessments">[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assessments")
    .select("*")
    .eq("startup_id", startupId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load assessments: ${error.message}`);
  return data;
}
