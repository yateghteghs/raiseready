"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/auth/submit-button";
import { FormMessage } from "@/components/forms/fields";
import { buildDeckAction } from "@/lib/decks/actions";
import { initialFormState } from "@/lib/forms";

export function BuildDeckForm({ label, note }: { label: string; note: string }) {
  const [state, action] = useActionState(buildDeckAction, initialFormState);
  return (
    <form action={action} className="grid justify-items-start gap-2">
      <FormMessage status={state.status} message={state.message} action={state.action} />
      <SubmitButton pendingText="Writing your deck… (up to 2 minutes)">{label}</SubmitButton>
      <p className="text-muted-foreground text-xs">{note}</p>
    </form>
  );
}
