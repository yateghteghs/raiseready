"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/auth/submit-button";
import { FormMessage, TextField } from "@/components/forms/fields";
import { adminLogin } from "@/lib/admin/login";
import { initialFormState } from "@/lib/forms";

export function AdminLoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(adminLogin, initialFormState);
  return (
    <form action={action} className="grid gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormMessage status={state.status} message={state.message} />
      <TextField name="email" label="Email" type="email" autoComplete="username" defaultValue={state.values?.email} errors={state.fieldErrors} />
      <TextField name="password" label="Password" type="password" autoComplete="current-password" errors={state.fieldErrors} />
      <SubmitButton pendingText="Signing in…" className="w-full">
        Sign in to admin
      </SubmitButton>
    </form>
  );
}
