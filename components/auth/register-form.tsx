"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/auth/submit-button";
import { FormMessage, TextField } from "@/components/forms/fields";
import { register } from "@/lib/auth/actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/schemas";
import { initialFormState } from "@/lib/forms";

export function RegisterForm() {
  const [state, action] = useActionState(register, initialFormState);
  const errors = state.fieldErrors;

  if (state.status === "success") {
    return <FormMessage status="success" message={state.message} />;
  }

  return (
    <form action={action} className="grid gap-4">
      <FormMessage status={state.status} message={state.message} />
      <TextField
        name="full_name"
        label="Full name"
        autoComplete="name"
        defaultValue={state.values?.full_name}
        errors={errors}
      />
      <TextField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        errors={errors}
      />
      <TextField
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN_LENGTH}
        hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        errors={errors}
      />
      <SubmitButton pendingText="Creating account…" className="w-full">
        Create account
      </SubmitButton>
    </form>
  );
}
