import type { Metadata } from "next";
import Link from "next/link";

import { LoadProblem } from "@/components/app/load-problem";
import { BandBadge, ScoreChange } from "@/components/assessment/score-badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { recentActivity } from "@/lib/activity";
import { listAssessments } from "@/lib/assessment/service";
import { assessmentView, recommendedSimulation } from "@/lib/assessment/view";
import { getCurrentProfile } from "@/lib/auth/session";
import { load } from "@/lib/data-errors";
import { getLatestKnowledgeProfile, listDocuments } from "@/lib/documents/service";
import { formatMoney } from "@/lib/format";
import { FUNDING_TYPE_OPTIONS, labelFor, STAGE_OPTIONS } from "@/lib/startups/options";
import { COMING_SOON } from "@/lib/roadmap";
import { getMyStartup } from "@/lib/startups/service";

export const metadata: Metadata = { title: "Dashboard" };

const dateFormat = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short" });

export default async function DashboardPage({ searchParams }: PageProps<"/app">) {
  const { joined } = await searchParams;
  const loaded = await load(async () => {
    const [profile, startup] = await Promise.all([getCurrentProfile(), getMyStartup()]);
    if (!startup) return { profile, startup, assessments: [], docs: [], knowledge: null, activity: [] };
    const [assessments, docs, knowledge, activity] = await Promise.all([
      listAssessments(startup.id, 2),
      listDocuments(startup.id),
      getLatestKnowledgeProfile(startup.id),
      recentActivity(startup.id),
    ]);
    return { profile, startup, assessments, docs, knowledge, activity };
  });
  if (!loaded.ok) return <LoadProblem code={loaded.code} />;
  const { profile, startup, assessments, docs, knowledge, activity } = loaded.data;

  const firstName = profile?.full_name?.split(" ")[0];
  const latest = assessments[0] ? assessmentView(assessments[0]) : null;
  const previous = assessments[1] ? assessmentView(assessments[1]) : null;
  const strength = latest?.strengths[0] ?? null;
  const weakness = latest?.weaknesses[0] ?? null;
  const nextSim = latest ? recommendedSimulation(latest) : null;

  const steps = [
    { title: "Upload your pitch deck", description: "We turn it into a structured profile of your startup.", href: "/app/documents", done: docs.some((d) => d.kind === "pitch_deck") && Boolean(knowledge) },
    { title: "Get your readiness score", description: "See how investors would rate you across 10 areas, and what to fix.", href: knowledge ? "/app/assessment" : undefined, done: Boolean(latest) },
    {
      title: "Practise in the Investor Room",
      description: "Face an AI investor who challenges weak answers and spots contradictions.",
      href: knowledge ? "/app/investor-room" : undefined,
      done: activity.some((a) => a.href.startsWith("/app/investor-room/")),
    },
  ];

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{firstName ? `Welcome, ${firstName}` : "Welcome"}</h1>
        <p className="text-muted-foreground mt-1">Here&apos;s where your fundraising prep stands.</p>
      </div>
      {typeof joined === "string" && joined.length <= 100 ? (
        <p role="status" className="border-primary/30 bg-accent text-accent-foreground rounded-xl border px-4 py-3 text-sm">
          You&apos;ve joined {joined}. You now have RaiseReady Pro Plus.
        </p>
      ) : null}

      {latest ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:row-span-2">
            <CardHeader>
              <CardDescription>Readiness score</CardDescription>
              <CardTitle className="text-5xl tabular-nums">{latest.score}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <BandBadge band={latest.band.id} label={latest.band.label} className="justify-self-start" />
              <ScoreChange delta={previous ? latest.score - previous.score : null} />
              <Button asChild variant="outline" size="sm" className="justify-self-start">
                <Link href="/app/assessment">See full breakdown</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Biggest strength</CardDescription>
              <CardTitle className="text-base">{strength ? `${strength.name} · ${strength.score}` : "None above 70 yet"}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Biggest weakness</CardDescription>
              <CardTitle className="text-base">{weakness ? `${weakness.name} · ${weakness.score}` : "No major gaps"}</CardTitle>
            </CardHeader>
            {weakness?.investor_question ? (
              <CardContent>
                <p className="text-muted-foreground text-sm">An investor would ask: “{weakness.investor_question}”</p>
              </CardContent>
            ) : null}
          </Card>
          <Card className="md:col-span-2">
            <CardHeader>
              <CardDescription>Recommended next simulation</CardDescription>
              <CardTitle className="text-base">
                {nextSim ? `${nextSim.persona}, ${nextSim.difficulty.toLowerCase()}: practise ${nextSim.focus}` : "Practise a full pitch with a Seed VC"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                {nextSim ? `Because ${nextSim.reason.toLowerCase()} is your weakest area.` : ""}
              </p>
              <Button asChild size="sm" className="mt-3">
                <Link href="/app/investor-room">Enter the Investor Room</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {startup ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{startup.name}</CardTitle>
            {startup.website ? (
              <CardDescription>
                <a href={startup.website} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
                  {startup.website.replace(/^https?:\/\//, "")}
                </a>
              </CardDescription>
            ) : null}
            <CardAction>
              <Button asChild variant="outline" size="sm">
                <Link href="/app/startup">Edit</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { label: "Stage", value: labelFor(STAGE_OPTIONS, startup.stage) },
                { label: "Industry", value: startup.industry },
                { label: "Main market", value: startup.country },
                { label: "Monthly revenue", value: startup.revenue_monthly !== null ? formatMoney(startup.revenue_monthly, startup.revenue_currency) : "Not stated" },
                {
                  label: "Raising",
                  value: startup.raising
                    ? [startup.amount_seeking !== null ? formatMoney(startup.amount_seeking, startup.seeking_currency) : null, labelFor(FUNDING_TYPE_OPTIONS, startup.funding_type)].filter(Boolean).join(" · ") || "Yes"
                    : "Not right now",
                },
              ].map((f) => (
                <div key={f.label}>
                  <dt className="text-muted-foreground text-xs">{f.label}</dt>
                  <dd className="mt-1 text-sm font-medium">{f.value ?? "Not stated"}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-8 md:grid-cols-[2fr_1fr]">
        <section aria-labelledby="next-steps" className="grid content-start gap-4">
          <h2 id="next-steps" className="text-lg font-semibold">
            Next steps
          </h2>
          <ol className="grid gap-3">
            {steps.map((s, i) => (
              <li key={s.title} className="bg-card flex items-start justify-between gap-4 rounded-xl border p-4">
                <div>
                  <p className="text-muted-foreground text-xs">Step {i + 1}</p>
                  <h3 className="mt-1 font-medium">
                    {s.href ? (
                      <Link href={s.href} className="underline-offset-4 hover:underline">
                        {s.title}
                      </Link>
                    ) : (
                      s.title
                    )}
                  </h3>
                  <p className="text-muted-foreground mt-1 text-sm">{s.description}</p>
                </div>
                <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-xs">
                  {s.done ? "Done" : s.href ? "To do" : "Coming soon"}
                </span>
              </li>
            ))}
          </ol>
        </section>
        <section aria-labelledby="activity" className="grid content-start gap-4">
          <h2 id="activity" className="text-lg font-semibold">
            Recent activity
          </h2>
          {activity.length ? (
            <ul className="grid gap-3 text-sm">
              {activity.map((a, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <Link href={a.href} className="underline-offset-4 hover:underline">
                    {a.text}
                  </Link>
                  <span className="text-muted-foreground shrink-0">{dateFormat.format(new Date(a.at))}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">Nothing yet. Start by uploading your pitch deck.</p>
          )}
        </section>
      </div>

      <section aria-labelledby="coming-soon" className="grid gap-4 border-t pt-8">
        <div>
          <h2 id="coming-soon" className="text-lg font-semibold">
            What&apos;s coming
          </h2>
          <p className="text-muted-foreground text-sm">What we&apos;re building next for RaiseReady founders.</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COMING_SOON.map((f) => (
            <li key={f.title} className="bg-muted/40 grid content-start gap-1 rounded-xl border p-4">
              <h3 className="text-sm font-semibold">{f.title}</h3>
              <p className="text-muted-foreground text-sm">{f.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
