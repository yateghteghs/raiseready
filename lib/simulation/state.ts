import { DIFFICULTIES, PERSONAS } from "@/lib/ai/personas";
import type { Difficulty, Persona, TurnRole } from "@/lib/supabase/database.types";

/**
 * The Investor Room state machine (spec 6.3). The app, not the model, decides
 * which round comes next, how many follow-ups are allowed and when the session
 * ends. The model only chooses among the actions this allows.
 */

/** Hard cap on investor messages per simulation. */
export const MAX_INVESTOR_TURNS = 20;

export type NextAction = "follow_up" | "next_round" | "end";

export type TurnLike = { round: number; role: TurnRole };

export type RoomState = {
  /** Round currently being discussed. */
  round: number;
  /** Position of that round in the persona's plan (0-based) and plan length. */
  roundIndex: number;
  totalRounds: number;
  /** Follow-up questions already asked in the current round. */
  followUpsUsed: number;
  maxFollowUps: number;
  investorTurns: number;
  /** The round after this one, or null if this is the last. */
  nextRound: number | null;
  /** True when the investor is waiting for the founder's answer. */
  awaitingFounder: boolean;
};

export function deriveState(
  persona: Persona,
  difficulty: Difficulty,
  turns: TurnLike[],
): RoomState {
  const plan = PERSONAS[persona].rounds;
  const investorTurns = turns.filter((t) => t.role === "investor");
  const lastInvestor = investorTurns.at(-1);
  const round = lastInvestor?.round ?? plan[0];
  const roundIndex = Math.max(0, plan.indexOf(round));
  const inRound = investorTurns.filter((t) => t.round === round).length;
  const lastTurn = turns.filter((t) => t.role !== "system").at(-1);

  return {
    round,
    roundIndex,
    totalRounds: plan.length,
    followUpsUsed: Math.max(0, inRound - 1),
    maxFollowUps: DIFFICULTIES[difficulty].maxFollowUps,
    investorTurns: investorTurns.length,
    nextRound: plan[roundIndex + 1] ?? null,
    awaitingFounder: lastTurn?.role === "investor",
  };
}

/**
 * What the investor may do after the founder's latest answer.
 * - At the turn cap, the only option is to end.
 * - On the last round, moving on means ending.
 * - Follow-ups stop at the difficulty's limit (max 2), and when only one
 *   investor message remains before the cap.
 */
export function allowedActions(state: RoomState): NextAction[] {
  if (state.investorTurns >= MAX_INVESTOR_TURNS - 1) return ["end"];
  const actions: NextAction[] = [];
  if (state.followUpsUsed < state.maxFollowUps) actions.push("follow_up");
  actions.push(state.nextRound === null ? "end" : "next_round");
  return actions;
}

/** Validates the model's choice against the state machine, falling back safely. */
export function resolveAction(state: RoomState, proposed: NextAction): NextAction {
  const allowed = allowedActions(state);
  if (allowed.includes(proposed)) return proposed;
  return allowed.includes("next_round") ? "next_round" : allowed.includes("end") ? "end" : allowed[0];
}

/** Round the investor's next message belongs to, for a given action. */
export function roundAfter(state: RoomState, action: NextAction): number {
  if (action === "next_round" && state.nextRound !== null) return state.nextRound;
  return state.round;
}
