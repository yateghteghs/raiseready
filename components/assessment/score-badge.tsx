import type { BandId } from "@/lib/scoring/rubric";
import { cn } from "@/lib/utils";

const BAND_STYLES: Record<BandId, string> = {
  not_ready: "bg-destructive/10 text-destructive",
  getting_there: "bg-warning/20 text-foreground",
  nearly_ready: "bg-accent text-accent-foreground",
  investor_ready: "bg-primary text-primary-foreground",
};

export function BandBadge({ band, label, className }: { band: BandId; label: string; className?: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", BAND_STYLES[band], className)}>
      {label}
    </span>
  );
}

export function ScoreBar({ score, label }: { score: number; label: string }) {
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score}
      className="bg-muted h-2 overflow-hidden rounded-full"
    >
      <div
        className={cn("h-2 rounded-full", score < 50 ? "bg-destructive" : score < 70 ? "bg-warning" : "bg-primary")}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}

export function ScoreChange({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-muted-foreground text-sm">First assessment</span>;
  if (delta === 0) return <span className="text-muted-foreground text-sm">No change since last time</span>;
  return (
    <span className={cn("text-sm font-medium", delta > 0 ? "text-primary" : "text-destructive")}>
      {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} since last assessment
    </span>
  );
}
