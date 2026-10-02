"use client";

import { useActionState, useState, useTransition } from "react";

import { SubmitButton } from "@/components/auth/submit-button";
import { FormMessage } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { deleteDeckAction, unlockDeckAction } from "@/lib/decks/actions";
import { initialFormState } from "@/lib/forms";

export function UnlockDeckForm({ deckId, label }: { deckId: string; label: string }) {
  const [state, action] = useActionState(unlockDeckAction.bind(null, deckId), initialFormState);
  return (
    <form action={action} className="grid justify-items-start gap-2">
      <FormMessage status={state.status} message={state.message} action={state.action} />
      <SubmitButton pendingText="Unlocking…">{label}</SubmitButton>
    </form>
  );
}

export function DeleteDeckButton({ deckId }: { deckId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid justify-items-start gap-1">
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Delete this deck? This can't be undone.")) return;
          start(async () => setError((await deleteDeckAction(deckId))?.error ?? null));
        }}
      >
        Delete deck
      </Button>
      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
