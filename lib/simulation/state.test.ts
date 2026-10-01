import { describe, expect, it } from "vitest";

import { PERSONAS } from "@/lib/ai/personas";
import { allowedActions, deriveState, MAX_INVESTOR_TURNS, resolveAction, roundAfter, type TurnLike } from "@/lib/simulation/state";

const inv = (round: number): TurnLike => ({ round, role: "investor" });
const fou = (round: number): TurnLike => ({ round, role: "founder" });

describe("deriveState", () => {
  it("starts at the persona's first round awaiting the founder", () => {
    const s = deriveState("seed_vc", "analytical", [inv(1)]);
    expect(s).toMatchObject({ round: 1, roundIndex: 0, followUpsUsed: 0, investorTurns: 1, nextRound: 2, awaitingFounder: true });
  });

  it("counts follow-ups within the current round", () => {
    const s = deriveState("seed_vc", "analytical", [inv(1), fou(1), inv(2), fou(2), inv(2), fou(2)]);
    expect(s).toMatchObject({ round: 2, followUpsUsed: 1, awaitingFounder: false });
  });

  it("follows each persona's own round order", () => {
    const s = deriveState("angel", "friendly", [inv(1), fou(1), inv(2), fou(2)]);
    expect(s.nextRound).toBe(4); // angels skip market sizing
    expect(PERSONAS.grant_evaluator.rounds).not.toContain(6);
  });
});

describe("allowedActions", () => {
  it("allows a follow-up or the next round mid-session", () => {
    const s = deriveState("seed_vc", "analytical", [inv(1), fou(1)]);
    expect(allowedActions(s)).toEqual(["follow_up", "next_round"]);
  });

  it("stops follow-ups at the difficulty limit (friendly: 1)", () => {
    const s = deriveState("seed_vc", "friendly", [inv(1), fou(1), inv(1), fou(1)]);
    expect(allowedActions(s)).toEqual(["next_round"]);
  });

  it("never allows more than 2 follow-ups", () => {
    const s = deriveState("seed_vc", "tough", [inv(1), fou(1), inv(1), fou(1), inv(1), fou(1)]);
    expect(s.followUpsUsed).toBe(2);
    expect(allowedActions(s)).not.toContain("follow_up");
  });

  it("does not allow ending early before the last round", () => {
    const s = deriveState("seed_vc", "tough", [inv(1), fou(1)]);
    expect(allowedActions(s)).not.toContain("end");
  });

  it("ends instead of moving on from the last round", () => {
    const s = deriveState("seed_vc", "friendly", [inv(10), fou(10)]);
    expect(allowedActions(s)).toEqual(["follow_up", "end"]);
  });

  it("forces the end at the investor turn cap", () => {
    const turns: TurnLike[] = [];
    for (let i = 0; i < MAX_INVESTOR_TURNS - 1; i++) turns.push(inv(3), fou(3));
    expect(allowedActions(deriveState("seed_vc", "tough", turns))).toEqual(["end"]);
  });
});

describe("resolveAction", () => {
  it("overrides a disallowed choice", () => {
    const s = deriveState("seed_vc", "friendly", [inv(1), fou(1), inv(1), fou(1)]);
    expect(resolveAction(s, "follow_up")).toBe("next_round");
    expect(resolveAction(s, "end")).toBe("next_round");
  });

  it("keeps allowed choices", () => {
    const s = deriveState("seed_vc", "analytical", [inv(1), fou(1)]);
    expect(resolveAction(s, "follow_up")).toBe("follow_up");
  });

  it("moves to the next planned round", () => {
    const s = deriveState("angel", "analytical", [inv(2), fou(2)]);
    expect(roundAfter(s, "next_round")).toBe(4);
    expect(roundAfter(s, "follow_up")).toBe(2);
  });
});

describe("a full session", () => {
  it("always finishes within the turn cap", () => {
    for (const persona of ["seed_vc", "angel", "grant_evaluator"] as const) {
      // Worst case: the model always asks for a follow-up when allowed.
      const turns: TurnLike[] = [inv(PERSONAS[persona].rounds[0])];
      let ended = false;
      while (!ended) {
        const state = deriveState(persona, "tough", [...turns, fou(turns.at(-1)!.round)]);
        turns.push(fou(state.round));
        const action = resolveAction(state, "follow_up");
        if (action === "end") ended = true;
        else turns.push(inv(roundAfter(state, action)));
      }
      expect(turns.filter((t) => t.role === "investor").length).toBeLessThanOrEqual(MAX_INVESTOR_TURNS);
    }
  });
});
