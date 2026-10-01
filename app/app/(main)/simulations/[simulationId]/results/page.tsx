import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LoadProblem } from "@/components/app/load-problem";
import { PractiseButton } from "@/components/simulation/practise-button";
import { RatingRow } from "@/components/simulation/rating-row";
import { RedFlagCard, type FlagView } from "@/components/simulation/red-flag-card";
import { SimulationSummary } from "@/components/simulation/summary";
import { Button } from "@/components/ui/button";
import { DIFFICULTIES, PERSONAS, roundTitle } from "@/lib/ai/personas";
import { finalEvaluationSchema, type TurnEvaluation } from "@/lib/ai/schemas/simulation";
import { load } from "@/lib/data-errors";
import { DOCUMENT_KINDS, type UploadableKind } from "@/lib/documents/rules";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Simulation results" };

const dateFormat = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" });

export default async function ResultsPage({ params }: PageProps<"/app/simulations/[simulationId]/results">) {
  const { simulationId } = await params;
  const loaded = await load(async () => {
    const supabase = await createClient();
    const { data: sim } = await supabase.from("simulations").select("*").eq("id", simulationId).eq("mode", "full").maybeSingle();
    if (!sim) return null;
    const [turns, flags, docs] = await Promise.all([
      supabase.from("simulation_turns").select("*").eq("simulation_id", sim.id).order("turn_index"),
      supabase.from("red_flags").select("id, turn_id, type, severity, description, evidence").eq("simulation_id", sim.id),
      supabase.from("documents").select("id, kind").eq("startup_id", sim.startup_id),
    ]);
    const questionIds = (turns.data ?? []).filter((t) => t.role === "investor").map((t) => t.id);
    const drills = questionIds.length
      ? await supabase
          .from("simulations")
          .select("id, source_turn_id, overall_score, ended_at")
          .eq("mode", "drill")
          .eq("status", "completed")
          .in("source_turn_id", questionIds)
          .order("ended_at", { ascending: false })
      : { data: [] };
    return {
      sim,
      turns: turns.data ?? [],
      flags: (flags.data ?? []) as unknown as FlagView[],
      docs: docs.data ?? [],
      drills: drills.data ?? [],
    };
  });
  if (!loaded.ok) return <LoadProblem code={loaded.code} />;
  if (!loaded.data) notFound();
  const { sim, turns, flags, docs, drills } = loaded.data;

  const final = sim.final_evaluation ? finalEvaluationSchema.safeParse(sim.final_evaluation) : null;
  const struggled = new Map((final?.success ? final.data.struggled_questions : []).map((q) => [q.turn_index, q]));
  const docLabels = Object.fromEntries(docs.map((d) => [d.id, DOCUMENT_KINDS[d.kind as UploadableKind]?.label ?? "Document"]));

  // Pair each investor question with the founder answer that followed it.
  const pairs = turns
    .filter((t) => t.role === "investor")
    .map((q) => ({ question: q, answer: turns.find((t) => t.turn_index === q.turn_index + 1 && t.role === "founder") }))
    .filter((p): p is { question: typeof p.question; answer: NonNullable<typeof p.answer> } => Boolean(p.answer));

  return (
    <div className="grid grid-cols-1 gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Results: {PERSONAS[sim.persona].name}</h1>
          <p className="text-muted-foreground text-sm">
            {DIFFICULTIES[sim.difficulty].label} · {dateFormat.format(new Date(sim.started_at))}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/app/investor-room/${sim.id}`}>Full transcript</Link>
          </Button>
          {sim.status === "completed" ? (
            <Button asChild size="sm">
              <Link href={`/app/reports?simulation=${sim.id}`}>Create report</Link>
            </Button>
          ) : null}
        </div>
      </div>

      {sim.status === "completed" && final?.success && sim.overall_score !== null && sim.investor_confidence ? (
        <SimulationSummary score={sim.overall_score} confidence={sim.investor_confidence} evaluation={final.data} />
      ) : (
        <p className="bg-muted/40 rounded-xl border p-4 text-sm">
          {sim.status === "abandoned" ? "You left this session early, so there's no overall feedback." : "Feedback isn't ready yet."}
        </p>
      )}

      <section aria-labelledby="answers-heading" className="grid gap-4">
        <div>
          <h2 id="answers-heading" className="text-lg font-semibold">
            Feedback on every answer
          </h2>
          <p className="text-muted-foreground text-sm">Practise any question again to improve your answer.</p>
        </div>
        <ol className="grid gap-4">
          {pairs.map(({ question, answer }, i) => {
            const evaluation = answer.evaluation as unknown as TurnEvaluation | null;
            const hard = struggled.get(question.turn_index);
            const attempts = drills.filter((d) => d.source_turn_id === question.id);
            const best = attempts.reduce<number | null>((m, d) => (d.overall_score !== null && (m === null || d.overall_score > m) ? d.overall_score : m), null);
            return (
              <li key={question.id} className="bg-card grid gap-4 rounded-xl border p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-muted-foreground text-xs">
                    Question {i + 1} · {roundTitle(sim.persona, question.round)}
                  </p>
                  {hard ? (
                    <span className="bg-warning/20 rounded-full px-2 py-0.5 text-xs font-medium">To prepare</span>
                  ) : null}
                </div>
                <p className="font-medium">“{question.content}”</p>
                <blockquote className="text-muted-foreground border-l-2 pl-3 text-sm whitespace-pre-wrap">{answer.content}</blockquote>
                {evaluation ? (
                  <>
                    <RatingRow evaluation={evaluation} />
                    <p className="text-sm">{evaluation.notes}</p>
                  </>
                ) : null}
                {hard ? (
                  <div className="grid gap-1 text-sm">
                    <p>
                      <span className="font-medium">Why it fell short: </span>
                      {hard.why}
                    </p>
                    <p>
                      <span className="font-medium">A stronger answer: </span>
                      {hard.better_answer}
                    </p>
                  </div>
                ) : null}
                {flags
                  .filter((f) => f.turn_id === answer.id)
                  .map((f) => (
                    <RedFlagCard key={f.id} flag={f} docLabels={docLabels} />
                  ))}
                <div className="flex flex-wrap items-center gap-3">
                  <PractiseButton questionTurnId={question.id} />
                  {attempts.length ? (
                    <span className="text-muted-foreground text-xs">
                      Practised {attempts.length} {attempts.length === 1 ? "time" : "times"} · best {best}
                      {" · "}
                      <Link href={`/app/investor-room/${attempts[0].id}`} className="underline underline-offset-4">
                        latest
                      </Link>
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
