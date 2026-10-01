"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { startExtractionAction } from "@/lib/documents/actions";

/** Starts an analysis and refreshes the page while one is running. */
export function AnalysePanel({
  canStart,
  running,
  hasProfile,
  failure,
}: {
  canStart: boolean;
  running: boolean;
  hasProfile: boolean;
  failure: string | null;
}) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [running, router]);

  async function start() {
    setError(null);
    setStarting(true);
    const result = await startExtractionAction();
    setStarting(false);
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  return (
    <div className="bg-muted/40 flex flex-col gap-3 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between">
      <div aria-live="polite">
        {running ? (
          <>
            <p className="font-medium">Analysing your documents…</p>
            <p className="text-muted-foreground text-sm">
              This usually takes one to three minutes. You can leave this page and come back.
            </p>
          </>
        ) : (
          <>
            <p className="font-medium">{hasProfile ? "Documents changed?" : "Ready when you are"}</p>
            <p className="text-muted-foreground text-sm">
              {canStart
                ? "We'll read your newest deck, model and plan and build your startup profile."
                : "Upload your pitch deck to start."}
            </p>
          </>
        )}
        {error ?? failure ? (
          <p role="alert" className="text-destructive mt-2 text-sm">
            {error ?? failure}
          </p>
        ) : null}
      </div>
      <Button type="button" onClick={start} disabled={!canStart || running || starting} className="shrink-0">
        {starting ? "Starting…" : running ? "Analysing…" : hasProfile ? "Re-analyse" : "Analyse documents"}
      </Button>
    </div>
  );
}
