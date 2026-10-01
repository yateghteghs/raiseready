import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LoadProblem } from "@/components/app/load-problem";
import { RetryFeedbackButton } from "@/components/simulation/retry-feedback";
import { Room } from "@/components/simulation/room";
import { SimulationSummary } from "@/components/simulation/summary";
import type { FlagView } from "@/components/simulation/red-flag-card";
import { Button } from "@/components/ui/button";
import { DIFFICULTIES, PERSONAS, roundTitle } from "@/lib/ai/personas";
import { finalEvaluationSchema } from "@/lib/ai/schemas/simulation";
import { load } from "@/lib/data-errors";
import { DOCUMENT_KINDS, type UploadableKind } from "@/lib/documents/rules";
import { abandonSimulationAction } from "@/lib/simulation/actions";
import { MAX_ANSWER_CHARS } from "@/lib/simulation/service";
import { MAX_INVESTOR_TURNS } from "@/lib/simulation/state";
import { feedbackOverdue } from "@/lib/simulation/view";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Investor Room" };

export default async function SimulationPage({ params }: PageProps<"/app/investor-room/[simulationId]">) {
  const { simulationId } = await params;
  const loaded = await load(async () => {
    const supabase = await createClient();
    const { data: sim, error } = await supabase.from("simulations").select("*").eq("id", simulationId).maybeSingle();
    if (error || !sim) return null;
    const [turns, flags, docs] = await Promise.all([
      supabase.from("simulation_turns").select("id, turn_index, round, role, content").eq("simulation_id", sim.id).order("turn_index"),
      supabase.from("red_flags").select("id, turn_id, type, severity, description, evidence").eq("simulation_id", sim.id).order("created_at"),
      supabase.from("documents").select("id, kind").eq("startup_id", sim.startup_id),
    ]);
    return { sim, turns: turns.data ?? [], flags: (flags.data ?? []) as unknown as FlagView[], docs: docs.data ?? [] };
  });
  if (!loaded.ok) return <LoadProblem code={loaded.code} />;
  if (!loaded.data) notFound();
  const { sim, turns, flags, docs } = loaded.data;

  const persona = PERSONAS[sim.persona];
  const evaluating = sim.status === "active" && Boolean(sim.ended_at);
  const mode = sim.status === "active" ? (evaluating ? "evaluating" : "live") : "closed";
  const finalEval = sim.final_evaluation ? finalEvaluationSchema.safeParse(sim.final_evaluation) : null;
  const canRetryFeedback = evaluating && feedbackOverdue(sim.ended_at);

  return (
    <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meeting with a {persona.name.toLowerCase()}</h1>
          <p className="text-muted-foreground text-sm">
            {DIFFICULTIES[sim.difficulty].label}
            {sim.funding_type ? ` · Raising: ${sim.funding_type}` : ""}
            {sim.status === "abandoned" ? " · You left this session early" : ""}
          </p>
        </div>
        {mode === "live" ? (
          <form action={abandonSimulationAction.bind(null, sim.id)}>
            <Button type="submit" variant="ghost" size="sm">
              Leave session
            </Button>
          </form>
        ) : null}
      </div>

      {sim.status === "completed" && finalEval?.success && sim.overall_score !== null && sim.investor_confidence ? (
        <SimulationSummary score={sim.overall_score} confidence={sim.investor_confidence} evaluation={finalEval.data} />
      ) : null}
      {canRetryFeedback ? <RetryFeedbackButton simulationId={sim.id} /> : null}

      <Room
        key={`${sim.id}-${mode}`}
        simulationId={sim.id}
        investorName={persona.name}
        plan={persona.rounds}
        roundTitles={Object.fromEntries(persona.rounds.map((r) => [r, roundTitle(sim.persona, r)]))}
        maxInvestorTurns={MAX_INVESTOR_TURNS}
        maxAnswerChars={MAX_ANSWER_CHARS}
        initialTurns={turns}
        initialFlags={flags}
        docLabels={Object.fromEntries(docs.map((d) => [d.id, DOCUMENT_KINDS[d.kind as UploadableKind]?.label ?? "Document"]))}
        mode={mode}
      />
    </div>
  );
}
