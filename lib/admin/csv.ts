/**
 * CSV for admin exports. Cells that a spreadsheet would run as a formula
 * (starting with = + - @ or a tab/CR) are prefixed with an apostrophe, so an
 * exported name like "=HYPERLINK(...)" stays plain text.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = typeof value === "string" ? value : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<T>(rows: T[], columns: { header: string; value: (row: T) => unknown }[]): string {
  const lines = [columns.map((c) => csvCell(c.header)).join(",")];
  for (const row of rows) lines.push(columns.map((c) => csvCell(c.value(row))).join(","));
  // Byte-order mark so Excel opens UTF-8 (₦, accented names) correctly.
  return `﻿${lines.join("\r\n")}\r\n`;
}
