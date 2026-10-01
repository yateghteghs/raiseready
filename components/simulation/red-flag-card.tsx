import { AlertTriangleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { RedFlagType, Severity } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

export type FlagView = {
  id: string;
  turn_id: string | null;
  type: RedFlagType;
  severity: Severity;
  description: string;
  evidence: {
    source: "document" | "founder_answer";
    document_id: string | null;
    page_or_sheet: string | null;
    turn_index: number | null;
    quote: string;
  }[];
};

const TYPE_LABELS: Record<RedFlagType, string> = {
  contradiction: "Contradiction",
  unsupported_claim: "Unsupported claim",
  weak_answer: "Weak answer",
  missing_info: "Missing information",
};

export function RedFlagCard({
  flag,
  docLabels,
  onClarify,
}: {
  flag: FlagView;
  docLabels: Record<string, string>;
  onClarify?: () => void;
}) {
  return (
    <div
      role="note"
      className={cn(
        "rounded-lg border px-4 py-3 text-sm",
        flag.severity === "high" ? "border-destructive/40 bg-destructive/5" : "border-warning/60 bg-warning/10",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 font-medium">
          <AlertTriangleIcon className="size-4 shrink-0" aria-hidden="true" />
          {TYPE_LABELS[flag.type]}
          <span className="text-muted-foreground text-xs font-normal">{flag.severity} risk</span>
        </p>
        {onClarify ? (
          <Button type="button" variant="outline" size="sm" onClick={onClarify}>
            Clarify
          </Button>
        ) : null}
      </div>
      <p className="mt-1">{flag.description}</p>
      {flag.evidence.length ? (
        <ul className="text-muted-foreground mt-2 grid gap-1 text-xs">
          {flag.evidence.map((e, i) => (
            <li key={i}>
              <span className="text-foreground font-medium">
                {e.source === "document"
                  ? `${docLabels[e.document_id ?? ""] ?? "Your documents"}${e.page_or_sheet ? `, ${e.page_or_sheet}` : ""}`
                  : `Your answer (turn ${e.turn_index})`}
                :
              </span>{" "}
              “{e.quote}”
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
