import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeDb } from "../../test/fake-supabase";
import { checkTurnOutput, type TurnOutput } from "@/lib/ai/schemas/simulation";
import { simulationScore } from "@/lib/simulation/score";

const fake = createFakeDb();
const db = fake.tables;

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fake.client }));
vi.mock("@/lib/ai/usage", () => ({ withinRateLimit: async () => true }));

type CallOpts = {
  purpose: string;
  check?: (o: unknown) => string[];
  onTextDelta?: (d: string) => void;
  onRetry?: () => void;
  buildContent: (note?: string) => { text: string }[];
};
/** Each test queues the model's replies; the mock runs the real checks like callStructured does. */
let replies: unknown[] = [];
const callStructured = vi.fn(async (opts: CallOpts) => {
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (attempt > 1) opts.onRetry?.();
    const reply = replies.shift();
    const json = JSON.stringify(reply);
    opts.onTextDelta?.(json.slice(0, 40));
    opts.onTextDelta?.(json.slice(40));
    const problems = opts.check?.(reply) ?? [];
    if (problems.length === 0) return reply;
    opts.buildContent(problems.join("\n"));
  }
  throw new (class AiCallError extends Error { userMessage = "The AI's answer didn't pass our checks."; })();
});
vi.mock("@/lib/ai/structured", () => ({
  callStructured: (o: never) => callStructured(o),
  AiCallError: class extends Error {},
}));

const { finalizeSimulation, startDrill, startSimulation, takeTurn } = await import("@/lib/simulation/service");

const DECK = "documents-deck";
const evaluation = { clarity: 7, evidence: 5, consistency: 8, notes: "OK." };
const turn = (over: Partial<TurnOutput> = {}): TurnOutput => ({
  next_action: "next_round",
  investor_message: "Tell me about the problem you are solving.",
  evaluation,
  red_flags: [],
  ...over,
});

function reset() {
  for (const k of Object.keys(db)) delete db[k];
  replies = [];
  callStructured.mockClear();
  db.startups = [{ id: "s1", owner_id: "u1", name: "PayLink" }];
  db.documents = [{ id: DECK, startup_id: "s1", kind: "pitch_deck" }];
  db.knowledge_profiles = [
    {
      id: "kp1",
      startup_id: "s1",
      version: 1,
      source_document_ids: [DECK],
      data: { traction: { paying_customers: { value: 1200, source_document_id: DECK, page_or_sheet: "page 2", quote: "1,200 paying merchants" } } },
    },
  ];
  db.simulations = [];
  db.simulation_turns = [];
  db.red_flags = [];
}

async function start() {
  return startSimulation("u1", db.startups[0] as never, { persona: "seed_vc", difficulty: "analytical", fundingType: "SAFE" });
}

describe("Investor Room", () => {
  beforeEach(reset);

  it("starts with the persona's opening question", async () => {
    const id = await start();
    expect(db.simulation_turns).toEqual([
      expect.objectContaining({ simulation_id: id, turn_index: 0, round: 1, role: "investor", content: expect.stringContaining("PayLink") }),
    ]);
  });

  it("streams the investor message and saves the turn", async () => {
    const id = await start();
    replies = [turn()];
    const events: { type: string; text?: string }[] = [];
    const ended = await takeTurn("u1", id, { answer: "We help traders take payments.", clarifiesRedFlagId: null }, (e) => events.push(e));
    expect(ended).toBe(false);
    const streamed = events.filter((e) => e.type === "delta").map((e) => e.text).join("");
    expect(streamed).toBe("Tell me about the problem you are solving.");
    expect(events.at(-1)?.type).toBe("done");
    expect(db.simulation_turns.map((t) => [t.turn_index, t.role, t.round])).toEqual([
      [0, "investor", 1],
      [1, "founder", 1],
      [2, "investor", 2],
    ]);
    expect(db.simulation_turns[1].evaluation).toEqual(evaluation);
  });

  it("flags a deliberate contradiction with the deck, citing both sources", async () => {
    const id = await start();
    const answer = "We have about 3,000 paying merchants right now.";
    replies = [
      turn({
        next_action: "follow_up",
        investor_message: "Your deck says 1,200 paying merchants. Which is right?",
        red_flags: [
          {
            type: "contradiction",
            severity: "high",
            description: "You said 3,000 paying merchants, but your deck says 1,200.",
            evidence: [
              { source: "founder_answer", document_id: null, page_or_sheet: null, turn_index: 1, quote: "about 3,000 paying merchants" },
              { source: "document", document_id: DECK, page_or_sheet: "page 2", turn_index: null, quote: "1,200 paying merchants" },
            ],
          },
        ],
      }),
    ];
    await takeTurn("u1", id, { answer, clarifiesRedFlagId: null }, () => {});
    expect(db.red_flags).toHaveLength(1);
    const flag = db.red_flags[0] as { type: string; turn_id: string; evidence: { source: string }[] };
    expect(flag.type).toBe("contradiction");
    expect(flag.evidence.map((e) => e.source).sort()).toEqual(["document", "founder_answer"]);
    expect(flag.turn_id).toBe(db.simulation_turns[1].id);
  });

  it("rejects a contradiction that cites only one side, and retries", async () => {
    const id = await start();
    const oneSided = turn({
      red_flags: [
        {
          type: "contradiction",
          severity: "high",
          description: "Conflicts with the deck.",
          evidence: [{ source: "document", document_id: DECK, page_or_sheet: "page 2", turn_index: null, quote: "1,200 paying merchants" }],
        },
      ],
    });
    replies = [oneSided, turn()];
    const events: { type: string }[] = [];
    await takeTurn("u1", id, { answer: "3,000 merchants.", clarifiesRedFlagId: null }, (e) => events.push(e));
    expect(callStructured).toHaveBeenCalledTimes(1);
    expect(events.some((e) => e.type === "reset")).toBe(true);
    expect(db.red_flags).toHaveLength(0);
  });

  it("removes the answer if the model fails, so it can be resent", async () => {
    const id = await start();
    replies = [turn({ investor_message: "" }), turn({ investor_message: "" })];
    await expect(takeTurn("u1", id, { answer: "Hello", clarifiesRedFlagId: null }, () => {})).rejects.toThrow();
    expect(db.simulation_turns).toHaveLength(1);
  });

  it("refuses an answer while the investor hasn't asked yet", async () => {
    const id = await start();
    db.simulation_turns.push({ id: "x", simulation_id: id, turn_index: 1, round: 1, role: "founder", content: "hi" });
    await expect(takeTurn("u1", id, { answer: "again", clarifiesRedFlagId: null }, () => {})).rejects.toThrow(/Wait for/);
  });

  it("does not let another user answer", async () => {
    const id = await start();
    await expect(takeTurn("u2", id, { answer: "hi", clarifiesRedFlagId: null }, () => {})).rejects.toThrow(/not found/);
  });

  it("overrides an early end and runs a full session to completion", async () => {
    const id = await start();
    let ended = false;
    let guard = 0;
    while (!ended && guard++ < 30) {
      // The model always tries to end; the state machine only allows it on the last round.
      replies = [turn({ next_action: "end" as never, investor_message: "Next question?" })];
      ended = await takeTurn("u1", id, { answer: "An answer.", clarifiesRedFlagId: null }, () => {});
    }
    expect(ended).toBe(true);
    const investorTurns = db.simulation_turns.filter((t) => t.role === "investor");
    // Opening + one question per remaining round (9) + closing, all within the cap.
    expect(investorTurns.length).toBe(11);
    expect(investorTurns.at(-2)?.round).toBe(10);
    expect(db.simulations[0].ended_at).toBeTruthy();

    replies = [
      {
        investor_confidence: "medium",
        summary: "Solid.",
        strengths: ["Clear problem"],
        weaknesses: ["No burn figure"],
        struggled_questions: [{ turn_index: 2, question: "Problem?", why: "Vague", better_answer: "Numbers" }],
        recommended_next_practice: { persona: "seed_vc", difficulty: "tough", focus: "financials", reason: "Weakest area" },
      },
    ];
    await finalizeSimulation("u1", id);
    expect(db.simulations[0]).toMatchObject({ status: "completed", investor_confidence: "medium", overall_score: 67 });
  });
});

describe("practise a question again (drills)", () => {
  beforeEach(reset);

  async function sessionWithOneAnswer() {
    const id = await start();
    replies = [turn()];
    await takeTurn("u1", id, { answer: "We help traders take payments.", clarifiesRedFlagId: null }, () => {});
    return id;
  }

  it("re-asks the original question and scores the new answer against the first attempt", async () => {
    await sessionWithOneAnswer();
    const question = db.simulation_turns.find((t) => t.turn_index === 0)!;
    const drillId = await startDrill("u1", question.id as string);

    const drill = db.simulations.find((s) => s.id === drillId)!;
    expect(drill).toMatchObject({ mode: "drill", source_turn_id: question.id });
    expect(db.simulation_turns.filter((t) => t.simulation_id === drillId)).toEqual([
      expect.objectContaining({ turn_index: 0, role: "investor", content: question.content }),
    ]);

    replies = [
      {
        evaluation: { clarity: 9, evidence: 8, consistency: 10, notes: "Much clearer." },
        red_flags: [],
        improvement: "You added numbers this time.",
        still_missing: "Nothing important",
        better_answer: "Lead with 1,200 paying merchants.",
      },
    ];
    const events: { type: string }[] = [];
    await takeTurn("u1", drillId, { answer: "1,200 paying merchants in Lagos, growing 15% a month.", clarifiesRedFlagId: null }, (e) => events.push(e));
    expect(events.at(-1)?.type).toBe("drill_done");
    expect(drill).toMatchObject({ status: "completed", overall_score: 90 });
    expect(drill.final_evaluation).toMatchObject({ kind: "drill", previous: evaluation, improvement: expect.any(String) });

    await expect(takeTurn("u1", drillId, { answer: "again", clarifiesRedFlagId: null }, () => {})).rejects.toThrow(/finished/);
  });

  it("doesn't let another founder practise someone else's question", async () => {
    await sessionWithOneAnswer();
    const question = db.simulation_turns.find((t) => t.turn_index === 0)!;
    await expect(startDrill("u2", question.id as string)).rejects.toThrow(/not found/);
  });

  it("doesn't count drills as the live session when starting a new meeting", async () => {
    await sessionWithOneAnswer();
    const question = db.simulation_turns.find((t) => t.turn_index === 0)!;
    const drillId = await startDrill("u1", question.id as string);
    await start();
    expect(db.simulations.find((s) => s.id === drillId)?.status).toBe("active");
  });
});

describe("checkTurnOutput", () => {
  const ctx = { currentTurnIndex: 3, founderAnswers: new Map([[1, "We have 1,200 merchants"], [3, "Actually 3,000"]]), documentIds: [DECK] };
  const contradiction = (evidence: TurnOutput["red_flags"][number]["evidence"]) =>
    turn({ red_flags: [{ type: "contradiction", severity: "high", description: "x", evidence }] });

  it("accepts a contradiction between the current answer and an earlier answer", () => {
    expect(
      checkTurnOutput(
        contradiction([
          { source: "founder_answer", document_id: null, page_or_sheet: null, turn_index: 3, quote: "Actually 3,000" },
          { source: "founder_answer", document_id: null, page_or_sheet: null, turn_index: 1, quote: "1,200 merchants" },
        ]),
        ctx,
      ),
    ).toEqual([]);
  });

  it("rejects made-up quotes and unknown documents", () => {
    const problems = checkTurnOutput(
      contradiction([
        { source: "founder_answer", document_id: null, page_or_sheet: null, turn_index: 3, quote: "5,000" },
        { source: "document", document_id: "other", page_or_sheet: "page 1", turn_index: null, quote: "x" },
      ]),
      ctx,
    );
    expect(problems.join("\n")).toMatch(/copied exactly/);
    expect(problems.join("\n")).toMatch(/document_id/);
  });
});

describe("simulationScore", () => {
  it("averages the three ratings and subtracts red-flag penalties", () => {
    expect(simulationScore([{ clarity: 10, evidence: 10, consistency: 10 }], [])).toBe(100);
    expect(simulationScore([{ clarity: 7, evidence: 5, consistency: 8 }], ["high", "medium", "low"])).toBe(60);
    expect(simulationScore([{ clarity: 0, evidence: 0, consistency: 0 }], ["high"])).toBe(0);
  });

  it("caps the red-flag penalty", () => {
    expect(simulationScore([{ clarity: 10, evidence: 10, consistency: 10 }], Array(10).fill("high"))).toBe(80);
  });
});
