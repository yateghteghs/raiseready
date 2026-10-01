"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { FormMessage, TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { deleteMyAccount } from "@/lib/account/actions";
import { DELETE_CONFIRMATION } from "@/lib/account/schema";
import { initialFormState } from "@/lib/forms";

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending} aria-disabled={pending} className="justify-self-start">
      {pending ? "Deleting your account…" : "Delete my account permanently"}
    </Button>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState(deleteMyAccount, initialFormState);
  return (
    <form action={action} noValidate className="grid gap-4">
      <TextField
        name="confirm"
        label={`Type ${DELETE_CONFIRMATION} to confirm`}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        defaultValue={state.values?.confirm ?? ""}
        errors={state.fieldErrors}
        className="max-w-xs"
      />
      <FormMessage status={state.status} message={state.message} />
      <DeleteButton />
    </form>
  );
}
