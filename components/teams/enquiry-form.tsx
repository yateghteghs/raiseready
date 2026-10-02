"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/auth/submit-button";
import { FormMessage, TextareaField, TextField } from "@/components/forms/fields";
import { initialFormState } from "@/lib/forms";
import { enquiryAction } from "@/lib/teams/actions";

export function TeamEnquiryForm() {
  const [state, action] = useActionState(enquiryAction, initialFormState);
  if (state.status === "success") return <FormMessage status="success" message={state.message} />;
  const v = state.values ?? {};
  return (
    <form action={action} noValidate className="bg-card grid gap-4 rounded-xl border p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="name" label="Your name" autoComplete="name" defaultValue={v.name} errors={state.fieldErrors} />
        <TextField name="email" label="Work email" type="email" autoComplete="email" defaultValue={v.email} errors={state.fieldErrors} />
        <TextField name="organisation" label="Accelerator, hub or programme" autoComplete="organization" defaultValue={v.organisation} errors={state.fieldErrors} />
        <TextField name="cohort_size" label="Founders in your cohort" type="number" min={1} optional defaultValue={v.cohort_size} errors={state.fieldErrors} />
      </div>
      <TextareaField name="message" label="Anything we should know?" optional rows={3} maxLength={2000} defaultValue={v.message} errors={state.fieldErrors} />
      {/* Left empty by people; bots fill it in. */}
      <div aria-hidden="true" className="hidden">
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <FormMessage status={state.status} message={state.message} />
      <SubmitButton pendingText="Sending…" className="justify-self-start">
        Send
      </SubmitButton>
    </form>
  );
}
