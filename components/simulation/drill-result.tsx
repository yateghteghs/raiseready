import Link from "next/link";

import { RatingRow } from "@/components/simulation/rating-row";
import { PractiseButton } from "@/components/simulation/practise-button";
import { Button } from "@/components/ui/button";
import type { TurnEvaluation } from "@/lib/ai/schemas/simulation";

export type DrillFeedback = {
  improvement: string;
  still_missing: string;
  better_answer: string;
  previous: TurnEvaluation | null;
};

export function DrillResult({
  score,
  evaluation,
  feedback,
  questionTurnId,
  sourceSimulationId,
}: {
  score: number;
  evaluation: TurnEvaluation | null;
  feedback: DrillFeedback;
  questionTurnId: string | null;
  sourceSimulationId: string | null;
}) {
  const previousAvg = feedback.previous
    ? Math.round(((feedback.previous.clarity + feedback.previous.evidence + feedback.previous.consistency) / 30) * 100)
    : null;
  return (
    <section aria-labelledby="drill-heading" className="bg-card grid gap-5 rounded-xl border p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="drill-heading" className="text-muted-foreground text-sm">
            This answer
          </h2>
          <p className="text-5xl font-semibold tabular-nums">{score}</p>
        </div>
        {previousAvg !== null ? (
          <p className="text-sm">
            First attempt: <span className="font-medium tabular-nums">{previousAvg}</span>
            <span className={score >= previousAvg ? "text-primary ml-2 font-medium" : "text-destructive ml-2 font-medium"}>
              {score >= previousAvg ? `▲ ${score - previousAvg}` : `▼ ${previousAvg - score}`}
            </span>
          </p>
        ) : null}
      </div>
      {evaluation ? <RatingRow evaluation={evaluation} /> : null}
      <div className="grid gap-3 text-sm">
        <p>
          <span className="font-medium">Compared with before: </span>
          {feedback.improvement}
        </p>
        <p>
          <span className="font-medium">Still missing: </span>
          {feedback.still_missing}
        </p>
        <p>
          <span className="font-medium">A strong answer would: </span>
          {feedback.better_answer}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        {questionTurnId ? <PractiseButton questionTurnId={questionTurnId} label="Try again" /> : null}
        {sourceSimulationId ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/app/simulations/${sourceSimulationId}/results`}>Back to results</Link>
          </Button>
        ) : null}
      </div>
    </section>
  );
}
