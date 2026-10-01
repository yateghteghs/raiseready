"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/auth/submit-button";
import { FormMessage } from "@/components/forms/fields";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { initialFormState } from "@/lib/forms";
import { createReportAction } from "@/lib/reports/actions";

export function CreateReportForm({
  sessions,
  defaultSession,
}: {
  sessions: { id: string; label: string }[];
  defaultSession: string;
}) {
  const [state, action] = useActionState(createReportAction, initialFormState);
  return (
    <form action={action} className="bg-card grid gap-4 rounded-xl border p-5">
      <FormMessage status={state.status} message={state.message} />
      <div className="grid max-w-md gap-2">
        <Label htmlFor="simulation_id">Include a practice meeting</Label>
        <NativeSelect id="simulation_id" name="simulation_id" defaultValue={defaultSession}>
          <option value="">None, assessment only</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid justify-items-start gap-1">
        <SubmitButton pendingText="Creating report…">Create report</SubmitButton>
        <p className="text-muted-foreground text-xs">Takes up to a minute. Uses your latest readiness assessment.</p>
      </div>
    </form>
  );
}
