import { DIFFICULTIES, PERSONAS } from "@/lib/ai/personas";
import { REPORT_PROMPT_VERSION, REPORT_SYSTEM_PROMPT } from "@/lib/ai/prompts/report.v1";
import { escapeDelimiters } from "@/lib/ai/prompts/extraction.v1";
import { checkReportNarrative, reportNarrativeSchema } from "@/lib/ai/schemas/report";
import { finalEvaluationSchema, type FinalEvaluation } from "@/lib/ai/schemas/simulation";
import { AiCallError, callStructured } from "@/lib/ai/structured";
import { withinRateLimit } from "@/lib/ai/usage";
import { pdfAccess } from "@/lib/billing/entitlements";
import { PlanLimitError } from "@/lib/billing/limits";
import { getUsage } from "@/lib/billing/service";
import { assessmentView } from "@/lib/assessment/view";
import { DOCUMENT_KINDS, type UploadableKind } from "@/lib/documents/rules";
import { reportContentSchema, type ReportContent } from "@/lib/reports/content";
import { logoBytes } from "@/lib/images/service";
import { renderReportPdf } from "@/lib/reports/pdf";
import { STAGE_OPTIONS, labelFor } from "@/lib/startups/options";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json, Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export const REPORT_PURPOSE = "report";
export const REPORTS_BUCKET = "reports";

export class ReportError extends Error {}

const TYPE_LABELS: Record<string, string> = {
  contradiction: "Contradiction",
  unsupported_claim: "Unsupported claim",
  weak_answer: "Weak answer",
  missing_info: "Missing information",
};

type Evidence = { source: string; document_id: string | null; page_or_sheet: string | null; turn_index: number | null; quote: string };

/**
 * Builds a report from the latest assessment and (optionally) a completed
 * simulation, writes its narrative with one AI call, renders the PDF and
 * stores both. Everything except the narrative comes straight from saved data.
 */
export async function createReport(
  userId: string,
  startup: Tables<"startups">,
  simulationId: string | null,
): Promise<string> {
  const admin = createAdminClient();

  const { data: assessmentRow } = await admin
    .from("assessments")
    .select("*")
    .eq("startup_id", startup.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!assessmentRow) throw new ReportError("Run your readiness assessment first. The report is built from it.");
  const assessment = assessmentView(assessmentRow);

  let simulation: Tables<"simulations"> | null = null;
  let final: FinalEvaluation | null = null;
  let flags: Tables<"red_flags">[] = [];
  if (simulationId) {
    const { data } = await admin
      .from("simulations")
      .select("*")
      .eq("id", simulationId)
      .eq("startup_id", startup.id)
      .eq("mode", "full")
      .eq("status", "completed")
      .maybeSingle();
    if (!data) throw new ReportError("Choose a completed Investor Room session.");
    simulation = data;
    const parsed = finalEvaluationSchema.safeParse(data.final_evaluation);
    final = parsed.success ? parsed.data : null;
    const { data: f } = await admin.from("red_flags").select("*").eq("simulation_id", data.id);
    flags = (f ?? []).sort((a, b) => ["high", "medium", "low"].indexOf(a.severity) - ["high", "medium", "low"].indexOf(b.severity));
  }

  if (!(await withinRateLimit(userId, REPORT_PURPOSE))) {
    throw new ReportError("You've created several reports in the last hour. Please try again later.");
  }

  const { data: docs } = await admin.from("documents").select("id, kind").eq("startup_id", startup.id);
  const docLabel = (id: string | null) => DOCUMENT_KINDS[(docs ?? []).find((d) => d.id === id)?.kind as UploadableKind]?.label ?? "Documents";

  const material = [
    `Readiness score ${assessment.score}/100 (${assessment.band.label}).`,
    `Scores by area: ${assessment.dimensions.map((d) => `${d.name} ${d.score ?? "not scored"}`).join("; ")}.`,
    `Strengths: ${assessment.strengths.map((x) => x.name).join(", ") || "none above 70"}.`,
    `Weaknesses: ${assessment.weaknesses.map((w) => `${w.name} (${w.score}): ${w.why_weak}`).join(" | ") || "none"}.`,
    `Recommended fixes: ${assessment.actions.map((a) => `${a.name}: ${a.action}`).join(" | ") || "none"}.`,
    simulation && final
      ? `Practice meeting with a ${PERSONAS[simulation.persona].name} (${simulation.difficulty}): score ${simulation.overall_score}/100, investor confidence ${simulation.investor_confidence}. ${final.summary} Strengths: ${final.strengths.join("; ")}. Weaknesses: ${final.weaknesses.join("; ")}.`
      : "No practice meeting included.",
    flags.length ? `Red flags: ${flags.map((f) => `${f.severity} ${f.type}: ${f.description}`).join(" | ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  let narrative;
  try {
    narrative = await callStructured({
      userId,
      purpose: REPORT_PURPOSE,
      system: REPORT_SYSTEM_PROMPT,
      buildContent: (retryNote) => [
        {
          type: "text",
          text: `<founder_material>\n${escapeDelimiters(material)}\n</founder_material>\n\nWrite the report narrative for ${escapeDelimiters(startup.name)}.${
            retryNote ? `\n\nYour previous answer was rejected for these reasons. Fix them:\n${retryNote}` : ""
          }`,
        },
      ],
      schema: reportNarrativeSchema,
      check: checkReportNarrative,
      effort: "medium",
    });
  } catch (error) {
    if (error instanceof AiCallError) throw new ReportError(error.userMessage);
    throw error;
  }

  const questions =
    final && final.struggled_questions.length
      ? final.struggled_questions.slice(0, 5).map((q) => ({ question: q.question, guidance: q.better_answer }))
      : assessment.weaknesses.slice(0, 5).map((w) => ({ question: w.investor_question, guidance: w.why_weak }));

  const content: ReportContent = reportContentSchema.parse({
    version: 1,
    generated_at: new Date().toISOString(),
    startup: {
      name: startup.name,
      stage: labelFor(STAGE_OPTIONS, startup.stage),
      industry: startup.industry,
      country: startup.country,
    },
    readiness: {
      score: assessment.score,
      band: assessment.band.label,
      assessed_at: assessment.createdAt,
      rubric_version: assessment.rubricVersion,
      dimensions: assessment.dimensions.map((d) => ({ name: d.name, score: d.score })),
    },
    simulation:
      simulation && simulation.overall_score !== null
        ? {
            investor: PERSONAS[simulation.persona].name,
            difficulty: DIFFICULTIES[simulation.difficulty].label,
            score: simulation.overall_score,
            confidence: simulation.investor_confidence ?? "n/a",
            date: simulation.ended_at ?? simulation.started_at,
          }
        : null,
    executive_summary: narrative.executive_summary,
    strengths: [...assessment.strengths.map((x) => `${x.name} (${x.score}/100)`), ...(final?.strengths ?? [])].slice(0, 6),
    risks: narrative.key_risks,
    red_flags: flags.slice(0, 8).map((f) => ({
      severity: f.severity,
      type: TYPE_LABELS[f.type] ?? f.type,
      description: f.description,
      evidence: ((f.evidence as unknown as Evidence[]) ?? []).map((e) =>
        e.source === "document"
          ? `${docLabel(e.document_id)}${e.page_or_sheet ? `, ${e.page_or_sheet}` : ""}: “${e.quote}”`
          : `Your answer: “${e.quote}”`,
      ),
    })),
    questions_to_prepare: questions,
    next_steps: narrative.next_steps,
  });

  const { data: report, error } = await admin
    .from("reports")
    .insert({
      startup_id: startup.id,
      assessment_id: assessmentRow.id,
      simulation_id: simulation?.id ?? null,
      content: { ...content, prompt_version: REPORT_PROMPT_VERSION } as unknown as Json,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Could not save report: ${error.message}`);

  if (pdfAccess(await getUsage(userId, null)).ok) await storePdf(userId, startup.id, report.id, content);
  return report.id;
}

/** Renders and stores the PDF privately at {owner}/{startup}/{report}.pdf. */
export async function storePdf(userId: string, startupId: string, reportId: string, content: ReportContent): Promise<string> {
  const admin = createAdminClient();
  const { data: startup } = await admin.from("startups").select("logo_path").eq("id", startupId).eq("owner_id", userId).maybeSingle();
  const logo = await logoBytes(userId, startup?.logo_path);
  const pdf = await renderReportPdf(content, { logo });
  const path = `${userId}/${startupId}/${reportId}.pdf`;
  const { error } = await admin.storage.from(REPORTS_BUCKET).upload(path, pdf, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`Could not store PDF: ${error.message}`);
  await admin.from("reports").update({ pdf_storage_path: path }).eq("id", reportId);
  return path;
}

/** A one-minute download link for a report's PDF, creating the PDF if it is missing. */
export async function reportDownloadLink(userId: string, reportId: string): Promise<string> {
  const access = pdfAccess(await getUsage(userId, null));
  if (!access.ok) throw new PlanLimitError(access.reason);
  const supabase = await createClient();
  const { data: report } = await supabase.from("reports").select("*").eq("id", reportId).maybeSingle();
  if (!report) throw new ReportError("Report not found.");

  let path = report.pdf_storage_path;
  if (!path) {
    const parsed = reportContentSchema.safeParse(report.content);
    if (!parsed.success) throw new ReportError("This report can't be turned into a PDF. Create a new one.");
    path = await storePdf(userId, report.startup_id, report.id, parsed.data);
  }
  const startup = await supabase.from("startups").select("name").eq("id", report.startup_id).maybeSingle();
  const fileName = `${(startup.data?.name ?? "RaiseReady").replace(/[^\w\- ]+/g, "")} readiness report.pdf`;
  const { data, error } = await supabase.storage.from(REPORTS_BUCKET).createSignedUrl(path, 60, { download: fileName });
  if (error || !data) throw new Error(`Could not create download link: ${error?.message}`);
  return data.signedUrl;
}
