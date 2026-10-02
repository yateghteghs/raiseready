import { z } from "zod";

/** The slides of a standard investor pitch deck, in order. */
export const SLIDE_KINDS = [
  "title",
  "problem",
  "solution",
  "product",
  "market",
  "business_model",
  "traction",
  "competition",
  "go_to_market",
  "team",
  "financials",
  "ask",
] as const;
export type SlideKind = (typeof SLIDE_KINDS)[number];

export const SLIDE_LABELS: Record<SlideKind, string> = {
  title: "Title",
  problem: "Problem",
  solution: "Solution",
  product: "Product",
  market: "Market",
  business_model: "Business model",
  traction: "Traction",
  competition: "Competition",
  go_to_market: "Go-to-market",
  team: "Team",
  financials: "Financials",
  ask: "The ask",
};

/** Text the founder must fill in is written like this, so it stands out on the slide. */
export const PLACEHOLDER = /\[Add:[^\]]*\]/g;

export const slideSchema = z.object({
  kind: z.enum(SLIDE_KINDS),
  title: z.string().describe("The slide headline: a short claim, not just a label. Under 80 characters."),
  bullets: z
    .array(z.string())
    .describe("Two to five short points (under 140 characters each). Use [Add: what is needed] where a fact is missing."),
  notes: z.string().describe("Speaker notes: what the founder should say on this slide, in two to four sentences."),
  missing: z
    .array(z.string())
    .describe("Facts the founder must supply for this slide, in plain words. Empty if nothing is missing."),
  visual: z.string().nullable().describe('A suggested chart, photo or diagram, e.g. "Bar chart of monthly revenue". Null if none.'),
});
export type Slide = z.infer<typeof slideSchema>;

export const deckSchema = z.object({
  title: z.string().describe("The startup's name."),
  tagline: z.string().describe("One line on what the startup does, under 100 characters."),
  slides: z.array(slideSchema).describe("The slides in order, one per kind, starting with title and ending with ask."),
});
export type Deck = z.infer<typeof deckSchema>;

const YEAR = /^(19[89]\d|20[0-4]\d)$/;

/**
 * Numbers in the text that don't appear in the material. Digits are compared
 * without separators, so "₦1,200,000" matches "1200000". Placeholders and
 * small counts (under 10) and years are ignored.
 */
export function unsupportedNumbers(text: string, material: string): string[] {
  const known = material.replace(/[,\s]/g, "");
  const found = text.replace(PLACEHOLDER, "").match(/\d[\d,.]*/g) ?? [];
  const bad = new Set<string>();
  for (const token of found) {
    const digits = token.replace(/[,.]+$/, "").replace(/,/g, "");
    if (!digits || YEAR.test(digits) || Number(digits) < 10) continue;
    if (!known.includes(digits)) bad.add(token.replace(/[,.]+$/, ""));
  }
  return [...bad];
}

function slideText(s: Slide): string {
  return [s.title, ...s.bullets, s.notes].join("\n");
}

function slideProblems(s: Slide, label: string, material: string): string[] {
  const problems: string[] = [];
  if (!s.title.trim()) problems.push(`${label}: the title is empty.`);
  if (s.title.length > 100) problems.push(`${label}: shorten the title to under 80 characters.`);
  if (s.kind !== "title" && (s.bullets.length < 1 || s.bullets.length > 6)) problems.push(`${label}: give two to five bullets.`);
  if (s.bullets.some((b) => b.length > 200)) problems.push(`${label}: shorten bullets to under 140 characters.`);
  const numbers = unsupportedNumbers(slideText(s), material);
  if (numbers.length) {
    problems.push(
      `${label}: ${numbers.join(", ")} ${numbers.length === 1 ? "is" : "are"} not in the founder's material. Use only numbers from the material, or write [Add: ...] instead.`,
    );
  }
  return problems;
}

export function checkDeck(deck: Deck, material: string): string[] {
  const problems: string[] = [];
  const kinds = deck.slides.map((s) => s.kind);
  if (deck.slides.length < 8 || deck.slides.length > SLIDE_KINDS.length) problems.push(`Give between 8 and ${SLIDE_KINDS.length} slides.`);
  if (kinds[0] !== "title") problems.push("The first slide must be the title slide.");
  if (kinds.at(-1) !== "ask") problems.push("The last slide must be the ask.");
  if (new Set(kinds).size !== kinds.length) problems.push("Use each slide kind at most once.");
  deck.slides.forEach((s, i) => problems.push(...slideProblems(s, `Slide ${i + 1} (${s.kind})`, material)));
  return problems;
}

export function checkSlide(slide: Slide, kind: SlideKind, material: string): string[] {
  const problems = slideProblems(slide, "The slide", material);
  if (slide.kind !== kind) problems.unshift(`Keep the slide kind as "${kind}".`);
  return problems;
}
