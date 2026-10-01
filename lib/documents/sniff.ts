import { isPdf } from "@/lib/documents/pdf";
import { isZip, listZipEntries, ZipError } from "@/lib/documents/zip";

export type FileType = "pdf" | "xlsx" | "docx";

export const MIME_TYPES: Record<FileType, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/**
 * Identifies a file by its contents, never its name. Returns null for anything
 * that isn't a PDF, Excel workbook or Word document (including archives that
 * fail the zip safety limits).
 */
export function detectFileType(bytes: Buffer): FileType | null {
  if (isPdf(bytes)) return "pdf";
  if (!isZip(bytes)) return null;
  try {
    const names = new Set(listZipEntries(bytes).map((e) => e.name));
    if (!names.has("[Content_Types].xml")) return null;
    if (names.has("xl/workbook.xml")) return "xlsx";
    if (names.has("word/document.xml")) return "docx";
    return null;
  } catch (error) {
    if (error instanceof ZipError) return null;
    throw error;
  }
}
