import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { PlanLimitError } from "@/lib/billing/limits";
import { renderDeckPdf } from "@/lib/decks/pdf";
import { renderDeckPptx } from "@/lib/decks/pptx";
import { DeckError, deckForDownload } from "@/lib/decks/service";
import { imageBytes } from "@/lib/images/service";

export const maxDuration = 60;

const FORMATS = {
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  pdf: "application/pdf",
} as const;

/** The deck as a PowerPoint or PDF file, built on request. Only the owner, only unlocked decks. */
export async function GET(request: Request, ctx: RouteContext<"/app/decks/[deckId]/download">) {
  const { deckId } = await ctx.params;
  const format = new URL(request.url).searchParams.get("format") === "pdf" ? "pdf" : "pptx";
  if (!z.uuid().safeParse(deckId).success) return new Response("Not found", { status: 404 });
  const user = await getCurrentUser();
  if (!user) return new Response("Please log in again.", { status: 401 });

  try {
    const { content, startupName, logoPath } = await deckForDownload(user.id, deckId);
    const logo = await imageBytes(user.id, logoPath);
    const bytes =
      format === "pdf"
        ? await renderDeckPdf(content, { startupName, logo })
        : await renderDeckPptx(content, { startupName, logo });
    const name = `${startupName.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "pitch"}-deck.${format}`;
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": FORMATS[format],
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof PlanLimitError) return new Response(error.message, { status: 402 });
    if (error instanceof DeckError) return new Response(error.message, { status: 404 });
    throw error;
  }
}
