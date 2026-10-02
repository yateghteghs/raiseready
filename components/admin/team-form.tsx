"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/auth/submit-button";
import { FormMessage, TextareaField, TextField } from "@/components/forms/fields";
import { initialFormState } from "@/lib/forms";
import { saveTeamAction } from "@/lib/teams/actions";

export type TeamDefaults = { name: string; seats: string; ends_on: string; owner_email: string; notes: string };

export function TeamForm({ teamId, defaults }: { teamId?: string; defaults?: TeamDefaults }) {
  const [state, action] = useActionState(saveTeamAction.bind(null, teamId ?? null), initialFormState);
  const v = state.values ?? defaults ?? { name: "", seats: "20", ends_on: "", owner_email: "", notes: "" };
  const errors = state.fieldErrors;
  return (
    <form action={action} noValidate className="bg-card grid gap-4 rounded-xl border p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="name" label="Team name" placeholder="e.g. Lagos Startup Accelerator, Cohort 3" defaultValue={v.name} errors={errors} />
        <TextField
          name="owner_email"
          label="Programme contact's email"
          optional
          hint="Their RaiseReady account sees each member's progress. They must have signed up."
          defaultValue={v.owner_email}
          errors={errors}
        />
        <TextField name="seats" label="Seats" type="number" min={1} max={1000} defaultValue={v.seats} errors={errors} />
        <TextField name="ends_on" label="Access ends on" type="date" hint="Members keep Pro Plus until the end of this day." defaultValue={v.ends_on} errors={errors} />
      </div>
      <TextareaField name="notes" label="Notes" optional rows={2} hint="For staff only, e.g. the agreed price and invoice number." defaultValue={v.notes} errors={errors} />
      <FormMessage status={state.status} message={state.message} />
      <SubmitButton pendingText="Saving…" className="justify-self-start">
        {teamId ? "Save" : "Create team"}
      </SubmitButton>
    </form>
  );
}
