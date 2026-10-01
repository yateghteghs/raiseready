import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadProblem } from "@/components/app/load-problem";
import { getCurrentProfile } from "@/lib/auth/session";
import { load } from "@/lib/data-errors";
import { formatMoney } from "@/lib/format";
import { FUNDING_TYPE_OPTIONS, labelFor, STAGE_OPTIONS } from "@/lib/startups/options";
import { getMyStartup } from "@/lib/startups/service";

export const metadata: Metadata = { title: "Dashboard" };

const NEXT_STEPS = [
  {
    title: "Upload your pitch deck",
    description: "We turn it into a structured profile of your startup.",
  },
  {
    title: "Get your readiness score",
    description: "See how investors would rate you across 10 areas, and what to fix.",
  },
  {
    title: "Practice in the Investor Room",
    description: "Face an AI investor who challenges weak answers and spots contradictions.",
  },
];

export default async function DashboardPage() {
  const loaded = await load(() => Promise.all([getCurrentProfile(), getMyStartup()]));
  if (!loaded.ok) return <LoadProblem code={loaded.code} />;
  const [profile, startup] = loaded.data;
  const firstName = profile?.full_name?.split(" ")[0];

  const facts = startup
    ? [
        { label: "Stage", value: labelFor(STAGE_OPTIONS, startup.stage) },
        { label: "Industry", value: startup.industry },
        { label: "Main market", value: startup.country },
        {
          label: "Monthly revenue",
          value:
            startup.revenue_monthly !== null
              ? formatMoney(startup.revenue_monthly, startup.revenue_currency)
              : "Not stated",
        },
        {
          label: "Raising",
          value: startup.raising
            ? [
                startup.amount_seeking !== null
                  ? formatMoney(startup.amount_seeking, startup.seeking_currency)
                  : null,
                labelFor(FUNDING_TYPE_OPTIONS, startup.funding_type),
              ]
                .filter(Boolean)
                .join(" · ") || "Yes"
            : "Not right now",
        },
      ]
    : [];

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {firstName ? `Welcome, ${firstName}` : "Welcome"}
        </h1>
        <p className="text-muted-foreground mt-1">Here&apos;s where your fundraising prep stands.</p>
      </div>

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
              {facts.map((f) => (
                <div key={f.label}>
                  <dt className="text-muted-foreground text-xs">{f.label}</dt>
                  <dd className="mt-1 text-sm font-medium">{f.value ?? "Not stated"}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      ) : null}

      <section aria-labelledby="next-steps" className="grid gap-4">
        <h2 id="next-steps" className="text-lg font-semibold">
          Next steps
        </h2>
        <ol className="grid gap-3 md:grid-cols-3">
          {NEXT_STEPS.map((s, i) => (
            <li key={s.title} className="bg-card rounded-xl border p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-sm">Step {i + 1}</span>
                <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                  Coming soon
                </span>
              </div>
              <h3 className="mt-3 font-medium">{s.title}</h3>
              <p className="text-muted-foreground mt-1 text-sm">{s.description}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
