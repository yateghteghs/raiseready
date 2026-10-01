"use client";

import { useActionState, useState } from "react";

import { SubmitButton } from "@/components/auth/submit-button";
import { FormMessage, TextareaField, TextField } from "@/components/forms/fields";
import { Label } from "@/components/ui/label";
import { initialFormState } from "@/lib/forms";
import { IMAGE_ACCEPT } from "@/lib/images/rules";
import { createShowcaseAction } from "@/lib/showcase/actions";
import { SHOWCASE_KINDS } from "@/lib/showcase/schema";

export function ShowcaseForm() {
  const [state, action] = useActionState(createShowcaseAction, initialFormState);
  const [kind, setKind] = useState<string>(state.values?.kind ?? "logo");
  const v = state.status === "success" ? {} : (state.values ?? {});
  const errors = state.fieldErrors;

  return (
    <form action={action} key={state.status === "success" ? state.message : "form"} noValidate className="bg-card grid gap-4 rounded-xl border p-5">
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Type</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {SHOWCASE_KINDS.map((k) => (
            <label key={k.value} className="has-checked:border-primary flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm">
              <span className="flex items-center gap-2 font-medium">
                <input type="radio" name="kind" value={k.value} checked={kind === k.value} onChange={() => setKind(k.value)} className="accent-primary" />
                {k.label}
              </span>
              <span className="text-muted-foreground text-xs">{k.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="name" label={kind === "partner" ? "Organisation name" : "Startup name"} defaultValue={v.name} errors={errors} />
        <TextField name="url" label="Website" optional placeholder="https://…" defaultValue={v.url} errors={errors} />
      </div>
      {kind === "testimonial" ? (
        <>
          <TextareaField name="quote" label="Quote" rows={3} maxLength={600} defaultValue={v.quote} errors={errors} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="person_name" label="Who said it" defaultValue={v.person_name} errors={errors} />
            <TextField name="person_title" label="Their role" optional placeholder="e.g. Co-founder & CEO" defaultValue={v.person_title} errors={errors} />
          </div>
        </>
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="showcase-image">{kind === "testimonial" ? "Photo or logo (optional)" : "Logo"}</Label>
        <input id="showcase-image" name="image" type="file" accept={IMAGE_ACCEPT} className="text-sm" />
        <p className="text-muted-foreground text-xs">PNG or JPEG, up to 2 MB. Logos look best on a transparent or white background.</p>
      </div>
      <TextField name="position" label="Order" hint="Lower numbers show first." type="number" min={0} max={999} optional defaultValue={v.position ?? "0"} className="max-w-32" errors={errors} />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="permission_confirmed" defaultChecked={v.permission_confirmed === "on"} className="accent-primary mt-1" />
        <span>
          I confirm this company or person has agreed to appear on the RaiseReady website.
          {errors?.permission_confirmed ? <span className="text-destructive block text-xs">{errors.permission_confirmed[0]}</span> : null}
        </span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="published" defaultChecked={v.published === "on"} className="accent-primary" /> Publish now (otherwise saved as a draft)
      </label>
      <FormMessage status={state.status} message={state.message} />
      <SubmitButton pendingText="Saving…" className="justify-self-start">
        Add
      </SubmitButton>
    </form>
  );
}
