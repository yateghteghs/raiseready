import { describe, expect, it } from "vitest";

import { faqSchema, groupBySection } from "@/lib/faq/service";

describe("FAQ", () => {
  it("groups entries into sections in display order", () => {
    const sections = groupBySection([
      { id: "3", category: "Pricing", question: "c", answer: "", position: 30 },
      { id: "1", category: "Start", question: "a", answer: "", position: 10 },
      { id: "2", category: "Start", question: "b", answer: "", position: 20 },
    ]);
    expect(sections.map((s) => s.category)).toEqual(["Start", "Pricing"]);
    expect(sections[0].items.map((i) => i.question)).toEqual(["a", "b"]);
  });

  it("validates entries from the admin form", () => {
    const ok = faqSchema.parse({ locale: "fr", category: " Démarrer ", question: "Q ?", answer: "R.", position: "", published: "on" });
    expect(ok).toMatchObject({ locale: "fr", category: "Démarrer", position: 0, published: true });
    expect(faqSchema.safeParse({ locale: "de", category: "x", question: "q", answer: "a", position: "1" }).success).toBe(false);
    expect(faqSchema.safeParse({ locale: "en", category: "x", question: "", answer: "a", position: "1" }).success).toBe(false);
  });
});
