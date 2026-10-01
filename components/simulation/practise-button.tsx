"use client";

import { useState, useTransition } from "react";
import { RotateCcwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { startDrillAction } from "@/lib/simulation/actions";

export function PractiseButton({ questionTurnId, label = "Practise this question again" }: { questionTurnId: string; label?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid justify-items-start gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await startDrillAction(questionTurnId);
            if (result?.error) setError(result.error);
          })
        }
      >
        <RotateCcwIcon aria-hidden="true" />
        {pending ? "Opening…" : label}
      </Button>
      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
