"use client";

import { useActionState, useState } from "react";

import { CheckEmail } from "@/components/auth/check-email";

import { SubmitButton } from "@/components/auth/submit-button";
import { FormMessage, TextField } from "@/components/forms/fields";
import { register } from "@/lib/auth/actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/schemas";
import { initialFormState } from "@/lib/forms";
import type { Messages } from "@/lib/i18n/messages/en";
import { fill } from "@/lib/i18n/text";

export function RegisterForm({ t }: { t: Messages["auth"] }) {
  const [state, action] = useActionState(register, initialFormState);
  // "Start again" hides the check-your-email screen until the next sign-up.
  const [dismissed, setDismissed] = useState<typeof state | null>(null);
  const errors = state.fieldErrors;

  if (state.status === "success" && dismissed !== state) {
    return <CheckEmail email={state.values?.email ?? ""} t={t.register} onStartAgain={() => setDismissed(state)} />;
  }

  return (
    <form action={action} className="grid gap-4">
      {state.status === "success" ? null : <FormMessage status={state.status} message={state.message} />}
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
        revealLabels={{ show: t.showPassword, hide: t.hidePassword }}
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
