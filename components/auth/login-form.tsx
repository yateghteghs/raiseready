"use client";

import Link from "next/link";
import { useActionState } from "react";

import { SubmitButton } from "@/components/auth/submit-button";
import { FormMessage, TextField } from "@/components/forms/fields";
import { login } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/forms";
import type { Messages } from "@/lib/i18n/messages/en";

export function LoginForm({ next, t }: { next?: string; t: Messages["auth"] }) {
  const [state, action] = useActionState(login, initialFormState);
  const errors = state.fieldErrors;

  return (
    <form action={action} className="grid gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormMessage status={state.status} message={state.message} />
      <TextField
        name="email"
        label={t.email}
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        errors={errors}
      />
      <div className="grid gap-2">
        <TextField
          name="password"
          label={t.password}
          type="password"
          autoComplete="current-password"
          errors={errors}
        />
        <Link
          href="/forgot-password"
          className="text-muted-foreground hover:text-foreground justify-self-end text-sm underline-offset-4 hover:underline"
        >
          {t.login.forgot}
        </Link>
      </div>
      <SubmitButton pendingText={t.login.pending} className="w-full">
        {t.login.submit}
      </SubmitButton>
    </form>
  );
}
