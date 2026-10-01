/**
 * Illustrative report preview for the marketing pages. Clearly labelled as a
 * sample: the startup and figures are invented.
 */
const DIMENSIONS = [
  { name: "Problem clarity", score: 86 },
  { name: "Traction", score: 58 },
  { name: "Financial readiness", score: 41 },
  { name: "Competition / moat", score: 63 },
];

const QUESTIONS = [
  "Your deck says 1,200 customers but your model shows 800. Which is right?",
  "What is your monthly burn, and how many months of runway does this round buy?",
  "Why won't a bank-backed wallet copy this within a year?",
];

export function SampleReport() {
  return (
    <figure className="bg-card rounded-xl border shadow-sm">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <p className="text-sm font-medium">Readiness report</p>
        <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">Sample</span>
      </div>
      <div className="grid gap-6 p-5 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-start gap-1">
          <p className="text-muted-foreground text-xs">Overall score</p>
          <p className="text-5xl font-semibold tracking-tight">64</p>
          <p className="bg-warning/20 rounded-full px-2 py-0.5 text-xs font-medium">Getting there</p>
        </div>
        <ul className="grid gap-3" aria-label="Scores by area">
          {DIMENSIONS.map((d) => (
            <li key={d.name} className="grid gap-1">
              <div className="flex justify-between text-sm">
                <span>{d.name}</span>
                <span className="text-muted-foreground tabular-nums">{d.score}</span>
              </div>
              <div className="bg-muted h-1.5 rounded-full" aria-hidden="true">
                <div
                  className={d.score < 50 ? "bg-destructive h-1.5 rounded-full" : "bg-primary h-1.5 rounded-full"}
                  style={{ width: `${d.score}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="border-t p-5">
        <p className="text-sm font-medium">Questions to prepare</p>
        <ol className="text-muted-foreground mt-3 grid list-decimal gap-2 pl-5 text-sm">
          {QUESTIONS.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
      </div>
      <figcaption className="text-muted-foreground border-t px-5 py-3 text-xs">
        Example only. The startup and numbers are invented.
      </figcaption>
    </figure>
  );
}
