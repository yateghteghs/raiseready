"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/auth/submit-button";
import { FormMessage, TextField } from "@/components/forms/fields";
import { requestPasswordReset } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/forms";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, initialFormState);

  if (state.status === "success") {
    return <FormMessage status="success" message={state.message} />;
  }

  return (
    <form action={action} className="grid gap-4">
      <FormMessage status={state.status} message={state.message} />
      <TextField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        errors={state.fieldErrors}
      />
      <SubmitButton pendingText="Sending…" className="w-full">
        Send reset link
      </SubmitButton>
    </form>
  );
}
