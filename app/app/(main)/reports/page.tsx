import type { Metadata } from "next";
import Link from "next/link";

import { LoadProblem } from "@/components/app/load-problem";
import { CreateReportForm } from "@/components/reports/create-report-form";
import { Button } from "@/components/ui/button";
import { DIFFICULTIES, PERSONAS } from "@/lib/ai/personas";
import { load } from "@/lib/data-errors";
import { getMyStartup } from "@/lib/startups/service";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reports" };

/** Creating a report includes an AI call and PDF rendering. */
export const maxDuration = 300;

const dateFormat = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" });

export default async function ReportsPage({ searchParams }: PageProps<"/app/reports">) {
  const { simulation } = await searchParams;
  const loaded = await load(async () => {
    const startup = await getMyStartup();
    if (!startup) return null;
    const supabase = await createClient();
    const [reports, sessions, assessments] = await Promise.all([
      supabase.from("reports").select("id, created_at, content").eq("startup_id", startup.id).order("created_at", { ascending: false }),
      supabase
        .from("simulations")
        .select("id, persona, difficulty, overall_score, ended_at")
        .eq("startup_id", startup.id)
        .eq("mode", "full")
        .eq("status", "completed")
        .order("ended_at", { ascending: false })
        .limit(20),
      supabase.from("assessments").select("id", { count: "exact", head: true }).eq("startup_id", startup.id),
    ]);
    return { reports: reports.data ?? [], sessions: sessions.data ?? [], hasAssessment: (assessments.count ?? 0) > 0 };
  });
  if (!loaded.ok) return <LoadProblem code={loaded.code} />;
  if (!loaded.data) return <LoadProblem code="no_startup" />;
  const { reports, sessions, hasAssessment } = loaded.data;

  const options = sessions.map((s) => ({
    id: s.id,
    label: `${PERSONAS[s.persona].name}, ${DIFFICULTIES[s.difficulty].label.toLowerCase()} · score ${s.overall_score}${s.ended_at ? ` · ${dateFormat.format(new Date(s.ended_at))}` : ""}`,
  }));
  const requested = typeof simulation === "string" && options.some((o) => o.id === simulation) ? simulation : (options[0]?.id ?? "");

  return (
    <div className="grid gap-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-muted-foreground mt-1">
          A readiness report brings together your assessment and a practice meeting: summary, risks, red flags, the
          questions to prepare and what to do next. Download it as a PDF to share with mentors or your team.
        </p>
      </div>

      {hasAssessment ? (
        <CreateReportForm sessions={options} defaultSession={requested} />
      ) : (
        <div className="bg-muted/40 flex flex-col items-start gap-3 rounded-xl border p-5">
          <p className="text-sm">Run your readiness assessment first. Reports are built from it.</p>
          <Button asChild size="sm">
            <Link href="/app/assessment">Go to Assessment</Link>
          </Button>
        </div>
      )}

      <section aria-labelledby="list-heading" className="grid gap-4">
        <h2 id="list-heading" className="text-lg font-semibold">
          Your reports
        </h2>
        {reports.length ? (
          <ul className="divide-y rounded-xl border">
            {reports.map((r) => {
              const c = r.content as { readiness?: { score?: number }; simulation?: { investor?: string } | null };
              return (
                <li key={r.id}>
                  <Link href={`/app/reports/${r.id}`} className="hover:bg-muted/40 flex items-center justify-between gap-3 p-4">
                    <span>
                      <span className="font-medium">Readiness report</span>
                      <span className="text-muted-foreground text-sm"> · {dateFormat.format(new Date(r.created_at))}</span>
                    </span>
                    <span className="text-muted-foreground text-sm">
                      Score {c.readiness?.score ?? "–"}
                      {c.simulation?.investor ? ` · with ${c.simulation.investor} meeting` : ""}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">No reports yet.</p>
        )}
      </section>
    </div>
  );
}
