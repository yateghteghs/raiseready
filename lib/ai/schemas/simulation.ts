import { z } from "zod";

import type { NextAction } from "@/lib/simulation/state";

export const evidenceSchema = z.object({
  source: z.enum(["document", "founder_answer"]),
  document_id: z.string().nullable().describe("For document evidence: the document id from the profile sources."),
  page_or_sheet: z.string().nullable().describe('For document evidence: e.g. "page 4".'),
  turn_index: z.number().int().nullable().describe("For founder_answer evidence: the turn number of that answer."),
  quote: z.string().describe("Short verbatim quote from that source."),
});

export const redFlagSchema = z.object({
  type: z.enum(["contradiction", "unsupported_claim", "weak_answer", "missing_info"]),
  severity: z.enum(["low", "medium", "high"]),
  description: z.string().describe("One or two sentences, addressed to the founder."),
  evidence: z.array(evidenceSchema),
});

export const turnEvaluationSchema = z.object({
  clarity: z.number().int().min(0).max(10),
  evidence: z.number().int().min(0).max(10),
  consistency: z.number().int().min(0).max(10),
  notes: z.string().describe("One or two sentences of private feedback on this answer, for the results page."),
});

/** Output of one founder turn. `next_action` is limited to what the state machine allows now. */
export function turnOutputSchema(allowed: NextAction[]) {
  return z.object({
    next_action: z.enum(allowed as [NextAction, ...NextAction[]]),
    investor_message: z.string(),
    evaluation: turnEvaluationSchema,
    red_flags: z.array(redFlagSchema),
  });
}

export type TurnOutput = z.infer<ReturnType<typeof turnOutputSchema>>;
export type RedFlagOutput = z.infer<typeof redFlagSchema>;
export type TurnEvaluation = z.infer<typeof turnEvaluationSchema>;

const normalise = (s: string) => s.toLowerCase().replace(/[“”"'‘’]/g, "").replace(/\s+/g, " ").trim();

/**
 * Checks the schema can't express. Red flags must point at real sources, quotes
 * from founder answers must really appear in them, and a contradiction must cite
 * both sides: the current answer and a document or an earlier answer.
 */
export function checkTurnOutput(
  output: TurnOutput,
  ctx: { currentTurnIndex: number; founderAnswers: Map<number, string>; documentIds: string[] },
): string[] {
  const problems: string[] = [];
  if (!output.investor_message.trim()) problems.push("investor_message is empty.");
  if (output.investor_message.length > 1500) problems.push("investor_message is too long; keep it under 120 words.");

  output.red_flags.forEach((flag, i) => {
    const label = `red_flags[${i}]`;
    if (flag.evidence.length === 0) problems.push(`${label}: cite at least one source.`);
    for (const [j, ev] of flag.evidence.entries()) {
      const where = `${label}.evidence[${j}]`;
      if (ev.source === "document") {
        if (!ev.document_id || !ctx.documentIds.includes(ev.document_id)) {
          problems.push(`${where}: document_id must be one of the profile's document ids.`);
        }
        if (!ev.page_or_sheet) problems.push(`${where}: give the page or sheet.`);
      } else {
        const answer = ev.turn_index === null ? undefined : ctx.founderAnswers.get(ev.turn_index);
        if (answer === undefined) problems.push(`${where}: turn_index must be one of the founder's answers.`);
        else if (!normalise(answer).includes(normalise(ev.quote))) {
          problems.push(`${where}: the quote must be copied exactly from founder turn ${ev.turn_index}.`);
        }
      }
    }
    if (flag.type === "contradiction") {
      const citesCurrent = flag.evidence.some(
        (e) => e.source === "founder_answer" && e.turn_index === ctx.currentTurnIndex,
      );
      const citesOther = flag.evidence.some(
        (e) => e.source === "document" || (e.source === "founder_answer" && e.turn_index !== ctx.currentTurnIndex),
      );
      if (!citesCurrent || !citesOther) {
        problems.push(
          `${label}: a contradiction must cite both sources: the current answer (turn ${ctx.currentTurnIndex}) and the document page or earlier answer it conflicts with.`,
        );
      }
    }
  });
  return problems;
}

export const finalEvaluationSchema = z.object({
  investor_confidence: z.enum(["low", "medium", "high"]),
  summary: z.string().describe("Two or three sentences: how the session went, in the investor's honest view."),
  strengths: z.array(z.string()).describe("Two to four specific strengths shown in the session."),
  weaknesses: z.array(z.string()).describe("Two to four specific weaknesses shown in the session."),
  struggled_questions: z
    .array(
      z.object({
        turn_index: z.number().int().describe("Turn number of the investor question."),
        question: z.string().describe("The question, as asked or lightly shortened."),
        why: z.string().describe("Why the answer fell short."),
        better_answer: z.string().describe("What a stronger answer would include, specific to this startup."),
      }),
    )
    .describe("Up to five questions the founder struggled with most, worst first."),
  recommended_next_practice: z.object({
    persona: z.enum(["seed_vc", "angel", "grant_evaluator"]),
    difficulty: z.enum(["friendly", "analytical", "tough"]),
    focus: z.string(),
    reason: z.string(),
  }),
});

export type FinalEvaluation = z.infer<typeof finalEvaluationSchema>;

export function checkFinalEvaluation(output: FinalEvaluation, investorTurnIndexes: Set<number>): string[] {
  const problems: string[] = [];
  if (output.struggled_questions.length > 5) problems.push("struggled_questions: at most five.");
  output.struggled_questions.forEach((q, i) => {
    if (!investorTurnIndexes.has(q.turn_index)) {
      problems.push(`struggled_questions[${i}].turn_index must be the turn number of an investor question.`);
    }
  });
  if (output.strengths.length === 0) problems.push("strengths: give at least one.");
  if (output.weaknesses.length === 0) problems.push("weaknesses: give at least one.");
  return problems;
}

/** Output of a one-question drill: rating plus coaching against the earlier attempt. */
export const drillOutputSchema = z.object({
  evaluation: turnEvaluationSchema,
  red_flags: z.array(redFlagSchema),
  improvement: z.string().describe("How this answer compares with the earlier attempt, in one or two sentences."),
  still_missing: z.string().describe("What a strong answer would still need, or 'Nothing important' if it is strong."),
  better_answer: z.string().describe("A short outline of a strong answer for this startup, using only facts from the documents and answers."),
});
export type DrillOutput = z.infer<typeof drillOutputSchema>;
