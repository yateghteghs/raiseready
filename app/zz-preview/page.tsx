import { AppHeader } from "@/components/app/app-header";
import { DimensionBreakdown } from "@/components/assessment/dimension-breakdown";
import { BandBadge, ScoreChange } from "@/components/assessment/score-badge";
import { summarise, type DimensionResult } from "@/lib/assessment/service";
import { DIMENSIONS, ALL_INDICATOR_IDS, type Rating } from "@/lib/scoring/rubric";
import { computeScores } from "@/lib/scoring/score";

export default function Preview() {
  const ratings = Object.fromEntries(ALL_INDICATOR_IDS.map((id, i) => [id, (["met", "partial", "not_met", "met"] as Rating[])[i % 4]]));
  const scores = computeScores(ratings, { hasSimulation: false });
  const dims: DimensionResult[] = scores.dimensions.map((s) => ({
    ...s,
    indicators: s.excludedReason ? [] : DIMENSIONS.find((d) => d.id === s.id)!.indicators.map((i) => ({ id: i.id, label: i.label, rating: ratings[i.id], reason: "The deck states 1,200 paying merchants on page 2 but gives no period." })),
    feedback: { why_weak: "Burn and runway are not stated anywhere.", investor_question: "How many months of runway do you have today?", fix: "Add a slide with monthly burn and runway in months." },
  }));
  const { actions } = summarise(dims);
  return (
    <>
      <AppHeader email="ada@example.com" nav={[{ href: "/app", label: "Dashboard" }, { href: "/app/startup", label: "Startup" }, { href: "/app/documents", label: "Documents" }, { href: "/app/assessment", label: "Assessment" }]} />
      <main className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8">
        <div className="bg-card rounded-xl border p-6">
          <p className="text-6xl font-semibold">{scores.overall}</p>
          <BandBadge band={scores.band} label="Getting there" />
          <div><ScoreChange delta={6} /></div>
          <p>{actions.map((a) => `${a.name} +${a.potential_points}`).join(" | ")}</p>
        </div>
        <DimensionBreakdown dimensions={dims} />
      </main>
    </>
  );
}
