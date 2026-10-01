import mammoth from "mammoth";

/** Plain text of a .docx file. */
export async function docxToText(bytes: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer: bytes });
  return result.value.replace(/\n{3,}/g, "\n\n").trim();
}
