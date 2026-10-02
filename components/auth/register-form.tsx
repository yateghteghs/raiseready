"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/auth/submit-button";
import { FormMessage, TextField } from "@/components/forms/fields";
import { register } from "@/lib/auth/actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/schemas";
import { initialFormState } from "@/lib/forms";
import type { Messages } from "@/lib/i18n/messages/en";
import { fill } from "@/lib/i18n/text";

export function RegisterForm({ t }: { t: Messages["auth"] }) {
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
        label={t.fullName}
        autoComplete="name"
        defaultValue={state.values?.full_name}
        errors={errors}
      />
      <TextField
        name="email"
        label={t.email}
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        errors={errors}
      />
      <TextField
        name="password"
        label={t.password}
        type="password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN_LENGTH}
        hint={fill(t.passwordHint, { min: PASSWORD_MIN_LENGTH })}
        errors={errors}
      />
      <SubmitButton pendingText={t.register.pending} className="w-full">
        {t.register.submit}
      </SubmitButton>
    </form>
  );
}
