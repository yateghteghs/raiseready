import type { Metadata } from "next";
import Link from "next/link";

import { LoadProblem } from "@/components/app/load-problem";
import { NextStep } from "@/components/app/next-step";
import { DimensionBreakdown } from "@/components/assessment/dimension-breakdown";
import { RunAssessmentButton } from "@/components/assessment/run-assessment-button";
import { BandBadge, ScoreChange } from "@/components/assessment/score-badge";
import { Button } from "@/components/ui/button";
import { listAssessments } from "@/lib/assessment/service";
import { assessmentView, recommendedSimulation } from "@/lib/assessment/view";
import { load } from "@/lib/data-errors";
import { getLatestKnowledgeProfile } from "@/lib/documents/service";
import { RUBRIC_VERSION } from "@/lib/scoring/rubric";
import { getMyStartup } from "@/lib/startups/service";

export const metadata: Metadata = { title: "Readiness assessment" };

/** The assessment call can take a couple of minutes. */
export const maxDuration = 300;

const dateFormat = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" });

export default async function AssessmentPage() {
  const loaded = await load(async () => {
    const startup = await getMyStartup();
    if (!startup) return null;
    const [assessments, profile] = await Promise.all([listAssessments(startup.id, 2), getLatestKnowledgeProfile(startup.id)]);
    return { assessments, profile };
  });
  if (!loaded.ok) return <LoadProblem code={loaded.code} />;
  if (!loaded.data) return <LoadProblem code="no_startup" />;

  const { assessments, profile } = loaded.data;
  const latest = assessments[0] ? assessmentView(assessments[0]) : null;
  const previous = assessments[1] ? assessmentView(assessments[1]) : null;
  const delta = latest && previous ? latest.score - previous.score : null;
  const practise = latest ? recommendedSimulation(latest) : null;

  return (
    <div className="grid gap-10">
      <div className="grid gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Readiness assessment</h1>
          <p className="text-muted-foreground mt-1">
            We check your documents against what investors look for in 10 areas. The score is calculated from fixed
            rules, so it only changes when your startup&apos;s information changes.
          </p>
        </div>
        {profile ? (
          <RunAssessmentButton hasAssessment={Boolean(latest)} />
        ) : (
          <div className="bg-muted/40 flex flex-col items-start gap-3 rounded-xl border p-5">
            <p className="text-sm">First, upload and analyse your pitch deck. The assessment uses what we find in it.</p>
            <Button asChild size="sm">
              <Link href="/app/documents">Go to Documents</Link>
            </Button>
          </div>
        )}
      </div>

      {latest ? (
        <>
          <section aria-labelledby="score-heading" className="bg-card grid gap-4 rounded-xl border p-6 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8">
            <div>
              <h2 id="score-heading" className="text-muted-foreground text-sm">
                Readiness score
              </h2>
              <p className="text-6xl font-semibold tracking-tight tabular-nums">{latest.score}</p>
              <BandBadge band={latest.band.id} label={latest.band.label} className="mt-2" />
            </div>
            <div className="grid gap-2">
              <ScoreChange delta={delta} />
              <p className="text-muted-foreground text-sm">
                Assessed {dateFormat.format(new Date(latest.createdAt))}
                {latest.rubricVersion !== RUBRIC_VERSION ? " with an older version of our checklist" : ""}.
              </p>
              <p className="text-muted-foreground text-xs">
                0–49 Not ready · 50–69 Getting there · 70–84 Nearly ready · 85–100 Investor ready
              </p>
            </div>
          </section>

          <NextStep
            title="Practise your pitch in the Investor Room"
            href={practise ? `/app/investor-room?persona=${practise.personaId}&difficulty=${practise.difficultyId}` : "/app/investor-room"}
            cta="Enter the Investor Room"
          >
            {practise
              ? `Your weakest area is ${practise.reason}. Pitch to a ${practise.persona} on ${practise.difficulty.toLowerCase()} difficulty and practise ${practise.focus}, before a real investor asks.`
              : "Your documents are in good shape. Now practise answering the questions a real investor would ask, out loud and under pressure."}
          </NextStep>

          {latest.actions.length ? (
            <section aria-labelledby="actions-heading" className="grid gap-4">
              <h2 id="actions-heading" className="text-lg font-semibold">
                What to fix first
              </h2>
              <ol className="grid gap-3">
                {latest.actions.map((a, i) => (
                  <li key={a.dimension_id} className="bg-card flex gap-4 rounded-xl border p-4">
                    <span className="bg-accent text-accent-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium">
                        {a.name}
                        {a.potential_points > 0 ? (
                          <span className="text-muted-foreground font-normal"> · up to +{a.potential_points} points</span>
                        ) : null}
                      </p>
                      <p className="text-muted-foreground mt-1 text-sm">{a.action}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <section aria-labelledby="breakdown-heading" className="grid gap-4">
            <div>
              <h2 id="breakdown-heading" className="text-lg font-semibold">
                Score by area
              </h2>
              <p className="text-muted-foreground text-sm">Open an area to see each check and what to do about it.</p>
            </div>
            <DimensionBreakdown dimensions={latest.dimensions} />
          </section>
        </>
      ) : null}
    </div>
  );
}
