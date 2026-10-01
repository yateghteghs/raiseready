import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { countPdfPages } from "@/lib/documents/pdf";
import { reportContentSchema, type ReportContent } from "@/lib/reports/content";
import { renderReportPdf } from "@/lib/reports/pdf";

export const sampleReport: ReportContent = {
  version: 1,
  generated_at: "2026-10-01T12:00:00Z",
  startup: { name: "PayLink", stage: "Seed", industry: "Fintech", country: "Nigeria" },
  readiness: {
    score: 63,
    band: "Getting there",
    assessed_at: "2026-10-01T10:00:00Z",
    rubric_version: "2026-10.v1",
    dimensions: [
      { name: "Problem clarity", score: 80 },
      { name: "Traction", score: 58 },
      { name: "Financial readiness", score: 41 },
      { name: "Communication / defence", score: null },
    ],
  },
  simulation: { investor: "Seed VC", difficulty: "Tough", score: 61, confidence: "medium", date: "2026-10-01T11:00:00Z" },
  executive_summary: "PayLink has real traction with 1,200 paying merchants and ₦4,500,000 monthly revenue, but investors will press on burn and runway. Ọjà traders in Lagos are a clear, well-described customer.",
  strengths: ["Problem clarity (80/100)", "Clear customer: Lagos market traders"],
  risks: [{ risk: "Runway is not stated", why_it_matters: "Investors can't tell how long ₦ raised will last." }],
  red_flags: [{ severity: "high", type: "Contradiction", description: "Answer says 3,000 merchants; deck says 1,200.", evidence: ["Pitch deck, page 2: “1,200 paying merchants”", "Your answer: “about 3,000”"] }],
  questions_to_prepare: [{ question: "How many months of runway do you have?", guidance: "Give burn and runway in months." }],
  next_steps: ["Add a slide with burn and runway.", "Reconcile merchant numbers across deck and model."],
};

describe("renderReportPdf", () => {
  it("renders a valid PDF from report content", async () => {
    expect(reportContentSchema.safeParse(sampleReport).success).toBe(true);
    const pdf = await renderReportPdf(sampleReport);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(countPdfPages(pdf)).toBeGreaterThanOrEqual(1);
    if (process.env.REPORT_PDF_OUT) writeFileSync(process.env.REPORT_PDF_OUT, pdf);
  }, 30_000);
});
