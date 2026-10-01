import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { docxToText } from "@/lib/documents/docx";
import { countPdfPages, isEncryptedPdf } from "@/lib/documents/pdf";
import { detectFileType } from "@/lib/documents/sniff";
import { xlsxToSheets } from "@/lib/documents/xlsx";

const fixture = (name: string) => readFileSync(`test/fixtures/${name}`);

describe("detectFileType", () => {
  it.each([
    ["deck.pdf", "pdf"],
    ["model.xlsx", "xlsx"],
    ["plan.docx", "docx"],
  ])("recognises %s by content", (name, type) => {
    expect(detectFileType(fixture(name))).toBe(type);
  });

  it("ignores the file name: a Word file named .pdf is still Word", () => {
    expect(detectFileType(fixture("plan-renamed.pdf"))).toBe("docx");
  });

  it("rejects files that only pretend to be PDFs", () => {
    expect(detectFileType(fixture("fake.pdf"))).toBeNull();
    expect(detectFileType(Buffer.from("PK\u0003\u0004 truncated zip"))).toBeNull();
  });
});

describe("countPdfPages", () => {
  it("counts pages in a plain PDF", () => {
    expect(countPdfPages(fixture("deck.pdf"))).toBe(3);
  });

  it("counts pages when objects are inside compressed object streams", () => {
    expect(countPdfPages(fixture("deck-objstm.pdf"))).toBe(3);
  });

  it("counts long documents", () => {
    expect(countPdfPages(fixture("long.pdf"))).toBe(45);
  });

  it("detects no encryption in normal files", () => {
    expect(isEncryptedPdf(fixture("deck.pdf"))).toBe(false);
  });
});

describe("xlsxToSheets", () => {
  it("reads every sheet as CSV with values, dates and quoting", () => {
    const sheets = xlsxToSheets(fixture("model.xlsx"));
    expect(sheets.map((s) => s.name)).toEqual(["Revenue", "Costs & Burn"]);
    expect(sheets[0].csv.split("\n")).toEqual([
      // Column E holds a formula with no cached value, so it is empty.
      "Month,Revenue (NGN),Merchants,Note,",
      '2026-01-01,3400000,950,"Launch, ""Ikeja""",',
      "2026-02-01,3900000,1080,,",
      "2026-03-01,4500000,1200,Q1 close,",
    ]);
    expect(sheets[1].csv).toContain("Burn,1800000");
  });
});

describe("docxToText", () => {
  it("extracts paragraphs", async () => {
    const text = await docxToText(fixture("plan.docx"));
    expect(text).toContain("We serve 1,200 market traders in Lagos.");
  });
});
