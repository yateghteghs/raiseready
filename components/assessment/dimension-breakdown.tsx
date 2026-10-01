import { ScoreBar } from "@/components/assessment/score-badge";
import type { DimensionResult } from "@/lib/assessment/service";
import { WEAK_THRESHOLD, type Rating } from "@/lib/scoring/rubric";
import { cn } from "@/lib/utils";

const RATING: Record<Rating, { label: string; className: string }> = {
  met: { label: "Met", className: "bg-accent text-accent-foreground" },
  partial: { label: "Partly", className: "bg-warning/20" },
  not_met: { label: "Missing", className: "bg-destructive/10 text-destructive" },
  not_applicable: { label: "N/A", className: "bg-muted text-muted-foreground" },
};

/** Each area with its score; open one to see indicator ratings and feedback. */
export function DimensionBreakdown({ dimensions }: { dimensions: DimensionResult[] }) {
  return (
    <ul className="grid gap-3">
      {dimensions.map((d) => (
        <li key={d.id}>
          <details className="group bg-card rounded-xl border">
            <summary className="hover:bg-muted/40 grid cursor-pointer list-none gap-2 rounded-xl p-4 [&::-webkit-details-marker]:hidden">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">
                  {d.name}
                  <span className="text-muted-foreground ml-2 text-xs font-normal">
                    {d.score === null ? "not scored yet" : `${d.effectiveWeight}% of score`}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-lg font-semibold tabular-nums">{d.score ?? "–"}</span>
                  <span aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-180">
                    ▾
                  </span>
                </span>
              </div>
              {d.score !== null ? <ScoreBar score={d.score} label={`${d.name} score`} /> : null}
            </summary>
            <div className="grid gap-5 border-t p-4">
              {d.excludedReason === "needs_simulation" ? (
                <p className="text-muted-foreground text-sm">
                  Scored once you&apos;ve completed an Investor Room simulation. Until then the other areas are
                  re-weighted to make up the full score.
                </p>
              ) : null}
              {d.score !== null && d.score < WEAK_THRESHOLD && d.feedback ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-sm font-medium">Why it&apos;s weak</p>
                    <p className="text-muted-foreground mt-1 text-sm">{d.feedback.why_weak}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">What an investor would ask</p>
                    <p className="text-muted-foreground mt-1 text-sm">“{d.feedback.investor_question}”</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">How to fix it</p>
                    <p className="text-muted-foreground mt-1 text-sm">{d.feedback.fix}</p>
                  </div>
                </div>
              ) : null}
              {d.indicators.length ? (
                <ul className="grid gap-3">
                  {d.indicators.map((i) => (
                    <li key={i.id} className="grid gap-1 sm:grid-cols-[7rem_1fr] sm:gap-3">
                      <span className={cn("justify-self-start rounded-full px-2 py-0.5 text-xs font-medium", RATING[i.rating].className)}>
                        {RATING[i.rating].label}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{i.label}</p>
                        <p className="text-muted-foreground text-sm">{i.reason}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
