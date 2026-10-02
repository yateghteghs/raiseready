"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/auth/submit-button";
import { FormMessage } from "@/components/forms/fields";
import { initialFormState } from "@/lib/forms";
import { joinTeamAction } from "@/lib/teams/actions";

export function JoinTeamForm({ token, name }: { token: string; name: string }) {
  const [state, action] = useActionState(joinTeamAction.bind(null, token), initialFormState);
  return (
    <form action={action} className="grid gap-3">
      <FormMessage status={state.status} message={state.message} />
      <SubmitButton pendingText="Joining…" className="w-full">
        Join {name}
      </SubmitButton>
    </form>
  );
}
