import { attributes, decodeXml } from "@/lib/documents/xml";
import { listZipEntries, readZipText } from "@/lib/documents/zip";

/**
 * Converts an .xlsx workbook into plain CSV text per sheet, for sending to the
 * model. Reads cached cell values (not formulas) and renders date-formatted
 * numbers as ISO dates.
 */

export type SheetText = { name: string; csv: string; rows: number; truncated: boolean };

export const MAX_ROWS_PER_SHEET = 2000;
export const MAX_COLUMNS = 60;

// Built-in Excel number formats that display dates/times.
const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function allText(xml: string): string {
  // Concatenates every <t> run, skipping phonetic hints.
  return [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
    .map((m) => decodeXml(m[1]))
    .join("");
}

function sharedStrings(xml: string | null): string[] {
  if (!xml) return [];
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g)].map((m) => (m[1] ? allText(m[1]) : ""));
}

/** Style index -> whether that cell style displays a date. */
function dateStyles(xml: string | null): boolean[] {
  if (!xml) return [];
  const customDate = new Set<number>();
  for (const m of xml.matchAll(/<numFmt\b([^>]*)\/?>/g)) {
    const a = attributes(m[1]);
    const code = (a.formatCode ?? "").replace(/"[^"]*"|\[[^\]]*\]|\\./g, "");
    if (/[dmyhs]/i.test(code)) customDate.add(Number(a.numFmtId));
  }
  const cellXfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml)?.[1] ?? "";
  return [...cellXfs.matchAll(/<xf\b([^>]*)\/?>/g)].map((m) => {
    const id = Number(attributes(m[1]).numFmtId ?? 0);
    return BUILTIN_DATE_FORMATS.has(id) || customDate.has(id);
  });
}

function serialToIsoDate(serial: number): string {
  // Excel's 1900 date system (with its 1900 leap-year bug) via the 1899-12-30 epoch.
  const ms = Math.round((serial - 0) * 86400000) + Date.UTC(1899, 11, 30);
  const iso = new Date(ms).toISOString();
  return serial % 1 === 0 ? iso.slice(0, 10) : iso.slice(0, 19).replace("T", " ");
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function resolveTarget(target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  return `xl/${target}`.replace(/\/\.\//g, "/");
}

export function xlsxToSheets(bytes: Buffer): SheetText[] {
  const entries = listZipEntries(bytes);
  const workbook = readZipText(bytes, entries, "xl/workbook.xml");
  if (!workbook) throw new Error("Not an Excel workbook (xl/workbook.xml missing)");

  const rels = readZipText(bytes, entries, "xl/_rels/workbook.xml.rels") ?? "";
  const targets = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const a = attributes(m[1]);
    if (a.Id && a.Target) targets.set(a.Id, resolveTarget(a.Target));
  }

  const strings = sharedStrings(readZipText(bytes, entries, "xl/sharedStrings.xml"));
  const isDateStyle = dateStyles(readZipText(bytes, entries, "xl/styles.xml"));
  const sheets: SheetText[] = [];

  for (const m of workbook.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const a = attributes(m[1]);
    const relId = a["r:id"] ?? Object.entries(a).find(([k]) => k.endsWith(":id"))?.[1];
    const path = relId ? targets.get(relId) : undefined;
    const xml = path ? readZipText(bytes, entries, path) : null;
    if (!xml) continue;

    const grid: string[][] = [];
    let totalRows = 0;
    for (const row of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      totalRows++;
      if (grid.length >= MAX_ROWS_PER_SHEET) continue;
      const cells: string[] = [];
      for (const c of (row[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ca = attributes(c[1]);
        const inner = c[2] ?? "";
        const col = ca.r ? columnIndex(ca.r) : cells.length;
        if (col >= MAX_COLUMNS) continue;
        const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(inner)?.[1];
        let value = "";
        switch (ca.t) {
          case "s":
            value = strings[Number(v)] ?? "";
            break;
          case "inlineStr":
            value = allText(inner);
            break;
          case "b":
            value = v === "1" ? "TRUE" : "FALSE";
            break;
          case "str":
          case "e":
            value = v !== undefined ? decodeXml(v) : "";
            break;
          default:
            if (v !== undefined) {
              const num = Number(v);
              value = isDateStyle[Number(ca.s ?? 0)] && Number.isFinite(num) ? serialToIsoDate(num) : v;
            }
        }
        cells[col] = value;
      }
      grid.push(Array.from({ length: cells.length }, (_, i) => cells[i] ?? ""));
    }

    // Drop trailing empty rows.
    while (grid.length && grid[grid.length - 1].every((v) => v === "")) grid.pop();
    // Pad rows to the same width so columns line up.
    const width = Math.max(0, ...grid.map((r) => r.length));
    sheets.push({
      name: a.name ?? `Sheet${sheets.length + 1}`,
      csv: grid.map((r) => Array.from({ length: width }, (_, i) => csvCell(r[i] ?? "")).join(",")).join("\n"),
      rows: totalRows,
      truncated: totalRows > MAX_ROWS_PER_SHEET,
    });
  }
  return sheets;
}
