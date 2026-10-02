"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/auth/submit-button";
import { FormMessage, TextField } from "@/components/forms/fields";
import { saveReferralSettingsAction } from "@/lib/billing/discount-actions";
import { initialFormState } from "@/lib/forms";

export function ReferralSettingsForm({
  initial,
}: {
  initial: { enabled: boolean; friendPercentOff: number; referrerCredits: number };
}) {
  const [state, action] = useActionState(saveReferralSettingsAction, initialFormState);
  const v = state.status === "error" ? state.values : undefined;
  return (
    <form action={action} noValidate className="bg-card grid gap-4 rounded-xl border p-5">
      <div>
        <h2 className="font-semibold">Referral programme</h2>
        <p className="text-muted-foreground text-sm">
          Every founder has an invite link on their Billing page. These settings apply to checkouts and rewards from now on.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="enabled" defaultChecked={v ? v.enabled === "on" : initial.enabled} className="accent-primary" />
        Referral programme on
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="friend_percent_off"
          label="Discount for invited founders (%)"
          hint="Off their first purchase. A discount code they enter is used instead if it's bigger. 0 = no discount."
          type="number"
          min={0}
          max={100}
          defaultValue={v?.friend_percent_off ?? String(initial.friendPercentOff)}
          errors={state.fieldErrors}
        />
        <TextField
          name="referrer_credits"
          label="Credits for the inviter"
          hint="Free simulation credits when an invited founder first pays. 0 = no reward."
          type="number"
          min={0}
          max={50}
          defaultValue={v?.referrer_credits ?? String(initial.referrerCredits)}
          errors={state.fieldErrors}
        />
      </div>
      <FormMessage status={state.status} message={state.message} />
      <SubmitButton pendingText="Saving…" className="justify-self-start">
        Save referral settings
      </SubmitButton>
    </form>
  );
}
