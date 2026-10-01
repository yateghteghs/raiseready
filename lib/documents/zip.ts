import { inflateRawSync } from "node:zlib";

/**
 * Minimal, read-only ZIP reader for validating and reading .xlsx/.docx files.
 * Enforces size limits on every entry so a crafted archive (zip bomb) can't
 * exhaust memory.
 */

export type ZipEntry = {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

export class ZipError extends Error {}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

/** Per-entry and whole-archive limits on uncompressed size. */
export const MAX_ENTRY_BYTES = 50 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 150 * 1024 * 1024;
const MAX_ENTRIES = 5000;

export function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

export function listZipEntries(bytes: Buffer): ZipEntry[] {
  // The end-of-central-directory record sits in the last 22 + 65535 bytes.
  const searchStart = Math.max(0, bytes.length - 22 - 0xffff);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= searchStart; i--) {
    if (bytes.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new ZipError("Not a valid zip archive");

  const count = bytes.readUInt16LE(eocd + 10);
  const cdOffset = bytes.readUInt32LE(eocd + 16);
  if (count === 0xffff || cdOffset === 0xffffffff) throw new ZipError("ZIP64 archives are not supported");
  if (count > MAX_ENTRIES) throw new ZipError("Archive has too many entries");

  const entries: ZipEntry[] = [];
  let total = 0;
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (p + 46 > bytes.length || bytes.readUInt32LE(p) !== CENTRAL_SIGNATURE) {
      throw new ZipError("Corrupt zip central directory");
    }
    const method = bytes.readUInt16LE(p + 10);
    const compressedSize = bytes.readUInt32LE(p + 20);
    const uncompressedSize = bytes.readUInt32LE(p + 24);
    const nameLength = bytes.readUInt16LE(p + 28);
    const extraLength = bytes.readUInt16LE(p + 30);
    const commentLength = bytes.readUInt16LE(p + 32);
    const localHeaderOffset = bytes.readUInt32LE(p + 42);
    const name = bytes.toString("utf8", p + 46, p + 46 + nameLength);

    if (uncompressedSize > MAX_ENTRY_BYTES) throw new ZipError("Archive entry is too large");
    total += uncompressedSize;
    if (total > MAX_TOTAL_BYTES) throw new ZipError("Archive expands to more than the allowed size");

    entries.push({ name, method, compressedSize, uncompressedSize, localHeaderOffset });
    p += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

export function readZipEntry(bytes: Buffer, entry: ZipEntry): Buffer {
  const p = entry.localHeaderOffset;
  if (p + 30 > bytes.length || bytes.readUInt32LE(p) !== LOCAL_SIGNATURE) {
    throw new ZipError(`Corrupt zip entry: ${entry.name}`);
  }
  const start = p + 30 + bytes.readUInt16LE(p + 26) + bytes.readUInt16LE(p + 28);
  const data = bytes.subarray(start, start + entry.compressedSize);

  if (entry.method === 0) return Buffer.from(data);
  if (entry.method === 8) {
    // maxOutputLength guards against entries that lie about their size.
    return inflateRawSync(data, { maxOutputLength: Math.min(entry.uncompressedSize, MAX_ENTRY_BYTES) || 1 });
  }
  throw new ZipError(`Unsupported compression method in ${entry.name}`);
}

/** Reads a named entry as UTF-8 text, or null if the archive doesn't contain it. */
export function readZipText(bytes: Buffer, entries: ZipEntry[], name: string): string | null {
  const entry = entries.find((e) => e.name === name);
  return entry ? readZipEntry(bytes, entry).toString("utf8") : null;
}
