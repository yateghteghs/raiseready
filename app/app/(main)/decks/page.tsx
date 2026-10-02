import type { Metadata } from "next";
import Link from "next/link";

import { LoadProblem } from "@/components/app/load-problem";
import { BuildDeckForm } from "@/components/decks/build-deck-form";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { deckBuildAccess } from "@/lib/billing/entitlements";
import { DECK_BUILDER } from "@/lib/billing/plans";
import { DEFAULT_PLAN_RULES, PLAN_NAMES } from "@/lib/billing/plan-rules";
import { paidPlanOf } from "@/lib/billing/entitlements";
import { load } from "@/lib/data-errors";
import { getCurrentProfile } from "@/lib/auth/session";
import { displayPrice } from "@/lib/currency/display";
import { getPriceContext } from "@/lib/currency/server";
import { getDeckUsage } from "@/lib/decks/service";
import { getMyStartup } from "@/lib/startups/service";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pitch deck" };

/** Writing a deck is one long AI call. */
export const maxDuration = 300;

const dateFormat = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" });

export default async function DecksPage() {
  const loaded = await load(async () => {
    const [user, startup] = await Promise.all([getCurrentUser(), getMyStartup()]);
    if (!user || !startup) return null;
    const supabase = await createClient();
    const [decks, documents, usage, prices] = await Promise.all([
      supabase.from("pitch_decks").select("id, title, status, access, created_at").eq("startup_id", startup.id).order("created_at", { ascending: false }),
      supabase.from("knowledge_profiles").select("id", { count: "exact", head: true }).eq("startup_id", startup.id),
      getDeckUsage(user.id),
      getCurrentProfile().then((p) => getPriceContext(p?.country)),
    ]);
    return { decks: decks.data ?? [], hasDocuments: (documents.count ?? 0) > 0, usage, prices };
  });
  if (!loaded.ok) return <LoadProblem code={loaded.code} />;
  if (!loaded.data) return <LoadProblem code="no_startup" />;
  const { decks, hasDocuments, usage, prices } = loaded.data;
  const access = deckBuildAccess(usage);
  const plan = paidPlanOf(usage);
  const allowance = (usage.rules ?? DEFAULT_PLAN_RULES)[plan ?? "pro"].decksPerMonth;
  const deckPrice = displayPrice("deck_builder", prices, "paid in naira: {price}");
  const price = deckPrice.approx ? `${deckPrice.price} (${deckPrice.approx})` : deckPrice.price;

  return (
    <div className="grid gap-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pitch deck</h1>
        <p className="text-muted-foreground mt-1 max-w-3xl">
          RaiseReady writes an investor pitch deck from your startup profile
          {hasDocuments ? ", your documents" : ""} and your readiness assessment: problem, solution, market, traction,
          business model, competition, team, financials and your ask, with speaker notes. It never makes up numbers.
          Anything it needs from you is marked <span className="font-medium text-amber-700">[Add: …]</span>. Download it
          as PowerPoint or PDF.
        </p>
      </div>

      <section className="bg-card grid gap-4 rounded-xl border p-5">
        {access.ok ? (
          <BuildDeckForm
            label={decks.length ? "Build a new deck" : "Build my pitch deck"}
            note={
              access.via === "preview"
                ? `Your first deck is a free preview: you'll see the outline and the first ${DECK_BUILDER.previewSlides} slides, then unlock the rest with Pro or for ${price}.`
                : access.via === "pro"
                  ? `Included with ${PLAN_NAMES[plan ?? "pro"]}: ${allowance - usage.proDecksThisMonth} of ${allowance} decks left this month.`
                  : `Uses one of your bought decks (${usage.deckCredits} left).`
            }
          />
        ) : (
          <div className="grid justify-items-start gap-3">
            <p className="text-sm">{access.reason}</p>
            <Button asChild size="sm">
              <Link href="/app/billing">See plans and prices</Link>
            </Button>
          </div>
        )}
        {!hasDocuments ? (
          <p className="text-muted-foreground text-sm">
            Tip: the deck is much better with your documents.{" "}
            <Link href="/app/documents" className="text-primary underline-offset-4 hover:underline">
              Upload a business plan, financial model or old deck
            </Link>{" "}
            first if you have one.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="decks-heading" className="grid gap-4">
        <h2 id="decks-heading" className="text-lg font-semibold">
          Your decks
        </h2>
        {decks.length ? (
          <ul className="divide-y rounded-xl border">
            {decks.map((d) => (
              <li key={d.id}>
                <Link href={`/app/decks/${d.id}`} className="hover:bg-muted/40 flex items-center justify-between gap-3 p-4">
                  <span>
                    <span className="font-medium">{d.title ?? "Pitch deck"}</span>
                    <span className="text-muted-foreground text-sm"> · {dateFormat.format(new Date(d.created_at))}</span>
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {d.status === "failed" ? "Couldn't be written" : d.status === "generating" ? "Being written…" : d.access === "preview" ? "Preview" : "Full deck"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">No decks yet.</p>
        )}
      </section>
    </div>
  );
}
