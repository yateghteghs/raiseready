"use client";

import { useActionState, useState, useTransition } from "react";

import { SubmitButton } from "@/components/auth/submit-button";
import { FormMessage, TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { deleteFxRateAction, saveFxRateAction } from "@/lib/currency/fx-actions";
import { initialFormState } from "@/lib/forms";

function RemoveRate({ currency }: { currency: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => {
          if (window.confirm(`Stop showing estimates in ${currency}?`)) start(async () => setError((await deleteFxRateAction(currency)).error ?? null));
        }}
      >
        Remove
      </Button>
      {error ? (
        <span role="alert" className="text-destructive text-xs">
          {error}
        </span>
      ) : null}
    </>
  );
}

export function FxRates({ rates }: { rates: { currency: string; per_usd: number; updated_at: string }[] }) {
  const [state, action] = useActionState(saveFxRateAction, initialFormState);
  return (
    <div className="grid gap-4">
      {rates.length ? (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-start text-xs">
              <tr>
                <th className="px-4 py-2 text-start font-medium">Currency</th>
                <th className="px-4 py-2 text-start font-medium">Per US dollar</th>
                <th className="px-4 py-2 text-start font-medium">Updated</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <tr key={r.currency} className="border-t">
                  <td className="px-4 py-2 font-medium">{r.currency}</td>
                  <td className="px-4 py-2 tabular-nums">{r.per_usd}</td>
                  <td className="text-muted-foreground px-4 py-2">{new Date(r.updated_at).toLocaleDateString("en-GB")}</td>
                  <td className="px-4 py-2 text-end">
                    <RemoveRate currency={r.currency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">No rates yet, so visitors outside Nigeria see US dollars only.</p>
      )}
      <form action={action} noValidate className="bg-card grid gap-4 rounded-xl border p-5 sm:grid-cols-[10rem_12rem_auto] sm:items-start">
        <TextField name="currency" label="Currency code" placeholder="KES" maxLength={3} defaultValue={state.values?.currency} errors={state.fieldErrors} />
        <TextField name="per_usd" label="Per 1 US dollar" type="number" step="any" min={0} placeholder="129" defaultValue={state.values?.per_usd} errors={state.fieldErrors} />
        <SubmitButton pendingText="Saving…" className="sm:mt-6 justify-self-start">
          Save rate
        </SubmitButton>
        <div className="sm:col-span-3">
          <FormMessage status={state.status} message={state.message} />
        </div>
      </form>
    </div>
  );
}
