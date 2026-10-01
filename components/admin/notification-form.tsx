"use client";

import { useActionState, useState } from "react";

import { SubmitButton } from "@/components/auth/submit-button";
import { FormMessage, TextareaField, TextField } from "@/components/forms/fields";
import { initialFormState } from "@/lib/forms";
import { sendNotificationAction } from "@/lib/notifications/actions";

export function NotificationForm() {
  const [state, action] = useActionState(sendNotificationAction, initialFormState);
  const [audience, setAudience] = useState(state.values?.audience ?? "all");
  // After a successful send, start the next message from an empty form.
  const values = state.status === "success" ? {} : (state.values ?? {});

  return (
    <form action={action} key={state.status === "success" ? state.message : "form"} noValidate className="bg-card grid gap-4 rounded-xl border p-5">
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Send to</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          {[
            { value: "all", label: "Everyone" },
            { value: "one", label: "One user" },
          ].map((o) => (
            <label key={o.value} className="flex items-center gap-2">
              <input type="radio" name="audience" value={o.value} checked={audience === o.value} onChange={() => setAudience(o.value)} className="accent-primary" />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>
      {audience === "one" ? (
        <TextField name="email" label="Their email address" type="email" defaultValue={values.email} errors={state.fieldErrors} />
      ) : null}
      <TextField name="title" label="Title" maxLength={120} defaultValue={values.title} errors={state.fieldErrors} />
      <TextareaField name="body" label="Message" rows={5} maxLength={2000} defaultValue={values.body} errors={state.fieldErrors} />
      <TextField
        name="link"
        label="Link inside the app"
        hint="Optional. For example /app/billing or /app/investor-room."
        optional
        defaultValue={values.link}
        errors={state.fieldErrors}
      />
      <FormMessage status={state.status} message={state.message} />
      <SubmitButton pendingText="Sending…" className="justify-self-start">
        Send notification
      </SubmitButton>
    </form>
  );
}
