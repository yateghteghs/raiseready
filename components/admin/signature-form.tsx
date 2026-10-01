"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/auth/submit-button";
import { FormMessage, TextField } from "@/components/forms/fields";
import { Label } from "@/components/ui/label";
import { initialFormState } from "@/lib/forms";
import { IMAGE_ACCEPT } from "@/lib/images/rules";
import { saveSignatureAction } from "@/lib/reports/signature-actions";

export function SignatureForm({
  initial,
}: {
  initial: { signer_name: string; signer_title: string; enabled: boolean; imageUrl: string | null; hasImage: boolean };
}) {
  const [state, action] = useActionState(saveSignatureAction, initialFormState);
  const v = state.values;
  return (
    <form action={action} noValidate className="bg-card grid max-w-xl gap-4 rounded-xl border p-5">
      <TextField name="signer_name" label="Name of the person signing" defaultValue={v?.signer_name ?? initial.signer_name} errors={state.fieldErrors} />
      <TextField name="signer_title" label="Their title" optional placeholder="e.g. Head of Programmes" defaultValue={v?.signer_title ?? initial.signer_title} errors={state.fieldErrors} />
      <div className="grid gap-2">
        <Label htmlFor="image">Signature image</Label>
        <p className="text-muted-foreground text-xs">PNG (ideally with a transparent background) or JPEG, up to 2 MB. Sign on white paper and photograph it, or use a signing app.</p>
        {initial.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed link
          <img src={initial.imageUrl} alt="Current signature" className="h-14 max-w-48 justify-self-start rounded border bg-white object-contain p-1" />
        ) : null}
        <input id="image" name="image" type="file" accept={IMAGE_ACCEPT} className="text-sm" />
        {initial.hasImage ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="remove_image" className="accent-primary" /> Remove the current signature image
          </label>
        ) : null}
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="enabled" defaultChecked={v ? v.enabled === "on" : initial.enabled} className="accent-primary mt-1" />
        <span>
          Add the &ldquo;Issued by RaiseReady&rdquo; signature block to new PDF reports
          <span className="text-muted-foreground block text-xs">
            Each report also states that it is an AI-assisted practice assessment, not investment advice or an endorsement.
          </span>
        </span>
      </label>
      <FormMessage status={state.status} message={state.message} />
      <SubmitButton pendingText="Saving…" className="justify-self-start">
        Save
      </SubmitButton>
    </form>
  );
}
