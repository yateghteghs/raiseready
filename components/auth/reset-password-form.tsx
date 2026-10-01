"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/auth/submit-button";
import { FormMessage, TextField } from "@/components/forms/fields";
import { resetPassword } from "@/lib/auth/actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/schemas";
import { initialFormState } from "@/lib/forms";

export function ResetPasswordForm() {
  const [state, action] = useActionState(resetPassword, initialFormState);
  const errors = state.fieldErrors;

  return (
    <form action={action} className="grid gap-4">
      <FormMessage status={state.status} message={state.message} />
      <TextField
        name="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN_LENGTH}
        hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        errors={errors}
      />
      <TextField
        name="confirm_password"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        errors={errors}
      />
      <SubmitButton pendingText="Saving…" className="w-full">
        Set new password
      </SubmitButton>
    </form>
  );
}
