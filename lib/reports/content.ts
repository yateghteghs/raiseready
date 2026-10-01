import { z } from "zod";

/** What is stored in reports.content (spec 6.4). Assembled in code, plus an AI-written narrative. */
export const reportContentSchema = z.object({
  version: z.literal(1),
  generated_at: z.string(),
  startup: z.object({ name: z.string(), stage: z.string().nullable(), industry: z.string().nullable(), country: z.string().nullable() }),
  readiness: z.object({
    score: z.number(),
    band: z.string(),
    assessed_at: z.string(),
    rubric_version: z.string(),
    dimensions: z.array(z.object({ name: z.string(), score: z.number().nullable() })),
  }),
  simulation: z
    .object({
      investor: z.string(),
      difficulty: z.string(),
      score: z.number(),
      confidence: z.string(),
      date: z.string(),
    })
    .nullable(),
  executive_summary: z.string(),
  strengths: z.array(z.string()),
  risks: z.array(z.object({ risk: z.string(), why_it_matters: z.string() })),
  red_flags: z.array(z.object({ severity: z.string(), type: z.string(), description: z.string(), evidence: z.array(z.string()) })),
  questions_to_prepare: z.array(z.object({ question: z.string(), guidance: z.string() })),
  next_steps: z.array(z.string()),
});

export type ReportContent = z.infer<typeof reportContentSchema>;
