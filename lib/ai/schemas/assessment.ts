import { z } from "zod";

import { ALL_INDICATOR_IDS, DIMENSIONS, RATINGS, type DimensionDef } from "@/lib/scoring/rubric";

const dimensionIds = DIMENSIONS.map((d) => d.id) as [string, ...string[]];

export const indicatorRatingSchema = z.object({
  indicator_id: z.enum(ALL_INDICATOR_IDS as [string, ...string[]]),
  rating: z.enum(RATINGS),
  reason: z.string().describe("One sentence citing what the profile says (or that it is missing)."),
});

export const dimensionFeedbackSchema = z.object({
  why_weak: z.string().describe("The main gap in this area, in one or two sentences."),
  investor_question: z.string().describe("The question an investor would most likely ask about this gap."),
  fix: z.string().describe("One concrete, specific action the founder can take to close the gap."),
});

export const assessmentOutputSchema = z.object({
  dimensions: z.array(
    z.object({
      dimension_id: z.enum(dimensionIds),
      indicators: z.array(indicatorRatingSchema),
      feedback: dimensionFeedbackSchema,
    }),
  ),
});

export type AssessmentOutput = z.infer<typeof assessmentOutputSchema>;
export type DimensionFeedback = z.infer<typeof dimensionFeedbackSchema>;

/** Every requested dimension appears once and rates exactly its own indicators, once each. */
export function checkAssessmentOutput(output: AssessmentOutput, rated: DimensionDef[]): string[] {
  const problems: string[] = [];
  const byId = new Map(output.dimensions.map((d) => [d.dimension_id, d]));
  if (byId.size !== output.dimensions.length) problems.push("A dimension appears more than once.");

  for (const def of rated) {
    const got = byId.get(def.id);
    if (!got) {
      problems.push(`Dimension "${def.id}" is missing.`);
      continue;
    }
    const expected = new Set(def.indicators.map((i) => i.id));
    const seen = new Set<string>();
    for (const r of got.indicators) {
      if (!expected.has(r.indicator_id)) problems.push(`"${r.indicator_id}" does not belong to dimension "${def.id}".`);
      else if (seen.has(r.indicator_id)) problems.push(`"${r.indicator_id}" is rated more than once.`);
      seen.add(r.indicator_id);
      if (!r.reason.trim()) problems.push(`"${r.indicator_id}" has no reason.`);
    }
    for (const id of expected) if (!seen.has(id)) problems.push(`Indicator "${id}" in "${def.id}" is not rated.`);
  }
  for (const id of byId.keys()) {
    if (!rated.some((d) => d.id === id)) problems.push(`Dimension "${id}" should not be rated.`);
  }
  return problems;
}
