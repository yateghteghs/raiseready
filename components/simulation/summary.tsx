import Link from "next/link";

import { ScoreBar } from "@/components/assessment/score-badge";
import { Button } from "@/components/ui/button";
import { DIFFICULTIES, PERSONAS } from "@/lib/ai/personas";
import type { FinalEvaluation } from "@/lib/ai/schemas/simulation";
import type { InvestorConfidence } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

const CONFIDENCE: Record<InvestorConfidence, { label: string; className: string }> = {
  high: { label: "High: they'd want a follow-up meeting", className: "bg-accent text-accent-foreground" },
  medium: { label: "Medium: interested, with open questions", className: "bg-warning/20" },
  low: { label: "Low: this meeting would likely end their interest", className: "bg-destructive/10 text-destructive" },
};

export function SimulationSummary({
  score,
  confidence,
  evaluation,
  resultsHref,
}: {
  score: number;
  confidence: InvestorConfidence;
  evaluation: FinalEvaluation;
  /** Link to per-question feedback, when shown outside the results page. */
  resultsHref?: string;
}) {
  const next = evaluation.recommended_next_practice;
  return (
    <section aria-labelledby="summary-heading" className="grid gap-6">
      <div className="bg-card grid gap-4 rounded-xl border p-6 sm:grid-cols-[auto_1fr] sm:gap-8">
        <div>
          <h2 id="summary-heading" className="text-muted-foreground text-sm">
            Meeting score
          </h2>
          <p className="text-6xl font-semibold tabular-nums">{score}</p>
          <div className="mt-2 w-32">
            <ScoreBar score={score} label="Meeting score" />
          </div>
        </div>
        <div className="grid content-start gap-3">
          {resultsHref ? (
            <Button asChild size="sm" className="justify-self-start">
              <Link href={resultsHref}>See feedback on every answer</Link>
            </Button>
          ) : null}
          <p className={cn("justify-self-start rounded-full px-2.5 py-0.5 text-xs font-medium", CONFIDENCE[confidence].className)}>
            Investor confidence: {CONFIDENCE[confidence].label}
          </p>
          <p>{evaluation.summary}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-card rounded-xl border p-5">
          <h3 className="font-semibold">What went well</h3>
          <ul className="mt-3 grid list-disc gap-2 pl-5 text-sm">
            {evaluation.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div className="bg-card rounded-xl border p-5">
          <h3 className="font-semibold">What to work on</h3>
          <ul className="mt-3 grid list-disc gap-2 pl-5 text-sm">
            {evaluation.weaknesses.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </div>

      {evaluation.struggled_questions.length ? (
        <div className="grid gap-3">
          <h3 className="font-semibold">Questions to prepare</h3>
          <ol className="grid gap-3">
            {evaluation.struggled_questions.map((q, i) => (
              <li key={q.turn_index} className="bg-card rounded-xl border p-4">
                <p className="font-medium">
                  {i + 1}. “{q.question}”
                </p>
                <p className="text-muted-foreground mt-2 text-sm">
                  <span className="text-foreground font-medium">Why it fell short: </span>
                  {q.why}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  <span className="text-foreground font-medium">A stronger answer: </span>
                  {q.better_answer}
                </p>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="bg-muted/40 flex flex-col gap-3 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">
            Next: {PERSONAS[next.persona].name}, {DIFFICULTIES[next.difficulty].label.toLowerCase()}, focusing on {next.focus}
          </p>
          <p className="text-muted-foreground text-sm">{next.reason}</p>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/app/investor-room">Practise again</Link>
        </Button>
      </div>
    </section>
  );
}
