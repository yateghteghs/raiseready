import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { validateDocument } from "@/lib/documents/rules";

const fixture = (name: string) => readFileSync(`test/fixtures/${name}`);

describe("validateDocument", () => {
  it("accepts a PDF deck and reports its pages", () => {
    expect(validateDocument(fixture("deck.pdf"), "pitch_deck")).toEqual({ ok: true, type: "pdf", pages: 3 });
  });

  it("rejects a deck over the page limit", () => {
    const r = validateDocument(fixture("long.pdf"), "pitch_deck");
    expect(r).toMatchObject({ ok: false, message: expect.stringMatching(/45 pages.*40/) });
  });

  it("allows longer business plans", () => {
    expect(validateDocument(fixture("long.pdf"), "business_plan")).toMatchObject({ ok: true, pages: 45 });
  });

  it("rejects the wrong type for the slot, judged by content", () => {
    expect(validateDocument(fixture("plan-renamed.pdf"), "pitch_deck")).toMatchObject({
      ok: false,
      message: expect.stringMatching(/Word document/),
    });
    expect(validateDocument(fixture("deck.pdf"), "financial_model")).toMatchObject({ ok: false });
  });

  it("accepts spreadsheets and Word plans in their slots", () => {
    expect(validateDocument(fixture("model.xlsx"), "financial_model")).toMatchObject({ ok: true, type: "xlsx" });
    expect(validateDocument(fixture("plan.docx"), "business_plan")).toMatchObject({ ok: true, type: "docx" });
  });

  it("rejects unreadable and oversized files", () => {
    expect(validateDocument(fixture("fake.pdf"), "pitch_deck")).toMatchObject({ ok: false });
    expect(validateDocument(Buffer.alloc(21 * 1024 * 1024, 0x25), "pitch_deck")).toMatchObject({
      ok: false,
      message: expect.stringMatching(/20 MB/),
    });
  });
});
