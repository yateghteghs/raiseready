import { PERSONAS, roundTitle } from "@/lib/ai/personas";
import { partialStringField } from "@/lib/ai/partial-json";
import {
  FINAL_EVALUATION_SYSTEM_PROMPT,
  investorSystemPrompt,
  profileBlock,
  SIMULATION_PROMPT_VERSION,
  transcriptBlock,
  turnInstructions,
  type TranscriptTurn,
} from "@/lib/ai/prompts/simulation.v1";
import {
  checkFinalEvaluation,
  checkTurnOutput,
  finalEvaluationSchema,
  turnOutputSchema,
  type FinalEvaluation,
  type RedFlagOutput,
  type TurnEvaluation,
} from "@/lib/ai/schemas/simulation";
import { AiCallError, callStructured } from "@/lib/ai/structured";
import { withinRateLimit } from "@/lib/ai/usage";
import { DOCUMENT_KINDS, type UploadableKind } from "@/lib/documents/rules";
import { simulationScore } from "@/lib/simulation/score";
import {
  allowedActions,
  deriveState,
  resolveAction,
  roundAfter,
  type NextAction,
} from "@/lib/simulation/state";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Difficulty, Json, Persona, Tables } from "@/lib/supabase/database.types";

export const TURN_PURPOSE = "simulation_turn";
export const FINAL_PURPOSE = "simulation_final";
export const MAX_ANSWER_CHARS = 4000;
const MAX_STARTS_PER_HOUR = 5;

export class SimulationError extends Error {}

export type RoomEvent =
  | { type: "delta"; text: string }
  | { type: "reset" }
  | {
      type: "done";
      founderTurn: Tables<"simulation_turns">;
      investorTurn: Tables<"simulation_turns">;
      redFlags: Tables<"red_flags">[];
      ended: boolean;
    }
  | { type: "error"; message: string };

/** Loads a simulation only if it belongs to this user's startup. */
export async function getOwnedSimulation(userId: string, simulationId: string) {
  const admin = createAdminClient();
  const { data: sim, error } = await admin.from("simulations").select("*").eq("id", simulationId).maybeSingle();
  if (error) throw new Error(`Could not load simulation: ${error.message}`);
  if (!sim) throw new SimulationError("Simulation not found.");
  const { data: startup } = await admin
    .from("startups")
    .select("*")
    .eq("id", sim.startup_id)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!startup) throw new SimulationError("Simulation not found.");
  return { sim, startup };
}

async function loadTurns(simulationId: string) {
  const { data, error } = await createAdminClient()
    .from("simulation_turns")
    .select("*")
    .eq("simulation_id", simulationId)
    .order("turn_index", { ascending: true });
  if (error) throw new Error(`Could not load turns: ${error.message}`);
  return data;
}

async function loadProfile(startupId: string) {
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("knowledge_profiles")
    .select("id, data, source_document_ids")
    .eq("startup_id", startupId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not load knowledge profile: ${error.message}`);
  if (!profile) throw new SimulationError("Analyse your documents first. The investor prepares from them.");

  const { data: docs } = await admin
    .from("documents")
    .select("id, kind")
    .in("id", profile.source_document_ids.length ? profile.source_document_ids : ["00000000-0000-0000-0000-000000000000"]);
  const { _meta: _ignored, ...data } = (profile.data ?? {}) as Record<string, unknown>;
  void _ignored;
  return {
    json: JSON.stringify(data, null, 1),
    documents: (docs ?? []).map((d) => ({ id: d.id, label: DOCUMENT_KINDS[d.kind as UploadableKind]?.label ?? "Document" })),
  };
}

/** Starts a new simulation with the persona's templated opening question. */
export async function startSimulation(
  userId: string,
  startup: Tables<"startups">,
  options: { persona: Persona; difficulty: Difficulty; fundingType: string | null },
): Promise<string> {
  await loadProfile(startup.id); // must have analysed documents
  const admin = createAdminClient();

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("simulations")
    .select("id", { count: "exact", head: true })
    .eq("startup_id", startup.id)
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_STARTS_PER_HOUR) {
    throw new SimulationError("You've started several simulations in the last hour. Please try again later.");
  }

  // One live session at a time: older unfinished ones are marked abandoned.
  await admin
    .from("simulations")
    .update({ status: "abandoned", ended_at: new Date().toISOString() })
    .eq("startup_id", startup.id)
    .eq("status", "active")
    .is("ended_at", null);

  const persona = PERSONAS[options.persona];
  const { data: sim, error } = await admin
    .from("simulations")
    .insert({
      startup_id: startup.id,
      persona: options.persona,
      difficulty: options.difficulty,
      funding_type: options.fundingType,
      current_round: persona.rounds[0],
    })
    .select("id")
    .single();
  if (error) throw new Error(`Could not start simulation: ${error.message}`);

  const { error: turnError } = await admin.from("simulation_turns").insert({
    simulation_id: sim.id,
    turn_index: 0,
    round: persona.rounds[0],
    role: "investor",
    content: persona.opening(startup.name),
  });
  if (turnError) throw new Error(`Could not start simulation: ${turnError.message}`);
  return sim.id;
}

/**
 * Handles one founder answer: saves it, asks the model for the investor's
 * response (streaming the message through `emit`), validates the chosen action
 * against the state machine, and records evaluation and red flags.
 * Returns true when the meeting has ended.
 */
export async function takeTurn(
  userId: string,
  simulationId: string,
  input: { answer: string; clarifiesRedFlagId: string | null },
  emit: (event: RoomEvent) => void,
): Promise<boolean> {
  const answer = input.answer.trim();
  if (!answer) throw new SimulationError("Type your answer first.");
  if (answer.length > MAX_ANSWER_CHARS) throw new SimulationError(`Keep answers under ${MAX_ANSWER_CHARS} characters.`);

  const { sim } = await getOwnedSimulation(userId, simulationId);
  if (sim.status !== "active" || sim.ended_at) throw new SimulationError("This session has finished.");

  const turns = await loadTurns(simulationId);
  const state = deriveState(sim.persona, sim.difficulty, turns);
  if (!state.awaitingFounder) throw new SimulationError("Wait for the investor's question.");
  if (!(await withinRateLimit(userId, TURN_PURPOSE))) {
    throw new SimulationError("You've sent a lot of answers in the last hour. Please take a break and try again later.");
  }

  const admin = createAdminClient();
  let clarifying: string | null = null;
  if (input.clarifiesRedFlagId) {
    const { data: flag } = await admin
      .from("red_flags")
      .select("description")
      .eq("id", input.clarifiesRedFlagId)
      .eq("simulation_id", simulationId)
      .maybeSingle();
    clarifying = flag?.description ?? null;
  }

  const founderIndex = (turns.at(-1)?.turn_index ?? -1) + 1;
  // The unique (simulation_id, turn_index) constraint stops double submissions.
  const { data: founderTurn, error: founderError } = await admin
    .from("simulation_turns")
    .insert({ simulation_id: simulationId, turn_index: founderIndex, round: state.round, role: "founder", content: answer })
    .select("*")
    .single();
  if (founderError) throw new SimulationError("That answer was already sent.");

  try {
    const profile = await loadProfile(sim.startup_id);
    const allowed = allowedActions(state);
    const transcript: TranscriptTurn[] = [...turns, founderTurn];
    const founderAnswers = new Map(transcript.filter((t) => t.role === "founder").map((t) => [t.turn_index, t.content]));

    let raw = "";
    let shown = "";
    const output = await callStructured({
      userId,
      purpose: TURN_PURPOSE,
      system: [
        { type: "text", text: investorSystemPrompt(sim.persona, sim.difficulty, sim.funding_type) },
        { type: "text", text: profileBlock(profile.json, profile.documents), cache_control: { type: "ephemeral" } },
      ],
      buildContent: (retryNote) => [
        { type: "text", text: transcriptBlock(sim.persona, transcript) },
        {
          type: "text",
          text: turnInstructions({ persona: sim.persona, state, allowed, currentTurnIndex: founderIndex, clarifying, retryNote }),
        },
      ],
      schema: turnOutputSchema(allowed),
      check: (o) =>
        checkTurnOutput(o, {
          currentTurnIndex: founderIndex,
          founderAnswers,
          documentIds: profile.documents.map((d) => d.id),
        }),
      effort: "medium",
      maxTokens: 16000,
      onTextDelta: (delta) => {
        raw += delta;
        const message = partialStringField(raw, "investor_message");
        if (message && message.length > shown.length) {
          emit({ type: "delta", text: message.slice(shown.length) });
          shown = message;
        }
      },
      onRetry: () => {
        raw = "";
        shown = "";
        emit({ type: "reset" });
      },
    });

    const action: NextAction = resolveAction(state, output.next_action);
    const ended = action === "end";
    const investorRound = roundAfter(state, action);

    const { data: updatedFounder, error: updateError } = await admin
      .from("simulation_turns")
      .update({
        evaluation: output.evaluation as unknown as Json,
        red_flags: output.red_flags as unknown as Json,
      })
      .eq("id", founderTurn.id)
      .select("*")
      .single();
    if (updateError) throw new Error(`Could not save evaluation: ${updateError.message}`);

    let redFlags: Tables<"red_flags">[] = [];
    if (output.red_flags.length) {
      const { data, error } = await admin
        .from("red_flags")
        .insert(
          output.red_flags.map((f: RedFlagOutput) => ({
            simulation_id: simulationId,
            turn_id: founderTurn.id,
            type: f.type,
            severity: f.severity,
            description: f.description,
            evidence: f.evidence as unknown as Json,
          })),
        )
        .select("*");
      if (error) throw new Error(`Could not save red flags: ${error.message}`);
      redFlags = data;
    }

    const { data: investorTurn, error: investorError } = await admin
      .from("simulation_turns")
      .insert({
        simulation_id: simulationId,
        turn_index: founderIndex + 1,
        round: investorRound,
        role: "investor",
        content: output.investor_message.trim(),
      })
      .select("*")
      .single();
    if (investorError) throw new Error(`Could not save investor turn: ${investorError.message}`);

    await admin
      .from("simulations")
      .update({ current_round: investorRound, ...(ended ? { ended_at: new Date().toISOString() } : {}) })
      .eq("id", simulationId);

    emit({ type: "done", founderTurn: updatedFounder, investorTurn, redFlags, ended });
    return ended;
  } catch (error) {
    // Let the founder resend the same answer.
    await admin.from("simulation_turns").delete().eq("id", founderTurn.id);
    if (error instanceof AiCallError) throw new SimulationError(error.userMessage);
    throw error;
  }
}

/**
 * Runs the end-of-meeting evaluation (spec 6.3) and completes the simulation.
 * The overall score is computed in code from the per-answer ratings and red
 * flags; the model provides confidence, strengths, weaknesses, the questions the
 * founder struggled with, and what to practise next.
 */
export async function finalizeSimulation(userId: string, simulationId: string): Promise<void> {
  const { sim } = await getOwnedSimulation(userId, simulationId);
  if (sim.status !== "active" || !sim.ended_at) return;

  const admin = createAdminClient();
  const turns = await loadTurns(simulationId);
  const { data: flags } = await admin.from("red_flags").select("*").eq("simulation_id", simulationId);
  const profile = await loadProfile(sim.startup_id);

  const evaluations = turns
    .filter((t) => t.role === "founder" && t.evaluation)
    .map((t) => t.evaluation as unknown as TurnEvaluation);
  const score = simulationScore(evaluations, (flags ?? []).map((f) => f.severity));

  const ratings = turns
    .filter((t) => t.role === "founder" && t.evaluation)
    .map((t) => {
      const e = t.evaluation as unknown as TurnEvaluation;
      return `turn ${t.turn_index}: clarity ${e.clarity}/10, evidence ${e.evidence}/10, consistency ${e.consistency}/10. ${e.notes}`;
    })
    .join("\n");
  const flagText = (flags ?? []).map((f) => `- ${f.severity} ${f.type}: ${f.description}`).join("\n") || "None.";

  let output: FinalEvaluation;
  try {
    output = await callStructured({
      userId,
      purpose: FINAL_PURPOSE,
      system: FINAL_EVALUATION_SYSTEM_PROMPT,
      buildContent: (retryNote) => [
        {
          type: "text",
          text: [
            profileBlock(profile.json, profile.documents),
            `Investor: ${PERSONAS[sim.persona].name}, difficulty ${sim.difficulty}.`,
            transcriptBlock(sim.persona, turns),
            `Per-answer ratings:\n${ratings}`,
            `Red flags raised:\n${flagText}`,
            "Write the end-of-meeting evaluation.",
            retryNote ? `Your previous answer was rejected for these reasons. Fix them:\n${retryNote}` : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
      schema: finalEvaluationSchema,
      check: (o) => checkFinalEvaluation(o, new Set(turns.filter((t) => t.role === "investor").map((t) => t.turn_index))),
      effort: "high",
    });
  } catch (error) {
    console.error("[simulation] final evaluation failed:", error);
    return; // stays ended-but-active; the room offers a retry
  }

  await admin
    .from("simulations")
    .update({
      status: "completed",
      overall_score: score,
      investor_confidence: output.investor_confidence,
      final_evaluation: { ...output, prompt_version: SIMULATION_PROMPT_VERSION } as unknown as Json,
    })
    .eq("id", simulationId)
    .eq("status", "active");
}

export async function abandonSimulation(userId: string, simulationId: string): Promise<void> {
  const { sim } = await getOwnedSimulation(userId, simulationId);
  if (sim.status !== "active" || sim.ended_at) return;
  await createAdminClient()
    .from("simulations")
    .update({ status: "abandoned", ended_at: new Date().toISOString() })
    .eq("id", simulationId);
}

export { roundTitle };
