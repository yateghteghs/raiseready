import { readFileSync } from "node:fs";
import path from "node:path";

import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { checkDeck, checkSlide, SLIDE_KINDS, unsupportedNumbers, type Deck, type Slide } from "@/lib/ai/schemas/deck";

import { createFakeDb } from "../../test/fake-supabase";

const fake = createFakeDb();
const db = fake.tables;
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fake.client }));
vi.mock("@/lib/ai/usage", () => ({ withinRateLimit: async () => true }));

class FakeAiError extends Error {
  constructor(
    message: string,
    readonly userMessage: string,
  ) {
    super(message);
  }
}
const callStructured = vi.fn();
vi.mock("@/lib/ai/structured", () => ({ callStructured: (o: never) => callStructured(o), AiCallError: FakeAiError }));

const { buildDeck, unlockDeck, editSlide, rewriteSlide, deckContent, visibleSlideCount, deckForDownload, getDeckUsage } = await import(
  "@/lib/decks/service"
);
const { renderDeckPptx, runsWithPlaceholders } = await import("@/lib/decks/pptx");
const { renderDeckPdf } = await import("@/lib/decks/pdf");

const slide = (kind: Slide["kind"], over: Partial<Slide> = {}): Slide => ({
  kind,
  title: `${kind} headline`,
  bullets: ["A first point", "[Add: monthly revenue for the last 6 months]"],
  notes: "Say this.",
  missing: [],
  visual: null,
  ...over,
});
const sampleDeck = (): Deck => ({
  title: "Kora",
  tagline: "Cold storage for market traders",
  slides: SLIDE_KINDS.map((k) => slide(k, k === "traction" ? { bullets: ["1,200 paying traders"] } : {})),
});

const startup = { id: "s1", owner_id: "u1", name: "Kora", customers_count: 1200, logo_path: null };

function reset(over: Record<string, unknown> = {}) {
  for (const k of Object.keys(db)) delete db[k];
  db.profiles = [{ id: "u1", plan: "free", credits: 0, deck_credits: 0, ...over }];
  db.subscriptions = [];
  db.pitch_decks = [];
  db.knowledge_profiles = [];
  db.assessments = [];
  db.startups = [startup];
  callStructured.mockReset();
  callStructured.mockImplementation(async (opts: { check?: (o: unknown) => string[]; purpose: string }) => {
    const output = opts.purpose === "deck" ? sampleDeck() : slide("traction", { title: "Rewritten", bullets: ["1,200 paying traders"] });
    expect(opts.check?.(output)).toEqual([]);
    return output;
  });
}

describe("deck checks", () => {
  it("flags numbers that aren't in the founder's material", () => {
    const material = 'customers_count: 1200, revenue "₦4,500,000" in 2025';
    expect(unsupportedNumbers("We serve 1,200 traders and made ₦4,500,000, or ₦72m", material)).toEqual(["72"]);
    expect(unsupportedNumbers("Founded 2021, top 3 in Lagos, [Add: CAC 4500]", material)).toEqual([]);
    expect(unsupportedNumbers("Growing 300% a month", material)).toEqual(["300"]);
  });

  it("requires a title first, the ask last and no invented figures", () => {
    expect(checkDeck(sampleDeck(), "1200")).toEqual([]);
    const bad = sampleDeck();
    bad.slides.reverse();
    bad.slides[3].bullets = ["Market of 9,000,000 traders"];
    const problems = checkDeck(bad, "1200").join(" ");
    expect(problems).toMatch(/first slide must be the title/);
    expect(problems).toMatch(/last slide must be the ask/);
    expect(problems).toMatch(/9,000,000/);
    expect(checkSlide(slide("market"), "team", "")).toContain('Keep the slide kind as "team".');
  });

  it("picks out placeholders for the slides", () => {
    const runs = runsWithPlaceholders("Revenue: [Add: monthly revenue] so far");
    expect(runs.map((r) => r.text)).toEqual(["Revenue: ", "[Add: monthly revenue]", " so far"]);
    expect(runs[1].options).toMatchObject({ bold: true });
  });
});

describe("exports", () => {
  const logo = readFileSync(path.join(process.cwd(), "lib/reports/assets/indexprima-logo.png"));

  it("writes an editable PowerPoint with speaker notes", async () => {
    const bytes = await renderDeckPptx(sampleDeck(), { startupName: "Kora", logo });
    const zip = await JSZip.loadAsync(bytes);
    const slides = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
    expect(slides).toHaveLength(SLIDE_KINDS.length);
    const traction = await zip.file(`ppt/slides/slide${SLIDE_KINDS.indexOf("traction") + 1}.xml`)!.async("string");
    expect(traction).toContain("1,200 paying traders");
    const notes = Object.keys(zip.files).filter((f) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(f));
    expect(notes.length).toBe(SLIDE_KINDS.length);
    expect(Object.keys(zip.files).some((f) => f.startsWith("ppt/media/"))).toBe(true);
  });

  it("writes a PDF with one page per slide", async () => {
    const pdf = await renderDeckPdf(sampleDeck(), { startupName: "Kora", logo });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.toString("latin1").match(/\/Type \/Page\b/g)?.length).toBe(SLIDE_KINDS.length);
  }, 20_000);
});

describe("building decks", () => {
  beforeEach(() => reset());

  it("gives a founder's first deck as a free preview showing the first slides", async () => {
    const id = await buildDeck("u1", startup as never);
    const row = db.pitch_decks.find((d) => d.id === id)!;
    expect(row).toMatchObject({ status: "ready", access: "preview", unlocked_at: null });
    expect(visibleSlideCount(row as never, deckContent(row as never)!.slides.length)).toBe(3);
    await expect(deckForDownload("u1", id)).rejects.toThrow(/Unlock/);
    await expect(rewriteSlide("u1", id, 0, "Shorter")).rejects.toThrow(/Unlock/);
    await expect(buildDeck("u1", startup as never)).rejects.toThrow(/Pro|buy/i);
  });

  it("lets founders edit the slides they can see, and no others", async () => {
    const id = await buildDeck("u1", startup as never);
    await editSlide("u1", id, 1, { title: "New problem", bullets: ["One", "Two"], notes: "N" });
    expect(deckContent(db.pitch_decks[0] as never)!.slides[1]).toMatchObject({ title: "New problem", bullets: ["One", "Two"] });
    await expect(editSlide("u1", id, 5, { title: "x", bullets: [], notes: "" })).rejects.toThrow(/isn't available/);
    await expect(editSlide("someone-else", id, 1, { title: "x", bullets: [], notes: "" })).rejects.toThrow(/doesn't exist/);
  });

  it("unlocks a preview with a bought deck, without writing it again", async () => {
    const id = await buildDeck("u1", startup as never);
    db.profiles[0].deck_credits = 1;
    await unlockDeck("u1", id);
    expect(db.pitch_decks[0]).toMatchObject({ access: "credit" });
    expect(db.profiles[0].deck_credits).toBe(0);
    expect(callStructured).toHaveBeenCalledTimes(1);
    await unlockDeck("u1", id);
    expect(db.profiles[0].deck_credits).toBe(0);
    expect((await deckForDownload("u1", id)).content.slides).toHaveLength(SLIDE_KINDS.length);
  });

  it("spends a bought deck, and refunds it if writing fails", async () => {
    reset({ deck_credits: 1 });
    callStructured.mockRejectedValueOnce(new FakeAiError("bad", "We couldn't write your deck. Please try again."));
    const id = await buildDeck("u1", startup as never);
    expect(db.pitch_decks.find((d) => d.id === id)).toMatchObject({ status: "failed", error: expect.stringMatching(/try again/) });
    expect(db.profiles[0].deck_credits).toBe(1);
    // A failed deck doesn't use up the free preview either.
    expect((await getDeckUsage("u1")).previewsUsed).toBe(0);

    const second = await buildDeck("u1", startup as never);
    expect(db.pitch_decks.find((d) => d.id === second)).toMatchObject({ status: "ready", access: "credit" });
    expect(db.profiles[0].deck_credits).toBe(0);
  });

  it("allows two AI rewrites on a bought deck", async () => {
    reset({ deck_credits: 1 });
    const id = await buildDeck("u1", startup as never);
    const traction = SLIDE_KINDS.indexOf("traction");
    expect((await rewriteSlide("u1", id, traction, "Lead with the customer number")).title).toBe("Rewritten");
    await rewriteSlide("u1", id, traction, "Shorter");
    await expect(rewriteSlide("u1", id, traction, "Again")).rejects.toThrow(/used the 2 AI rewrites/);
    expect(db.pitch_decks[0].rewrites_used).toBe(2);
  });

  it("gives Pro three full decks a month", async () => {
    reset({ plan: "pro" });
    for (let i = 0; i < 3; i++) await buildDeck("u1", startup as never);
    expect(db.pitch_decks.map((d) => d.access)).toEqual(["pro", "pro", "pro"]);
    await expect(buildDeck("u1", startup as never)).rejects.toThrow(/used the 3 decks/);
  });
});
