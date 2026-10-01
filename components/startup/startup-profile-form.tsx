"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/auth/submit-button";
import { FormMessage } from "@/components/forms/fields";
import {
  CompanyFields,
  FundraisingFields,
  TractionFields,
} from "@/components/startup/startup-fields";
import { initialFormState } from "@/lib/forms";
import { updateStartup } from "@/lib/startups/actions";

const SECTIONS = [
  { title: "Company", description: "The basics investors see first.", Fields: CompanyFields },
  {
    title: "Business & traction",
    description: "How you make money and how fast you're growing.",
    Fields: TractionFields,
  },
  {
    title: "Fundraising",
    description: "What you're raising and what it's for.",
    Fields: FundraisingFields,
  },
];

export function StartupProfileForm({ initialValues }: { initialValues: Record<string, string> }) {
  const [state, action] = useActionState(updateStartup, initialFormState);
  const values = state.values ?? initialValues;

  return (
    <form action={action} noValidate className="grid gap-8">
      {SECTIONS.map(({ title, description, Fields }) => (
        <section key={title} aria-labelledby={`section-${title}`} className="grid gap-4">
          <div>
            <h2 id={`section-${title}`} className="text-lg font-semibold">
              {title}
            </h2>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
          <Fields values={values} errors={state.fieldErrors} />
        </section>
      ))}
      <div className="bg-background/95 sticky bottom-0 grid gap-3 border-t py-4 backdrop-blur">
        <FormMessage status={state.status} message={state.message} />
        <SubmitButton pendingText="Saving…" className="justify-self-end">
          Save changes
        </SubmitButton>
      </div>
    </form>
  );
}
