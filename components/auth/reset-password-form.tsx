"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/auth/submit-button";
import { FormMessage, TextField } from "@/components/forms/fields";
import { resetPassword } from "@/lib/auth/actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/schemas";
import { initialFormState } from "@/lib/forms";
import type { Messages } from "@/lib/i18n/messages/en";
import { fill } from "@/lib/i18n/text";

export function ResetPasswordForm({ t, next }: { t: Messages["auth"]; next?: string }) {
  const [state, action] = useActionState(resetPassword, initialFormState);
  const errors = state.fieldErrors;

  return (
    <form action={action} className="grid gap-4">
      <FormMessage status={state.status} message={state.message} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <TextField
        name="password"
        label={t.reset.newPassword}
        type="password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN_LENGTH}
        hint={fill(t.passwordHint, { min: PASSWORD_MIN_LENGTH })}
        errors={errors}
      />
      <TextField
        name="confirm_password"
        label={t.reset.confirm}
        type="password"
        autoComplete="new-password"
        errors={errors}
      />
      <SubmitButton pendingText={t.reset.pending} className="w-full">
        {t.reset.submit}
      </SubmitButton>
    </form>
  );
}
