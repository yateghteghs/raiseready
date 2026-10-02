"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/auth/submit-button";
import { FormMessage, TextField } from "@/components/forms/fields";
import { createDiscountCodeAction } from "@/lib/billing/discount-actions";
import { initialFormState } from "@/lib/forms";

const PRODUCTS = [
  { value: "pro_monthly", label: "Pro (first month)" },
  { value: "credits_3", label: "3 credits" },
  { value: "credits_10", label: "10 credits" },
];

export function DiscountForm() {
  const [state, action] = useActionState(createDiscountCodeAction, initialFormState);
  const v = state.status === "success" ? {} : (state.values ?? {});
  const errors = state.fieldErrors;
  return (
    <form action={action} key={state.status === "success" ? state.message : "form"} noValidate className="bg-card grid gap-4 rounded-xl border p-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField name="code" label="Code" placeholder="e.g. LAUNCH20" autoCapitalize="characters" defaultValue={v.code} errors={errors} />
        <TextField name="percent_off" label="Percent off" type="number" min={1} max={100} defaultValue={v.percent_off ?? "20"} errors={errors} />
        <TextField name="description" label="Note for staff" optional placeholder="e.g. Lagos Startup Week" defaultValue={v.description} errors={errors} />
      </div>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Applies to</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          {PRODUCTS.map((p) => (
            <label key={p.value} className="flex items-center gap-2">
              <input type="checkbox" name="products" value={p.value} defaultChecked className="accent-primary" /> {p.label}
            </label>
          ))}
        </div>
        {errors?.products ? <p className="text-destructive text-xs">{errors.products[0]}</p> : null}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField name="max_redemptions" label="Total uses allowed" type="number" min={1} optional hint="Empty = unlimited. Each founder can use a code once." defaultValue={v.max_redemptions} errors={errors} />
        <TextField name="expires_on" label="Last day it works" type="date" optional defaultValue={v.expires_on} errors={errors} />
      </div>
      <FormMessage status={state.status} message={state.message} />
      <SubmitButton pendingText="Creating…" className="justify-self-start">
        Create code
      </SubmitButton>
    </form>
  );
}
