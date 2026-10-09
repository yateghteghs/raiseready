"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { recheckPaymentAction } from "@/lib/billing/recheck-actions";

/** Asks Paystack about a payment that isn't marked paid, and applies it if it went through. */
export function RecheckPayment({ reference }: { reference: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  return (
    <div className="grid justify-items-start gap-1">
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => start(async () => setResult(await recheckPaymentAction(reference)))}>
        {pending ? "Checking…" : "Check with Paystack"}
      </Button>
      {result ? <p className={`max-w-xs text-xs ${result.ok ? "text-primary" : "text-destructive"}`}>{result.message}</p> : null}
    </div>
  );
}
