import type { Metadata } from "next";
import Link from "next/link";

import { LoadProblem } from "@/components/app/load-problem";
import { SetupForm } from "@/components/simulation/setup-form";
import { Button } from "@/components/ui/button";
import { DIFFICULTIES, PERSONAS } from "@/lib/ai/personas";
import { load } from "@/lib/data-errors";
import { getLatestKnowledgeProfile } from "@/lib/documents/service";
import { FUNDING_TYPE_OPTIONS, labelFor } from "@/lib/startups/options";
import { getMyStartup } from "@/lib/startups/service";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Investor Room" };

const dateFormat = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default async function InvestorRoomPage() {
  const loaded = await load(async () => {
    const startup = await getMyStartup();
    if (!startup) return null;
    const supabase = await createClient();
    const [profile, sims] = await Promise.all([
      getLatestKnowledgeProfile(startup.id),
      supabase
        .from("simulations")
        .select("id, persona, difficulty, status, overall_score, started_at, ended_at")
        .eq("startup_id", startup.id)
        .order("started_at", { ascending: false })
        .limit(10),
    ]);
    if (sims.error) throw new Error(sims.error.message);
    return { startup, profile, sims: sims.data };
  });
  if (!loaded.ok) return <LoadProblem code={loaded.code} />;
  if (!loaded.data) return <LoadProblem code="no_startup" />;
  const { startup, profile, sims } = loaded.data;

  return (
    <div className="grid gap-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Investor Room</h1>
        <p className="text-muted-foreground mt-1">
          Practise your pitch with an AI investor who has read your documents. They&apos;ll follow up on weak answers
          and flag anything that contradicts your deck.
        </p>
      </div>

      {profile ? (
        <SetupForm
          personas={Object.values(PERSONAS).map((p) => ({ value: p.id, label: p.name, summary: p.summary }))}
          difficulties={Object.entries(DIFFICULTIES).map(([value, d]) => ({ value, label: d.label, summary: d.summary }))}
          fundingTypes={FUNDING_TYPE_OPTIONS}
          defaultFundingType={labelFor(FUNDING_TYPE_OPTIONS, startup.funding_type) ?? ""}
        />
      ) : (
        <div className="bg-muted/40 flex flex-col items-start gap-3 rounded-xl border p-5">
          <p className="text-sm">First, upload and analyse your pitch deck. The investor prepares from it.</p>
          <Button asChild size="sm">
            <Link href="/app/documents">Go to Documents</Link>
          </Button>
        </div>
      )}

      {sims.length ? (
        <section aria-labelledby="past-heading" className="grid gap-4">
          <h2 id="past-heading" className="text-lg font-semibold">
            Your sessions
          </h2>
          <ul className="divide-y rounded-xl border">
            {sims.map((s) => (
              <li key={s.id}>
                <Link href={`/app/investor-room/${s.id}`} className="hover:bg-muted/40 flex items-center justify-between gap-3 p-4">
                  <span>
                    <span className="font-medium">{PERSONAS[s.persona].name}</span>
                    <span className="text-muted-foreground text-sm"> · {DIFFICULTIES[s.difficulty].label} · {dateFormat.format(new Date(s.started_at))}</span>
                  </span>
                  <span className="text-muted-foreground shrink-0 text-sm">
                    {s.status === "completed"
                      ? `Score ${s.overall_score}`
                      : s.status === "abandoned"
                        ? "Left early"
                        : s.ended_at
                          ? "Preparing feedback"
                          : "In progress"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
