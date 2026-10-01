import { ScoreBar } from "@/components/assessment/score-badge";
import type { TurnEvaluation } from "@/lib/ai/schemas/simulation";

/** Clarity / evidence / consistency, each out of 10. */
export function RatingRow({ evaluation }: { evaluation: TurnEvaluation }) {
  const items = [
    ["Clarity", evaluation.clarity],
    ["Evidence", evaluation.evidence],
    ["Consistency", evaluation.consistency],
  ] as const;
  return (
    <dl className="grid grid-cols-3 gap-3">
      {items.map(([label, value]) => (
        <div key={label} className="grid gap-1">
          <dt className="text-muted-foreground flex justify-between text-xs">
            {label}
            <span className="text-foreground font-medium tabular-nums">{value}/10</span>
          </dt>
          <dd>
            <ScoreBar score={value * 10} label={`${label} ${value} out of 10`} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
