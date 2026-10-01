"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/auth/submit-button";
import { FormMessage } from "@/components/forms/fields";
import { NativeSelect } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import { initialFormState } from "@/lib/forms";
import { startSimulationAction } from "@/lib/simulation/actions";

type Choice = { value: string; label: string; summary: string };

function ChoiceGroup({ name, legend, choices, defaultValue }: { name: string; legend: string; choices: Choice[]; defaultValue: string }) {
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1 font-medium">{legend}</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        {choices.map((c) => (
          <label
            key={c.value}
            className="has-checked:border-primary has-checked:ring-primary/20 has-focus-visible:ring-ring/50 bg-card flex cursor-pointer flex-col gap-1 rounded-xl border p-4 has-checked:ring-4 has-focus-visible:ring-[3px]"
          >
            <span className="flex items-center gap-2 font-medium">
              <input type="radio" name={name} value={c.value} defaultChecked={c.value === defaultValue} className="accent-primary" />
              {c.label}
            </span>
            <span className="text-muted-foreground text-sm">{c.summary}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function SetupForm({
  personas,
  difficulties,
  fundingTypes,
  defaultFundingType,
}: {
  personas: Choice[];
  difficulties: Choice[];
  fundingTypes: { value: string; label: string }[];
  defaultFundingType: string;
}) {
  const [state, action] = useActionState(startSimulationAction, initialFormState);
  return (
    <form action={action} className="grid gap-8">
      <FormMessage status={state.status} message={state.message} action={state.action} />
      <ChoiceGroup name="persona" legend="Who are you pitching to?" choices={personas} defaultValue="seed_vc" />
      <ChoiceGroup name="difficulty" legend="How hard should they push?" choices={difficulties} defaultValue="analytical" />
      <div className="grid max-w-sm gap-2">
        <Label htmlFor="funding_type">What are you raising?</Label>
        <NativeSelect id="funding_type" name="funding_type" defaultValue={defaultFundingType}>
          <option value="">Not specified</option>
          {fundingTypes.map((f) => (
            <option key={f.value} value={f.label}>
              {f.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid justify-items-start gap-2">
        <SubmitButton pendingText="Starting…">Enter the Investor Room</SubmitButton>
        <p className="text-muted-foreground text-sm">
          About 10 to 20 questions. Answer in writing as you would speak in the meeting.
        </p>
      </div>
    </form>
  );
}
