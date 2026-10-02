import { z } from "zod";

import { DECK_PROMPT_VERSION, DECK_SYSTEM_PROMPT, SLIDE_REWRITE_SYSTEM_PROMPT } from "@/lib/ai/prompts/deck.v1";
import { escapeDelimiters } from "@/lib/ai/prompts/extraction.v1";
import { checkDeck, checkSlide, deckSchema, slideSchema, type Deck, type Slide } from "@/lib/ai/schemas/deck";
import { AiCallError, callStructured } from "@/lib/ai/structured";
import { withinRateLimit } from "@/lib/ai/usage";
import { assessmentView } from "@/lib/assessment/view";
import { formFields } from "@/lib/assessment/service";
import {
  deckBuildAccess,
  deckUnlockAccess,
  lagosMonthStart,
  rewriteAccess,
  type DeckUsage,
} from "@/lib/billing/entitlements";
import { PlanLimitError } from "@/lib/billing/limits";
import { DECK_BUILDER } from "@/lib/billing/plans";
import { getUsage } from "@/lib/billing/service";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json, Tables } from "@/lib/supabase/database.types";

export const DECK_PURPOSE = "deck";
export const DECK_REWRITE_PURPOSE = "deck_rewrite";

export class DeckError extends Error {}

export type StoredDeck = Deck & { prompt_version: string };

/** The deck content saved on a row, or null if it's missing or malformed. */
export function deckContent(row: Pick<Tables<"pitch_decks">, "content">): StoredDeck | null {
  const parsed = deckSchema.safeParse(row.content);
  if (!parsed.success) return null;
  const version = (row.content as { prompt_version?: unknown }).prompt_version;
  return { ...parsed.data, prompt_version: typeof version === "string" ? version : DECK_PROMPT_VERSION };
}

/** Slides the founder may see: all of them once unlocked, otherwise the first few. */
export function visibleSlideCount(deck: Pick<Tables<"pitch_decks">, "access">, total: number): number {
  return deck.access === "preview" ? Math.min(DECK_BUILDER.previewSlides, total) : total;
}

export async function getDeckUsage(userId: string): Promise<DeckUsage> {
  const admin = createAdminClient();
  const usage = await getUsage(userId, null);
  const [built, pro] = await Promise.all([
    admin.from("pitch_decks").select("id", { count: "exact", head: true }).eq("user_id", userId).in("status", ["generating", "ready"]),
    admin
      .from("pitch_decks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("access", "pro")
      .gte("unlocked_at", lagosMonthStart().toISOString()),
  ]);
  return {
    proActive: usage.proActive,
    deckCredits: usage.profile.deck_credits ?? 0,
    proDecksThisMonth: pro.count ?? 0,
    // The free preview is for a founder's first deck.
    previewsUsed: built.count ?? 0,
  };
}

/** Everything the deck may be written from, as plain text. */
async function material(startup: Tables<"startups">): Promise<string> {
  const admin = createAdminClient();
  const [{ data: profile }, { data: assessment }] = await Promise.all([
    admin
      .from("knowledge_profiles")
      .select("data")
      .eq("startup_id", startup.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("assessments").select("*").eq("startup_id", startup.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const { logo_path: _logo, knowledge_profile_id: _kp, ...form } = formFields(startup) as Record<string, unknown>;
  void _logo;
  void _kp;
  const parts = [`Startup profile, entered by the founder:\n${JSON.stringify(form, null, 1)}`];
  if (profile?.data) {
    const { _meta: _ignored, ...data } = profile.data as Record<string, unknown>;
    void _ignored;
    parts.push(`Facts extracted from the founder's documents (each with its source):\n${JSON.stringify(data, null, 1)}`);
  } else {
    parts.push("The founder has not uploaded documents yet, so only the profile above is available.");
  }
  if (assessment) {
    const view = assessmentView(assessment);
    parts.push(
      [
        `Readiness assessment: ${view.score}/100 (${view.band.label}).`,
        `Weak areas: ${view.weaknesses.map((w) => `${w.name}: ${w.why_weak}`).join(" | ") || "none"}.`,
        `Recommended fixes: ${view.actions.map((a) => `${a.name}: ${a.action}`).join(" | ") || "none"}.`,
      ].join("\n"),
    );
  }
  return parts.join("\n\n");
}

async function loadOwnDeck(userId: string, deckId: string): Promise<Tables<"pitch_decks">> {
  const { data, error } = await createAdminClient().from("pitch_decks").select("*").eq("id", deckId).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`Could not load deck: ${error.message}`);
  if (!data) throw new DeckError("That deck doesn't exist.");
  return data;
}

async function refundCredit(userId: string) {
  await createAdminClient().rpc("add_deck_credits", { p_user_id: userId, p_amount: 1 });
}

/**
 * Writes a new deck with one AI call. Paid for by Pro's monthly allowance or
 * a bought deck; otherwise it's the founder's free preview. A bought deck is
 * refunded if writing fails. Returns the deck id (also for failed decks).
 */
export async function buildDeck(userId: string, startup: Tables<"startups">): Promise<string> {
  const access = deckBuildAccess(await getDeckUsage(userId));
  if (!access.ok) throw new PlanLimitError(access.reason);
  if (!(await withinRateLimit(userId, DECK_PURPOSE))) {
    throw new DeckError("You've built several decks in the last hour. Please try again later.");
  }

  const admin = createAdminClient();
  if (access.via === "credit") {
    const { data: left } = await admin.rpc("consume_deck_credit", { p_user_id: userId });
    if (left === null || left === undefined) throw new PlanLimitError("You have no decks left to use. Buy one to continue.");
  }

  const { data: row, error } = await admin
    .from("pitch_decks")
    .insert({
      user_id: userId,
      startup_id: startup.id,
      access: access.via,
      status: "generating",
      title: startup.name,
      rewrites_used: 0,
      unlocked_at: access.via === "preview" ? null : new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !row) {
    if (access.via === "credit") await refundCredit(userId);
    throw new Error(`Could not start deck: ${error?.message}`);
  }

  try {
    const text = await material(startup);
    const deck = await callStructured({
      userId,
      purpose: DECK_PURPOSE,
      system: DECK_SYSTEM_PROMPT,
      buildContent: (retryNote) => [
        {
          type: "text",
          text: `<founder_material>\n${escapeDelimiters(text)}\n</founder_material>\n\nWrite the pitch deck for ${escapeDelimiters(startup.name)}.${
            retryNote ? `\n\nYour previous answer was rejected for these reasons. Fix them:\n${retryNote}` : ""
          }`,
        },
      ],
      schema: deckSchema,
      check: (d) => checkDeck(d, text),
      effort: "medium",
    });
    const content: StoredDeck = { ...deck, prompt_version: DECK_PROMPT_VERSION };
    await admin
      .from("pitch_decks")
      .update({ status: "ready", title: deck.title || startup.name, content: content as unknown as Json })
      .eq("id", row.id);
  } catch (error) {
    const message = error instanceof AiCallError ? error.userMessage : "Something went wrong while writing your deck.";
    if (!(error instanceof AiCallError)) console.error("[decks] build failed:", error);
    await admin.from("pitch_decks").update({ status: "failed", error: message }).eq("id", row.id);
    if (access.via === "credit") await refundCredit(userId);
  }
  return row.id;
}

/** Turns a preview into a full deck, without rewriting it. */
export async function unlockDeck(userId: string, deckId: string): Promise<void> {
  const deck = await loadOwnDeck(userId, deckId);
  if (deck.access !== "preview") return;
  if (deck.status !== "ready") throw new DeckError("This deck isn't ready yet.");
  const access = deckUnlockAccess(await getDeckUsage(userId));
  if (!access.ok) throw new PlanLimitError(access.reason);

  const admin = createAdminClient();
  if (access.via === "credit") {
    const { data: left } = await admin.rpc("consume_deck_credit", { p_user_id: userId });
    if (left === null || left === undefined) throw new PlanLimitError("You have no decks left to use. Buy one to continue.");
  }
  // Only one unlock wins if two arrive at once; a credit spent by the loser is returned.
  const { data: updated } = await admin
    .from("pitch_decks")
    .update({ access: access.via, unlocked_at: new Date().toISOString() })
    .eq("id", deck.id)
    .eq("access", "preview")
    .select("id");
  if (!updated?.length && access.via === "credit") await refundCredit(userId);
}

export const slideEditSchema = z.object({
  title: z.string().trim().min(1, { error: "Give the slide a title." }).max(120, { error: "Keep the title under 120 characters." }),
  bullets: z
    .string()
    .max(2000, { error: "That's a lot of text for one slide. Keep it shorter." })
    .transform((s) =>
      s
        .split("\n")
        .map((line) => line.replace(/^\s*[-•*]\s*/, "").trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().max(240, { error: "Keep each point under 240 characters." })).max(8, { error: "Use at most 8 points." })),
  notes: z.string().trim().max(2000, { error: "Keep the notes under 2,000 characters." }),
});

function assertEditable(deck: Tables<"pitch_decks">, content: StoredDeck | null, index: number): StoredDeck {
  if (deck.status !== "ready" || !content) throw new DeckError("This deck isn't ready yet.");
  if (!Number.isInteger(index) || index < 0 || index >= visibleSlideCount(deck, content.slides.length)) {
    throw new DeckError("That slide isn't available.");
  }
  return content;
}

/** The founder's own changes to a slide. Free on any deck they can see. */
export async function editSlide(userId: string, deckId: string, index: number, input: z.infer<typeof slideEditSchema>): Promise<void> {
  const deck = await loadOwnDeck(userId, deckId);
  const content = assertEditable(deck, deckContent(deck), index);
  const slides = content.slides.map((s, i) => (i === index ? { ...s, ...input } : s));
  await createAdminClient()
    .from("pitch_decks")
    .update({ content: { ...content, slides } as unknown as Json })
    .eq("id", deck.id);
}

/** Rewrites one slide with the AI, following the founder's request. */
export async function rewriteSlide(userId: string, deckId: string, index: number, request: string): Promise<Slide> {
  const deck = await loadOwnDeck(userId, deckId);
  const content = assertEditable(deck, deckContent(deck), index);
  const access = rewriteAccess(deck);
  if (!access.ok) throw new PlanLimitError(access.reason);
  const ask = request.trim().slice(0, 500);
  if (!ask) throw new DeckError("Say how the slide should change.");
  if (!(await withinRateLimit(userId, DECK_REWRITE_PURPOSE))) {
    throw new DeckError("You've asked for many rewrites in the last hour. Please try again later.");
  }

  const admin = createAdminClient();
  const { data: startup } = await admin.from("startups").select("*").eq("id", deck.startup_id).maybeSingle();
  if (!startup) throw new DeckError("That deck doesn't exist.");
  const current = content.slides[index];
  // The founder may supply new facts in the request or have typed them into
  // the slide, so both count as material.
  const text = `${await material(startup)}\n\nThe slide as it is now:\n${JSON.stringify(current)}\n\nThe founder's request for this slide:\n${ask}`;

  let slide: Slide;
  try {
    slide = await callStructured({
      userId,
      purpose: DECK_REWRITE_PURPOSE,
      system: SLIDE_REWRITE_SYSTEM_PROMPT,
      buildContent: (retryNote) => [
        {
          type: "text",
          text: `<founder_material>\n${escapeDelimiters(text)}\n</founder_material>\n\nThe current slide (kind "${current.kind}"):\n${escapeDelimiters(
            JSON.stringify(current, null, 1),
          )}\n\n<founder_request>\n${escapeDelimiters(ask)}\n</founder_request>\n\nRewrite the slide.${
            retryNote ? `\n\nYour previous answer was rejected for these reasons. Fix them:\n${retryNote}` : ""
          }`,
        },
      ],
      schema: slideSchema,
      check: (s) => checkSlide(s, current.kind, text),
      effort: "low",
      maxTokens: 8000,
    });
  } catch (error) {
    if (error instanceof AiCallError) throw new DeckError(error.userMessage);
    throw error;
  }

  const slides = content.slides.map((s, i) => (i === index ? slide : s));
  await admin
    .from("pitch_decks")
    .update({ content: { ...content, slides } as unknown as Json, rewrites_used: deck.rewrites_used + 1 })
    .eq("id", deck.id);
  return slide;
}

export async function deleteDeck(userId: string, deckId: string): Promise<void> {
  const deck = await loadOwnDeck(userId, deckId);
  if (deck.status === "generating") throw new DeckError("Wait until the deck is ready before deleting it.");
  await createAdminClient().from("pitch_decks").delete().eq("id", deck.id);
}

/** A deck the founder may download (unlocked and ready), with their startup logo. */
export async function deckForDownload(userId: string, deckId: string) {
  const deck = await loadOwnDeck(userId, deckId);
  const content = deckContent(deck);
  if (deck.status !== "ready" || !content) throw new DeckError("This deck isn't ready yet.");
  if (deck.access === "preview") throw new PlanLimitError("Unlock the full deck to download it.");
  const { data: startup } = await createAdminClient().from("startups").select("name, logo_path").eq("id", deck.startup_id).maybeSingle();
  return { deck, content, startupName: startup?.name ?? content.title, logoPath: startup?.logo_path ?? null };
}
