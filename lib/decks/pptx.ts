import PptxGenJS from "pptxgenjs";

import { PLACEHOLDER, SLIDE_LABELS, type Deck, type Slide } from "@/lib/ai/schemas/deck";
import { imageDimensions, validateImage } from "@/lib/images/rules";

const GREEN = "0B6E4F";
const INK = "111827";
const MUTED = "5B6472";
const AMBER = "B45309";
const PANEL = "F3F5F7";

// 16:9, in inches.
const W = 13.333;
const H = 7.5;

type Run = { text: string; options?: PptxGenJS.TextPropsOptions };

/** A line of text with any "[Add: ...]" placeholders picked out in amber. */
export function runsWithPlaceholders(text: string, base: PptxGenJS.TextPropsOptions = {}): Run[] {
  const runs: Run[] = [];
  let last = 0;
  for (const match of text.matchAll(PLACEHOLDER)) {
    if (match.index > last) runs.push({ text: text.slice(last, match.index), options: { ...base } });
    runs.push({ text: match[0], options: { ...base, color: AMBER, bold: true } });
    last = match.index + match[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last), options: { ...base } });
  return runs.length ? runs : [{ text, options: { ...base } }];
}

function logoImage(logo: Uint8Array | null, box: { x: number; y: number; w: number; h: number }): PptxGenJS.ImageProps | null {
  if (!logo) return null;
  const check = validateImage(logo);
  const size = imageDimensions(logo);
  if (!check.ok || !size) return null;
  const scale = Math.min(box.w / size.width, box.h / size.height);
  const w = size.width * scale;
  const h = size.height * scale;
  return { data: `${check.mime};base64,${Buffer.from(logo).toString("base64")}`, x: box.x, y: box.y + (box.h - h) / 2, w, h };
}

function notesFor(slide: Slide): string {
  const missing = slide.missing.length ? `\n\nStill to add:\n${slide.missing.map((m) => `- ${m}`).join("\n")}` : "";
  return `${slide.notes}${missing}`;
}

function footer(s: PptxGenJS.Slide, startupName: string, n: number) {
  s.addText(startupName, { x: 0.6, y: H - 0.55, w: 6, h: 0.3, fontSize: 10, color: MUTED });
  s.addText(String(n), { x: W - 1.6, y: H - 0.55, w: 1, h: 0.3, fontSize: 10, color: MUTED, align: "right" });
}

function titleSlide(pptx: PptxGenJS, deck: Deck, slide: Slide, logo: Uint8Array | null) {
  const s = pptx.addSlide();
  s.background = { color: "FFFFFF" };
  s.addShape("rect", { x: 0, y: 0, w: 0.25, h: H, fill: { color: GREEN }, line: { color: GREEN } });
  const image = logoImage(logo, { x: 0.9, y: 0.8, w: 2.6, h: 1.2 });
  if (image) s.addImage(image);
  s.addText(runsWithPlaceholders(slide.title || deck.title, { fontSize: 44, bold: true, color: INK }), {
    x: 0.9,
    y: 2.6,
    w: W - 1.8,
    h: 1.4,
    valign: "bottom",
  });
  s.addText(runsWithPlaceholders(deck.tagline, { fontSize: 22, color: MUTED }), { x: 0.9, y: 4.1, w: W - 1.8, h: 1 });
  if (slide.bullets.length) {
    s.addText(runsWithPlaceholders(slide.bullets.join("   ·   "), { fontSize: 14, color: MUTED }), { x: 0.9, y: 5.4, w: W - 1.8, h: 0.6 });
  }
  s.addNotes(notesFor(slide));
}

function contentSlide(pptx: PptxGenJS, slide: Slide, startupName: string, n: number) {
  const s = pptx.addSlide();
  s.background = { color: "FFFFFF" };
  s.addShape("rect", { x: 0, y: 0, w: W, h: 0.12, fill: { color: GREEN }, line: { color: GREEN } });
  s.addText(SLIDE_LABELS[slide.kind].toUpperCase(), { x: 0.6, y: 0.4, w: 6, h: 0.35, fontSize: 12, bold: true, color: GREEN, charSpacing: 2 });
  s.addText(runsWithPlaceholders(slide.title, { fontSize: 30, bold: true, color: INK }), { x: 0.6, y: 0.8, w: W - 1.2, h: 1.3, valign: "top" });

  const hasVisual = Boolean(slide.visual);
  const bulletsW = hasVisual ? 7.4 : W - 1.2;
  const paragraphs = slide.bullets.flatMap((b, i) =>
    runsWithPlaceholders(b, { fontSize: 20, color: INK }).map((run, j, all) => ({
      text: run.text,
      options: {
        ...run.options,
        // The first run of each point carries the bullet; the last ends the paragraph.
        ...(j === 0 ? { bullet: { indent: 18 }, paraSpaceBefore: i ? 10 : 0 } : {}),
        ...(j === all.length - 1 ? { breakLine: true } : {}),
      },
    })),
  );
  if (paragraphs.length) s.addText(paragraphs, { x: 0.6, y: 2.25, w: bulletsW, h: H - 3.1, valign: "top" });

  if (hasVisual) {
    s.addShape("roundRect", { x: 8.4, y: 2.25, w: 4.3, h: H - 3.1, fill: { color: PANEL }, line: { color: "E3E6EA" }, rectRadius: 0.1 });
    s.addText(
      [
        { text: "Suggested visual", options: { fontSize: 12, bold: true, color: MUTED, breakLine: true } },
        { text: slide.visual ?? "", options: { fontSize: 14, color: INK } },
      ],
      { x: 8.7, y: 2.5, w: 3.7, h: H - 3.6, valign: "top" },
    );
  }
  footer(s, startupName, n);
  s.addNotes(notesFor(slide));
}

/** The deck as an editable PowerPoint file. */
export async function renderDeckPptx(deck: Deck, options: { startupName: string; logo: Uint8Array | null }): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = deck.title;
  pptx.company = options.startupName;
  pptx.theme = { headFontFace: "Arial", bodyFontFace: "Arial" };
  deck.slides.forEach((slide, i) => {
    if (slide.kind === "title") titleSlide(pptx, deck, slide, options.logo);
    else contentSlide(pptx, slide, options.startupName, i + 1);
  });
  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}
