import { z } from "zod";

export const reportNarrativeSchema = z.object({
  executive_summary: z
    .string()
    .describe("Three to five sentences on how ready this startup is to raise, written to the founder, plain and honest."),
  key_risks: z
    .array(z.object({ risk: z.string(), why_it_matters: z.string() }))
    .describe("Three to five risks an investor would focus on, most serious first."),
  next_steps: z.array(z.string()).describe("Three to five concrete next steps, most impactful first."),
});

export type ReportNarrative = z.infer<typeof reportNarrativeSchema>;

export function checkReportNarrative(n: ReportNarrative): string[] {
  const problems: string[] = [];
  if (n.key_risks.length < 2 || n.key_risks.length > 5) problems.push("key_risks: give between 2 and 5.");
  if (n.next_steps.length < 2 || n.next_steps.length > 5) problems.push("next_steps: give between 2 and 5.");
  if (!n.executive_summary.trim()) problems.push("executive_summary is empty.");
  return problems;
}
