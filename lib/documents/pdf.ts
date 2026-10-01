import { inflateSync } from "node:zlib";

/**
 * Lightweight PDF inspection without a PDF library: page count and
 * encryption detection, reading compressed object streams where needed.
 */

export function isPdf(bytes: Uint8Array): boolean {
  return Buffer.from(bytes.subarray(0, 1024)).toString("latin1").includes("%PDF-");
}

export function isEncryptedPdf(bytes: Buffer): boolean {
  return /\/Encrypt\s/.test(bytes.toString("latin1"));
}

/** The dictionary part of an object (before any stream data). */
function dictionaryOf(objectText: string): string {
  const streamAt = objectText.search(/\bstream\b/);
  return streamAt === -1 ? objectText : objectText.slice(0, streamAt);
}

/** Text of every object, including objects packed inside compressed object streams. */
function objectTexts(bytes: Buffer): string[] {
  const raw = bytes.toString("latin1");
  const texts: string[] = [];
  const objectPattern = /\d+\s+\d+\s+obj\b([\s\S]*?)endobj/g;
  let match: RegExpExecArray | null;

  while ((match = objectPattern.exec(raw))) {
    const body = match[1];
    texts.push(dictionaryOf(body));

    if (!/\/Type\s*\/ObjStm\b/.test(dictionaryOf(body))) continue;
    const dict = dictionaryOf(body);
    const first = Number(/\/First\s+(\d+)/.exec(dict)?.[1]);
    const n = Number(/\/N\s+(\d+)/.exec(dict)?.[1]);
    const streamMatch = /stream\r?\n/.exec(body);
    if (!streamMatch || !Number.isFinite(first) || !Number.isFinite(n)) continue;

    const startInRaw = match.index + match[0].indexOf(body) + streamMatch.index + streamMatch[0].length;
    const endInRaw = raw.indexOf("endstream", startInRaw);
    if (endInRaw === -1) continue;
    let decoded: string;
    try {
      decoded = inflateSync(bytes.subarray(startInRaw, endInRaw), { maxOutputLength: 20 * 1024 * 1024 }).toString("latin1");
    } catch {
      continue;
    }

    const header = decoded.slice(0, first).trim().split(/\s+/).map(Number);
    for (let i = 0; i < n; i++) {
      const start = first + header[i * 2 + 1];
      const end = i + 1 < n ? first + header[(i + 1) * 2 + 1] : decoded.length;
      if (Number.isFinite(start) && Number.isFinite(end)) texts.push(decoded.slice(start, end));
    }
  }
  return texts;
}

/**
 * Number of pages, taken from the largest /Count of the page tree, or null if
 * it can't be determined.
 */
export function countPdfPages(bytes: Buffer): number | null {
  let max: number | null = null;
  for (const text of objectTexts(bytes)) {
    if (!/\/Type\s*\/Pages\b/.test(text)) continue;
    const count = Number(/\/Count\s+(\d+)/.exec(text)?.[1]);
    if (Number.isFinite(count) && (max === null || count > max)) max = count;
  }
  return max;
}
