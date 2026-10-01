"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { SubmitButton } from "@/components/auth/submit-button";
import { FormMessage } from "@/components/forms/fields";
import {
  AboutYouFields,
  CompanyFields,
  FundraisingFields,
  TractionFields,
} from "@/components/startup/startup-fields";
import { Button } from "@/components/ui/button";
import { fieldErrorsOf, formValues, initialFormState, type FieldErrors } from "@/lib/forms";
import { submitOnboarding } from "@/lib/startups/actions";
import { firstStepWithError, ONBOARDING_STEPS } from "@/lib/startups/schema";
import { cn } from "@/lib/utils";

const SECTIONS = [AboutYouFields, CompanyFields, TractionFields, FundraisingFields];

export function OnboardingForm({ initialValues }: { initialValues: Record<string, string> }) {
  const [state, action] = useActionState(submitOnboarding, initialFormState);
  const [step, setStep] = useState(0);
  const [stepErrors, setStepErrors] = useState<FieldErrors | undefined>();
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const values = state.values ?? initialValues;
  const errors = stepErrors ?? state.fieldErrors;
  const isLast = step === ONBOARDING_STEPS.length - 1;

  // If the server rejects the submission, jump to the first step with an error.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.status === "error" && state.fieldErrors) {
      setStep(firstStepWithError(Object.keys(state.fieldErrors)));
      setStepErrors(undefined);
    }
  }

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  function goNext() {
    if (!formRef.current) return;
    const result = ONBOARDING_STEPS[step].schema.safeParse(formValues(new FormData(formRef.current)));
    if (!result.success) {
      setStepErrors(fieldErrorsOf(result.error));
      return;
    }
    setStepErrors(undefined);
    setStep((s) => s + 1);
  }

  function goBack() {
    setStepErrors(undefined);
    setStep((s) => Math.max(0, s - 1));
  }

  return (
    <form
      ref={formRef}
      action={action}
      noValidate
      className="grid gap-6"
      onKeyDown={(e) => {
        // Enter on an earlier step moves forward instead of submitting.
        if (e.key === "Enter" && !isLast && (e.target as HTMLElement).tagName === "INPUT") {
          e.preventDefault();
          goNext();
        }
      }}
    >
      <ol className="grid grid-cols-4 gap-2" aria-label="Onboarding progress">
        {ONBOARDING_STEPS.map((s, i) => (
          <li key={s.id} aria-current={i === step ? "step" : undefined}>
            <div className={cn("h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
            <span
              className={cn(
                "mt-2 hidden text-xs sm:block",
                i === step ? "text-foreground font-medium" : "text-muted-foreground",
              )}
            >
              {s.title}
            </span>
          </li>
        ))}
      </ol>

      <div>
        <p className="text-muted-foreground text-sm">
          Step {step + 1} of {ONBOARDING_STEPS.length}
        </p>
        <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold outline-none">
          {ONBOARDING_STEPS[step].title}
        </h2>
      </div>

      <FormMessage
        status={stepErrors ? "error" : state.status}
        message={stepErrors ? "Please fix the highlighted fields." : state.message}
      />

      {SECTIONS.map((Section, i) => (
        // Every step stays in the form so the final submit sends all answers.
        <div key={ONBOARDING_STEPS[i].id} hidden={i !== step}>
          <Section values={values} errors={errors} />
        </div>
      ))}

      <div className="flex items-center justify-between gap-3 border-t pt-6">
        <Button type="button" variant="ghost" onClick={goBack} disabled={step === 0}>
          Back
        </Button>
        {isLast ? (
          <SubmitButton pendingText="Saving…">Finish</SubmitButton>
        ) : (
          <Button type="button" onClick={goNext}>
            Continue
          </Button>
        )}
      </div>
    </form>
  );
}
