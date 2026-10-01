import type { Metadata } from "next";
import Link from "next/link";

import { LoadProblem } from "@/components/app/load-problem";
import { ProgressChart } from "@/components/progress/progress-chart";
import { Button } from "@/components/ui/button";
import { DIFFICULTIES, PERSONAS } from "@/lib/ai/personas";
import { load } from "@/lib/data-errors";
import { bandFor } from "@/lib/scoring/rubric";
import { getMyStartup } from "@/lib/startups/service";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Progress" };

const dateFormat = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" });

export default async function ProgressPage() {
  const loaded = await load(async () => {
    const startup = await getMyStartup();
    if (!startup) return null;
    const supabase = await createClient();
    const [assessments, sims] = await Promise.all([
      supabase.from("assessments").select("id, overall_score, created_at").eq("startup_id", startup.id).order("created_at", { ascending: true }),
      supabase
        .from("simulations")
        .select("id, persona, difficulty, overall_score, ended_at")
        .eq("startup_id", startup.id)
        .eq("mode", "full")
        .eq("status", "completed")
        .order("ended_at", { ascending: true }),
    ]);
    return { assessments: assessments.data ?? [], sims: sims.data ?? [] };
  });
  if (!loaded.ok) return <LoadProblem code={loaded.code} />;
  if (!loaded.data) return <LoadProblem code="no_startup" />;
  const { assessments, sims } = loaded.data;

  const readiness = assessments.map((a) => ({ t: new Date(a.created_at).getTime(), score: a.overall_score }));
  const meetings = sims
    .filter((s) => s.overall_score !== null && s.ended_at)
    .map((s) => ({ t: new Date(s.ended_at!).getTime(), score: s.overall_score! }));

  const first = readiness[0]?.score ?? null;
  const current = readiness.at(-1)?.score ?? null;
  const bestMeeting = meetings.length ? Math.max(...meetings.map((m) => m.score)) : null;

  const history = [
    ...assessments.map((a) => ({
      id: a.id,
      at: a.created_at,
      kind: "Readiness assessment",
      detail: bandFor(a.overall_score).label,
      score: a.overall_score,
      href: "/app/assessment",
    })),
    ...sims.map((s) => ({
      id: s.id,
      at: s.ended_at ?? "",
      kind: "Investor Room",
      detail: `${PERSONAS[s.persona].name}, ${DIFFICULTIES[s.difficulty].label.toLowerCase()}`,
      score: s.overall_score,
      href: `/app/simulations/${s.id}/results`,
    })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  if (history.length === 0) {
    return (
      <div className="grid gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
        <div className="bg-muted/40 flex flex-col items-start gap-3 rounded-xl border p-5">
          <p className="text-sm">Your scores will appear here once you&apos;ve run an assessment or completed an Investor Room session.</p>
          <Button asChild size="sm">
            <Link href="/app/assessment">Run your first assessment</Link>
          </Button>
        </div>
      </div>
    );
  }

  const stats = [
    { label: "Readiness now", value: current ?? "–" },
    { label: "Since your first assessment", value: current !== null && first !== null ? `${current - first >= 0 ? "+" : ""}${current - first}` : "–" },
    { label: "Best Investor Room score", value: bestMeeting ?? "–" },
    { label: "Investor Room sessions", value: meetings.length },
  ];

  return (
    <div className="grid grid-cols-1 gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
        <p className="text-muted-foreground mt-1">How your readiness and practice meetings have changed over time.</p>
      </div>

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-card rounded-xl border p-4">
            <dt className="text-muted-foreground text-xs">{s.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="chart-heading" className="bg-card grid gap-4 rounded-xl border p-5">
        <h2 id="chart-heading" className="font-semibold">
          Scores over time
        </h2>
        <ProgressChart readiness={readiness} meetings={meetings} />
      </section>

      <section aria-labelledby="history-heading" className="grid gap-4">
        <h2 id="history-heading" className="text-lg font-semibold">
          History
        </h2>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <caption className="sr-only">Assessments and Investor Room sessions, newest first</caption>
            <thead className="bg-muted/40 text-muted-foreground text-left text-xs">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">Date</th>
                <th scope="col" className="px-4 py-2 font-medium">Type</th>
                <th scope="col" className="px-4 py-2 font-medium">Details</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="px-4 py-3 whitespace-nowrap">{h.at ? dateFormat.format(new Date(h.at)) : "–"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link href={h.href} className="underline-offset-4 hover:underline">
                      {h.kind}
                    </Link>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">{h.detail}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{h.score ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
