"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/auth/submit-button";
import { FormMessage, TextareaField, TextField } from "@/components/forms/fields";
import { savePlanAction } from "@/lib/billing/plan-actions";
import type { PlanRule } from "@/lib/billing/plan-rules";
import { initialFormState } from "@/lib/forms";

type Option = { value: string; label: string };

function Checks({ name, legend, options, checked, error }: { name: string; legend: string; options: Option[]; checked: string[]; error?: string }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name={name} value={o.value} defaultChecked={checked.includes(o.value)} className="accent-primary" />
            {o.label}
          </label>
        ))}
      </div>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </fieldset>
  );
}

function Toggle({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={checked} className="accent-primary" />
      {label}
    </label>
  );
}

export function PlanForm({
  plan,
  rule,
  personas,
  difficulties,
}: {
  plan: string;
  rule: PlanRule;
  personas: Option[];
  difficulties: Option[];
}) {
  const [state, action] = useActionState(savePlanAction.bind(null, plan), initialFormState);
  const errors = state.fieldErrors;
  const paid = plan !== "free";
  return (
    <form action={action} noValidate className="bg-card grid gap-5 rounded-xl border p-5" key={plan}>
      <TextField
        name="description"
        label="Short description"
        optional
        maxLength={120}
        hint="Shown under the plan name. Leave empty to use the built-in wording, which is translated into every language."
        defaultValue={rule.description ?? ""}
        errors={errors}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {!paid ? (
          <TextField name="assessments" label="Readiness assessments (in total)" type="number" min={0} max={100} defaultValue={String(rule.assessments)} errors={errors} />
        ) : null}
        <TextField
          name="simulations"
          label={paid ? "Investor Room sessions each month" : "Investor Room sessions (in total)"}
          type="number"
          min={0}
          max={1000}
          defaultValue={String(rule.simulations)}
          errors={errors}
        />
        {paid ? (
          <>
            <TextField name="decksPerMonth" label="Pitch decks each month" type="number" min={0} max={100} defaultValue={String(rule.decksPerMonth)} errors={errors} />
            <TextField name="rewritesPerDeck" label="AI slide rewrites per deck" type="number" min={0} max={1000} defaultValue={String(rule.rewritesPerDeck)} errors={errors} />
          </>
        ) : null}
      </div>
      <Checks name="personas" legend="Investors included" options={personas} checked={rule.personas} error={errors?.personas?.[0]} />
      <Checks name="difficulties" legend="Difficulties included" options={difficulties} checked={rule.difficulties} error={errors?.difficulties?.[0]} />
      <div className="grid gap-2">
        <p className="text-sm font-medium">Features</p>
        <Toggle name="pdfReports" label="Downloadable PDF reports" checked={rule.pdfReports} />
        <Toggle name="progressTracking" label="Progress tracking" checked={rule.progressTracking} />
        {!paid ? <Toggle name="deckPreview" label="Free pitch deck preview (first deck only)" checked={rule.deckPreview} /> : null}
      </div>
      <TextareaField
        name="extras"
        label="Extra selling points"
        optional
        rows={3}
        hint="One per line, up to 4, shown after the features. English only, so keep them short. Only promise what the plan really gives."
        defaultValue={rule.extras.join("\n")}
        errors={errors}
      />
      <FormMessage status={state.status} message={state.message} />
      <SubmitButton pendingText="Saving…" className="justify-self-start">
        Save plan
      </SubmitButton>
    </form>
  );
}
