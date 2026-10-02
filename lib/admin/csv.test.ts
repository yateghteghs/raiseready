import { describe, expect, it } from "vitest";

import { csvCell, toCsv } from "@/lib/admin/csv";

describe("CSV export", () => {
  it("quotes commas, quotes and new lines", () => {
    expect(csvCell("Kolo, Ltd")).toBe('"Kolo, Ltd"');
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(42)).toBe("42");
  });

  it("stops spreadsheet formulas from running", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe("\"'=HYPERLINK(\"\"http://evil\"\")\"");
    expect(csvCell("+234 800")).toBe("'+234 800");
    expect(csvCell("-5")).toBe("'-5");
    expect(csvCell("@sum")).toBe("'@sum");
  });

  it("builds a header row and one row per record, with a BOM for Excel", () => {
    const csv = toCsv([{ n: "Ada", s: 70 }], [
      { header: "Name", value: (r) => r.n },
      { header: "Score", value: (r) => r.s },
    ]);
    expect(csv).toBe("﻿Name,Score\r\nAda,70\r\n");
  });
});
