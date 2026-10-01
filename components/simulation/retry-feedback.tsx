"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { retryFeedbackAction } from "@/lib/simulation/actions";

export function RetryFeedbackButton({ simulationId }: { simulationId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <div className="bg-muted/40 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm">Your feedback is taking longer than expected.</p>
      <Button
        type="button"
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await retryFeedbackAction(simulationId);
          setTimeout(() => router.refresh(), 2000);
        }}
      >
        {busy ? "Retrying…" : "Retry feedback"}
      </Button>
    </div>
  );
}
