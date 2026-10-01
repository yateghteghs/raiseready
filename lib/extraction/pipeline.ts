import { callStructured, AiCallError } from "@/lib/ai/structured";
import {
  buildExtractionContent,
  EXTRACTION_PROMPT_VERSION,
  EXTRACTION_SYSTEM_PROMPT,
  type ExtractionDocument,
} from "@/lib/ai/prompts/extraction.v1";
import { checkProfileSources, knowledgeProfileSchema } from "@/lib/ai/schemas/knowledge-profile";
import { withinRateLimit } from "@/lib/ai/usage";
import { docxToText } from "@/lib/documents/docx";
import { DOCUMENTS_BUCKET, DocumentError } from "@/lib/documents/service";
import { MIME_TYPES } from "@/lib/documents/sniff";
import { xlsxToSheets } from "@/lib/documents/xlsx";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/database.types";

export const EXTRACTION_PURPOSE = "extraction";
/** A run still marked processing after this long is assumed to have died. */
export const STALE_PROCESSING_MS = 15 * 60 * 1000;
/** The API accepts requests up to 32 MB; leave room for the prompt. */
const MAX_REQUEST_BASE64_BYTES = 30 * 1024 * 1024;
const MAX_TEXT_CHARS_PER_DOCUMENT = 400_000;

/** The newest document of each kind; these are what an extraction reads. */
export function selectDocumentsForExtraction(docs: Tables<"documents">[]): Tables<"documents">[] {
  const newest = new Map<string, Tables<"documents">>();
  for (const doc of docs) {
    const current = newest.get(doc.kind);
    if (!current || doc.created_at > current.created_at) newest.set(doc.kind, doc);
  }
  return [...newest.values()];
}

export function isRunning(docs: Tables<"documents">[], now = Date.now()): boolean {
  return docs.some(
    (d) => d.status === "processing" && now - new Date(d.updated_at).getTime() < STALE_PROCESSING_MS,
  );
}

/**
 * Checks an extraction may start and marks the chosen documents as processing.
 * `docs` must already be scoped to the signed-in user's startup.
 */
export async function beginExtraction(userId: string, docs: Tables<"documents">[]): Promise<string[]> {
  const chosen = selectDocumentsForExtraction(docs);
  if (!chosen.some((d) => d.kind === "pitch_deck")) {
    throw new DocumentError("Upload your pitch deck first.");
  }
  if (isRunning(docs)) throw new DocumentError("Your documents are already being analysed.");
  if (!(await withinRateLimit(userId, EXTRACTION_PURPOSE))) {
    throw new DocumentError("You've analysed documents several times in the last hour. Please try again later.");
  }

  const ids = chosen.map((d) => d.id);
  const { error } = await createAdminClient()
    .from("documents")
    .update({ status: "processing", error_message: null })
    .in("id", ids);
  if (error) throw new Error(`Could not start analysis: ${error.message}`);
  return ids;
}

async function loadForModel(doc: Tables<"documents">): Promise<ExtractionDocument> {
  const { data, error } = await createAdminClient().storage.from(DOCUMENTS_BUCKET).download(doc.storage_path);
  if (error || !data) throw new DocumentError(`We couldn't read "${doc.original_filename}". Try uploading it again.`);
  const bytes = Buffer.from(await data.arrayBuffer());
  const base = { id: doc.id, kind: doc.kind, filename: doc.original_filename ?? doc.kind };

  if (doc.mime_type === MIME_TYPES.pdf) return { ...base, type: "pdf", base64: bytes.toString("base64") };

  let text: string;
  if (doc.mime_type === MIME_TYPES.xlsx) {
    text = xlsxToSheets(bytes)
      .map(
        (s) =>
          `## Sheet: ${s.name}${s.truncated ? ` (showing the first rows only; the sheet has ${s.rows} rows)` : ""}\n${s.csv}`,
      )
      .join("\n\n");
  } else {
    text = await docxToText(bytes);
  }
  if (text.length > MAX_TEXT_CHARS_PER_DOCUMENT) {
    throw new DocumentError(
      `"${doc.original_filename}" contains too much text to analyse. Remove unneeded sheets or sections and upload it again.`,
    );
  }
  return { ...base, type: "text", text };
}

async function finish(ids: string[], status: "ready" | "failed", message: string | null) {
  const { error } = await createAdminClient()
    .from("documents")
    .update({ status, error_message: message })
    .in("id", ids);
  if (error) console.error(`[extraction] could not update document status: ${error.message}`);
}

/**
 * Reads the documents, asks the model for a knowledge profile, validates it
 * (including that every source points at a supplied document) and saves it as
 * a new version. Runs in the background; marks the documents ready or failed.
 */
export async function runExtraction(userId: string, startupId: string, documentIds: string[]): Promise<void> {
  const admin = createAdminClient();
  try {
    const { data: docs, error } = await admin
      .from("documents")
      .select("*")
      .eq("startup_id", startupId)
      .in("id", documentIds);
    if (error) throw new Error(`Could not load documents: ${error.message}`);

    const inputs = await Promise.all(docs.map(loadForModel));
    const pdfBytes = inputs.reduce((n, d) => n + (d.type === "pdf" ? d.base64.length : 0), 0);
    if (pdfBytes > MAX_REQUEST_BASE64_BYTES) {
      throw new DocumentError("Your PDFs are too large to analyse together. Upload a smaller version of the largest one.");
    }

    const profile = await callStructured({
      userId,
      purpose: EXTRACTION_PURPOSE,
      system: EXTRACTION_SYSTEM_PROMPT,
      buildContent: (retryNote) => buildExtractionContent(inputs, retryNote),
      schema: knowledgeProfileSchema,
      check: (p) => checkProfileSources(p, documentIds),
      effort: "high",
    });

    const { data: latest } = await admin
      .from("knowledge_profiles")
      .select("version")
      .eq("startup_id", startupId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error: insertError } = await admin.from("knowledge_profiles").insert({
      startup_id: startupId,
      version: (latest?.version ?? 0) + 1,
      data: { ...profile, _meta: { prompt_version: EXTRACTION_PROMPT_VERSION } },
      source_document_ids: documentIds,
    });
    if (insertError) throw new Error(`Could not save knowledge profile: ${insertError.message}`);

    await finish(documentIds, "ready", null);
  } catch (error) {
    console.error("[extraction] failed:", error);
    const message =
      error instanceof AiCallError
        ? error.userMessage
        : error instanceof DocumentError
          ? error.message
          : "Something went wrong while analysing your documents. Please try again.";
    await finish(documentIds, "failed", message);
  }
}
