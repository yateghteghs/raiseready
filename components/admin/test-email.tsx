"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { sendTestEmailAction } from "@/lib/admin/staff-actions";

/** Emails the signed-in super admin, to check Mailtrap is set up. */
export function TestEmailButton() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ message?: string; error?: string } | null>(null);
  return (
    <div className="grid justify-items-start gap-2">
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => start(async () => setResult(await sendTestEmailAction()))}>
        {pending ? "Sending…" : "Send me a test email"}
      </Button>
      {result?.message ? (
        <p role="status" className="text-sm">
          {result.message}
        </p>
      ) : null}
      {result?.error ? (
        <p role="alert" className="text-destructive text-sm">
          {result.error}
        </p>
      ) : null}
    </div>
  );
}
