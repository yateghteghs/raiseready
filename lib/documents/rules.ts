import type { DocumentKind } from "@/lib/supabase/database.types";
import { countPdfPages, isEncryptedPdf } from "@/lib/documents/pdf";
import { detectFileType, type FileType } from "@/lib/documents/sniff";

/** Upload limits (spec 6.5). */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_DECK_PAGES = 40;
export const MAX_OTHER_PDF_PAGES = 100;

export type UploadableKind = Exclude<DocumentKind, "other">;

export const DOCUMENT_KINDS: Record<
  UploadableKind,
  { label: string; accepts: FileType[]; acceptAttr: string; hint: string; required: boolean }
> = {
  pitch_deck: {
    label: "Pitch deck",
    accepts: ["pdf"],
    acceptAttr: ".pdf,application/pdf",
    hint: `PDF, up to ${MAX_DECK_PAGES} pages. Using PowerPoint or Keynote? Export as PDF first.`,
    required: true,
  },
  financial_model: {
    label: "Financial model",
    accepts: ["xlsx"],
    acceptAttr: ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    hint: "Excel (.xlsx). From Google Sheets, use File → Download → Microsoft Excel.",
    required: false,
  },
  business_plan: {
    label: "Business plan",
    accepts: ["pdf", "docx"],
    acceptAttr:
      ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    hint: `PDF or Word (.docx), up to ${MAX_OTHER_PDF_PAGES} pages.`,
    required: false,
  },
};

export function isUploadableKind(kind: unknown): kind is UploadableKind {
  return typeof kind === "string" && kind in DOCUMENT_KINDS;
}

const TYPE_NAMES: Record<FileType, string> = { pdf: "PDF", xlsx: "Excel workbook", docx: "Word document" };

/** Extension expected for a file type, used when naming stored objects. */
export const EXTENSIONS: Record<FileType, string> = { pdf: "pdf", xlsx: "xlsx", docx: "docx" };

/** File type implied by a file name, used only to pick the upload's content type. */
export function typeFromFileName(name: string): FileType | null {
  const ext = name.toLowerCase().split(".").pop();
  return ext === "pdf" || ext === "xlsx" || ext === "docx" ? ext : null;
}

export type ValidationResult =
  | { ok: true; type: FileType; pages: number | null }
  | { ok: false; message: string };

/** Checks an uploaded file's real contents against the rules for its slot. */
export function validateDocument(bytes: Buffer, kind: UploadableKind): ValidationResult {
  const rules = DOCUMENT_KINDS[kind];
  if (bytes.length === 0) return { ok: false, message: "The file is empty." };
  if (bytes.length > MAX_FILE_BYTES) return { ok: false, message: "Files must be 20 MB or smaller." };

  const type = detectFileType(bytes);
  if (!type) {
    return { ok: false, message: "We couldn't read this file. Upload a PDF, Excel (.xlsx) or Word (.docx) file." };
  }
  if (!rules.accepts.includes(type)) {
    const wanted = rules.accepts.map((t) => TYPE_NAMES[t]).join(" or ");
    return { ok: false, message: `This file is a ${TYPE_NAMES[type]}. A ${rules.label.toLowerCase()} must be a ${wanted}.` };
  }

  if (type !== "pdf") return { ok: true, type, pages: null };

  if (isEncryptedPdf(bytes)) {
    return {
      ok: false,
      message: "This PDF is password-protected or restricted. Export an unprotected copy and upload that.",
    };
  }
  const pages = countPdfPages(bytes);
  const maxPages = kind === "pitch_deck" ? MAX_DECK_PAGES : MAX_OTHER_PDF_PAGES;
  if (pages !== null && pages > maxPages) {
    return { ok: false, message: `This PDF has ${pages} pages. The limit is ${maxPages}.` };
  }
  return { ok: true, type, pages };
}
