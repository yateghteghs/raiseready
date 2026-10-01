"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/auth/submit-button";
import { FormMessage, SelectField, TextField } from "@/components/forms/fields";
import { saveAccountDetails } from "@/lib/account/actions";
import { initialFormState } from "@/lib/forms";
import { COUNTRY_OPTIONS } from "@/lib/startups/options";

export function AccountDetailsForm({ initialValues }: { initialValues: { full_name: string; country: string } }) {
  const [state, action] = useActionState(saveAccountDetails, initialFormState);
  const values = state.values ?? initialValues;
  return (
    <form action={action} noValidate className="grid gap-4">
      <TextField name="full_name" label="Your name" autoComplete="name" defaultValue={values.full_name} errors={state.fieldErrors} />
      <SelectField name="country" label="Country you're based in" options={COUNTRY_OPTIONS} defaultValue={values.country} errors={state.fieldErrors} />
      <FormMessage status={state.status} message={state.message} />
      <SubmitButton pendingText="Saving…" className="justify-self-start">
        Save details
      </SubmitButton>
    </form>
  );
}
