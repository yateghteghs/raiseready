"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/auth/submit-button";
import { FormMessage } from "@/components/forms/fields";
import { Input } from "@/components/ui/input";
import { savePricesAction } from "@/lib/billing/price-actions";
import { initialFormState } from "@/lib/forms";

export type PriceRow = { product: string; label: string; note: string; NGN: number; USD: number };

/** One row per product, naira and dollars side by side, in whole units. */
export function PriceForm({ rows, usdOn }: { rows: PriceRow[]; usdOn: boolean }) {
  const [state, action] = useActionState(savePricesAction, initialFormState);
  const errors = state.fieldErrors ?? {};
  const value = (key: string, fallback: number) => state.values?.[key] ?? String(fallback);

  return (
    <form action={action} noValidate className="grid gap-4">
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <caption className="sr-only">Prices</caption>
          <thead className="bg-muted/40 text-muted-foreground text-xs">
            <tr>
              <th scope="col" className="px-4 py-2 text-start font-medium">
                Product
              </th>
              <th scope="col" className="px-4 py-2 text-start font-medium">
                Naira (₦)
              </th>
              <th scope="col" className="px-4 py-2 text-start font-medium">
                US dollars ($){usdOn ? "" : " · not shown yet"}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.product}>
                <td className="px-4 py-3">
                  <span className="font-medium">{r.label}</span>
                  <span className="text-muted-foreground block text-xs">{r.note}</span>
                </td>
                {(["NGN", "USD"] as const).map((currency) => {
                  const key = `${currency}.${r.product}`;
                  const error = errors[key]?.[0];
                  return (
                    <td key={currency} className="px-4 py-3 align-top">
                      <Input
                        name={key}
                        aria-label={`${r.label} in ${currency}`}
                        inputMode="numeric"
                        defaultValue={value(key, r[currency] / 100)}
                        aria-invalid={error ? true : undefined}
                        className="w-36"
                      />
                      {error ? <span className="text-destructive mt-1 block text-xs">{error}</span> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <FormMessage status={state.status} message={state.message} />
      <SubmitButton pendingText="Saving…" className="justify-self-start">
        Save prices
      </SubmitButton>
    </form>
  );
}
