import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LoadProblem } from "@/components/app/load-problem";
import { ScoreBar } from "@/components/assessment/score-badge";
import { DownloadReportButton } from "@/components/reports/download-button";
import { load } from "@/lib/data-errors";
import { reportContentSchema } from "@/lib/reports/content";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Readiness report" };

/** The PDF is created on demand if it is missing. */
export const maxDuration = 120;

const dateFormat = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "long", year: "numeric" });

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default async function ReportPage({ params }: PageProps<"/app/reports/[reportId]">) {
  const { reportId } = await params;
  const loaded = await load(async () => {
    const supabase = await createClient();
    const { data } = await supabase.from("reports").select("*").eq("id", reportId).maybeSingle();
    return data;
  });
  if (!loaded.ok) return <LoadProblem code={loaded.code} />;
  if (!loaded.data) notFound();
  const parsed = reportContentSchema.safeParse(loaded.data.content);
  if (!parsed.success) return <LoadProblem code="report_format" />;
  const c = parsed.data;

  return (
    <article className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-primary text-xs font-semibold tracking-wide uppercase">Readiness report</p>
          <h1 className="text-3xl font-semibold tracking-tight">{c.startup.name}</h1>
          <p className="text-muted-foreground text-sm">
            {[c.startup.stage, c.startup.industry, c.startup.country].filter(Boolean).join(" · ")} · {dateFormat.format(new Date(c.generated_at))}
          </p>
        </div>
        <DownloadReportButton reportId={loaded.data.id} />
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="bg-card rounded-xl border p-5">
          <p className="text-muted-foreground text-sm">Readiness score</p>
          <p className="text-5xl font-semibold tabular-nums">{c.readiness.score}</p>
          <p className="text-sm">{c.readiness.band}</p>
        </div>
        {c.simulation ? (
          <div className="bg-card rounded-xl border p-5">
            <p className="text-muted-foreground text-sm">
              Practice meeting ({c.simulation.investor}, {c.simulation.difficulty})
            </p>
            <p className="text-5xl font-semibold tabular-nums">{c.simulation.score}</p>
            <p className="text-sm">Investor confidence: {c.simulation.confidence}</p>
          </div>
        ) : null}
      </div>

      <Section title="Executive summary">
        <p>{c.executive_summary}</p>
      </Section>

      <Section title="Score by area">
        <ul className="grid gap-3">
          {c.readiness.dimensions.map((d) => (
            <li key={d.name} className="grid grid-cols-[minmax(0,10rem)_1fr_2rem] items-center gap-3 text-sm">
              <span>{d.name}</span>
              {d.score !== null ? <ScoreBar score={d.score} label={`${d.name} score`} /> : <span className="bg-muted h-2 rounded-full" />}
              <span className="text-right tabular-nums">{d.score ?? "–"}</span>
            </li>
          ))}
        </ul>
      </Section>

      {c.strengths.length ? (
        <Section title="Strengths">
          <ul className="grid list-disc gap-1 pl-5 text-sm">
            {c.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Key risks">
        <ul className="grid gap-3">
          {c.risks.map((r) => (
            <li key={r.risk} className="bg-card rounded-xl border p-4 text-sm">
              <p className="font-medium">{r.risk}</p>
              <p className="text-muted-foreground mt-1">{r.why_it_matters}</p>
            </li>
          ))}
        </ul>
      </Section>

      {c.red_flags.length ? (
        <Section title="Red flags from the practice meeting">
          <ul className="grid gap-3">
            {c.red_flags.map((f, i) => (
              <li key={i} className="border-warning/60 bg-warning/10 rounded-xl border p-4 text-sm">
                <p className="font-medium">
                  {f.type} · {f.severity} risk
                </p>
                <p className="mt-1">{f.description}</p>
                {f.evidence.map((e) => (
                  <p key={e} className="text-muted-foreground mt-1 text-xs">
                    {e}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Questions to prepare">
        <ol className="grid gap-3">
          {c.questions_to_prepare.map((q, i) => (
            <li key={i} className="bg-card rounded-xl border p-4 text-sm">
              <p className="font-medium">
                {i + 1}. {q.question}
              </p>
              <p className="text-muted-foreground mt-1">{q.guidance}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Recommended next steps">
        <ol className="grid list-decimal gap-1 pl-5 text-sm">
          {c.next_steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </Section>

      <p className="text-muted-foreground border-t pt-4 text-xs">
        AI-assisted practice feedback, not investment advice. Readiness checklist {c.readiness.rubric_version}.
      </p>
    </article>
  );
}
