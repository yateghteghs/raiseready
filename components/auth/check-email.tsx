"use client";

import { MailCheckIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { resendConfirmation } from "@/lib/auth/actions";
import type { FormState } from "@/lib/forms";
import type { Messages } from "@/lib/i18n/messages/en";
import { fill } from "@/lib/i18n/text";

/** Shown after sign-up: where the link went, what to do if it doesn't arrive. */
export function CheckEmail({ email, t, onStartAgain }: { email: string; t: Messages["auth"]["register"]; onStartAgain: () => void }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<FormState | null>(null);
  return (
    <div role="status" className="grid gap-4">
      <div className="flex items-start gap-3">
        <span className="bg-accent text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
          <MailCheckIcon aria-hidden="true" className="size-5" />
        </span>
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">{t.checkTitle}</h2>
          <p className="text-sm">{fill(t.checkBody, { email })}</p>
        </div>
      </div>
      <p className="text-muted-foreground text-sm">{t.checkSpam}</p>
      {result ? <FormMessage status={result.status} message={result.message} /> : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="button" variant="outline" disabled={pending} onClick={() => start(async () => setResult(await resendConfirmation(email)))}>
          {pending ? t.resending : t.resend}
        </Button>
        <p className="text-muted-foreground text-sm">
          {t.wrongEmail}{" "}
          <button type="button" onClick={onStartAgain} className="text-foreground font-medium underline-offset-4 hover:underline">
            {t.startAgain}
          </button>
        </p>
      </div>
    </div>
  );
}
