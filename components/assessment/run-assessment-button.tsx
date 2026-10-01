"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { runAssessmentAction } from "@/lib/assessment/actions";

export function RunAssessmentButton({ hasAssessment, disabled }: { hasAssessment: boolean; disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  function run() {
    setMessage(null);
    startTransition(async () => {
      const result = await runAssessmentAction();
      if (!result.ok) return setMessage({ kind: "error", text: result.error });
      if (result.reused) {
        setMessage({
          kind: "info",
          text: "Nothing has changed since your last assessment, so your score is the same. Update your documents or startup profile, then run it again.",
        });
      }
      router.refresh();
    });
  }

  return (
    <div className="grid justify-items-start gap-2">
      <Button type="button" onClick={run} disabled={pending || disabled}>
        {pending ? "Assessing…" : hasAssessment ? "Run assessment again" : "Run readiness assessment"}
      </Button>
      <p aria-live="polite" className="text-sm">
        {pending ? (
          <span className="text-muted-foreground">This usually takes one to two minutes. Please keep this page open.</span>
        ) : message ? (
          <span className={message.kind === "error" ? "text-destructive" : "text-muted-foreground"} role={message.kind === "error" ? "alert" : undefined}>
            {message.text}
          </span>
        ) : null}
      </p>
    </div>
  );
}
