import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { LoadProblem } from "@/components/app/load-problem";
import { DeckSlides } from "@/components/decks/deck-slides";
import { DeleteDeckButton, UnlockDeckForm } from "@/components/decks/deck-actions";
import { BuildDeckForm } from "@/components/decks/build-deck-form";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { deckUnlockAccess, rewriteAccess, rewriteLimit } from "@/lib/billing/entitlements";
import { DEFAULT_PLAN_RULES } from "@/lib/billing/plan-rules";
import { load } from "@/lib/data-errors";
import { getCurrentProfile } from "@/lib/auth/session";
import { priceLabel } from "@/lib/currency/display";
import { getPriceContext } from "@/lib/currency/server";
import { deckContent, getDeckUsage, visibleSlideCount } from "@/lib/decks/service";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pitch deck" };

/** Rewriting a slide is an AI call. */
export const maxDuration = 120;

export default async function DeckPage({ params }: PageProps<"/app/decks/[deckId]">) {
  const { deckId } = await params;
  if (!z.uuid().safeParse(deckId).success) notFound();
  const loaded = await load(async () => {
    const user = await getCurrentUser();
    if (!user) return null;
    const supabase = await createClient();
    const { data: deck } = await supabase.from("pitch_decks").select("*").eq("id", deckId).maybeSingle();
    if (!deck) return null;
    const [usage, prices] = await Promise.all([getDeckUsage(user.id), getCurrentProfile().then((p) => getPriceContext(p?.country))]);
    return { deck, usage, prices };
  });
  if (!loaded.ok) return <LoadProblem code={loaded.code} />;
  if (!loaded.data) notFound();
  const { deck, usage, prices } = loaded.data;
  const content = deckContent(deck);

  const back = (
    <Link href="/app/decks" className="text-muted-foreground text-sm underline-offset-4 hover:underline">
      ← All decks
    </Link>
  );

  if (deck.status !== "ready" || !content) {
    return (
      <div className="grid gap-6">
        {back}
        <h1 className="text-2xl font-semibold tracking-tight">{deck.title ?? "Pitch deck"}</h1>
        {deck.status === "generating" ? (
          <p>This deck is still being written. Refresh the page in a minute.</p>
        ) : (
          <div className="grid gap-4">
            <p className="text-destructive">{deck.error ?? "This deck couldn't be written."}</p>
            <p className="text-muted-foreground text-sm">Nothing was used up for it. You can try again.</p>
            <BuildDeckForm label="Try again" note="Writes a new deck." />
          </div>
        )}
        <DeleteDeckButton deckId={deck.id} />
      </div>
    );
  }

  const shown = visibleSlideCount(deck, content.slides.length);
  const slides = content.slides.slice(0, shown);
  const locked = content.slides.slice(shown).map((s) => s.kind);
  const tier = usage.tier ?? (usage.proActive ? "pro" : "free");
  const rewrite = rewriteAccess(deck, tier, usage.rules);
  const rewritesAllowed = rewriteLimit(deck.access, tier, usage.rules);
  const unlock = deck.access === "preview" ? deckUnlockAccess(usage) : null;
  const placeholders = content.slides.reduce((n, s) => n + s.missing.length, 0);

  return (
    <div className="grid gap-8">
      {back}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{content.title}</h1>
          <p className="text-muted-foreground mt-1">{content.tagline}</p>
        </div>
        {deck.access !== "preview" ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <a href={`/app/decks/${deck.id}/download?format=pptx`}>Download PowerPoint</a>
            </Button>
            <Button asChild variant="outline">
              <a href={`/app/decks/${deck.id}/download?format=pdf`}>Download PDF</a>
            </Button>
          </div>
        ) : null}
      </div>

      {deck.access === "preview" ? (
        <section className="bg-accent text-accent-foreground grid gap-3 rounded-xl p-5">
          <p className="font-medium">
            Free preview: the first {shown} of {content.slides.length} slides.
          </p>
          {unlock?.ok ? (
            <UnlockDeckForm
              deckId={deck.id}
              label={unlock.via === "pro" ? (tier === "pro_plus" ? "Unlock with Pro Plus" : "Unlock with Pro") : `Unlock with a bought deck (${usage?.deckCredits} left)`}
            />
          ) : (
            <div className="grid justify-items-start gap-2 text-sm">
              <p>
                Unlock every slide, AI rewrites and the PowerPoint and PDF downloads: buy this deck for{" "}
                {priceLabel(prices.prices[prices.currency].deck_builder, prices).price}, or get {(usage.rules ?? DEFAULT_PLAN_RULES).pro.decksPerMonth} decks a month with Pro.
                Your deck won&apos;t be written again; it unlocks as it is.
              </p>
              <Button asChild size="sm">
                <Link href="/app/billing">Buy a deck or upgrade</Link>
              </Button>
            </div>
          )}
        </section>
      ) : (
        <p className="text-muted-foreground text-sm">
          {placeholders
            ? `${placeholders} thing${placeholders === 1 ? "" : "s"} to add before you send this deck: look for the highlighted [Add: …] text. `
            : ""}
          Edit any slide yourself, as often as you like. AI rewrites used: {deck.rewrites_used} of {rewritesAllowed}. The
          PowerPoint file includes your speaker notes.
        </p>
      )}

      <DeckSlides
        deckId={deck.id}
        slides={slides}
        locked={locked}
        rewritesLeft={Math.max(0, rewritesAllowed - deck.rewrites_used)}
        rewriteBlocked={rewrite.ok ? null : rewrite.reason}
      />

      <div className="border-t pt-4">
        <DeleteDeckButton deckId={deck.id} />
      </div>
    </div>
  );
}
