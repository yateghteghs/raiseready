"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/auth/submit-button";
import { FormMessage, TextareaField, TextField } from "@/components/forms/fields";
import { saveFaqAction } from "@/lib/faq/actions";
import { PLAN_PLACEHOLDERS } from "@/lib/faq/placeholders";
import { initialFormState } from "@/lib/forms";
import type { Locale } from "@/lib/i18n/config";

export type FaqDraft = { slug?: string | null; category: string; question: string; answer: string; position: number; published: boolean };

/** Adds an entry (no `id`), translates one (`initial.slug`) or edits one (`id`). */
export function FaqForm({ id, locale, initial, submitLabel }: { id?: string; locale: Locale; initial?: FaqDraft; submitLabel: string }) {
  const [state, action] = useActionState(saveFaqAction.bind(null, id ?? null), initialFormState);
  // A new entry clears after saving; an edit keeps what was saved.
  const reset = !id && state.status === "success";
  const v = reset ? {} : (state.values ?? {});
  const errors = state.fieldErrors;
  const dir = locale === "ar" ? "rtl" : undefined;

  return (
    <form action={action} key={reset ? state.message : "form"} noValidate className="grid gap-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="slug" value={initial?.slug ?? ""} />
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <TextField name="category" label="Section" placeholder="e.g. Getting started" defaultValue={v.category ?? initial?.category} errors={errors} dir={dir} />
        <TextField name="position" label="Order" type="number" min={0} max={9999} optional defaultValue={v.position ?? String(initial?.position ?? 0)} errors={errors} />
      </div>
      <TextField name="question" label="Question" maxLength={300} defaultValue={v.question ?? initial?.question} errors={errors} dir={dir} />
      <TextareaField
        name="answer"
        label="Answer"
        rows={4}
        maxLength={4000}
        hint={`To quote a plan number that follows Admin → Plans, write ${Object.keys(PLAN_PLACEHOLDERS).map((k) => `{${k}}`).join(", ")}.`}
        defaultValue={v.answer ?? initial?.answer}
        errors={errors}
        dir={dir}
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="published" defaultChecked={v.published ? v.published === "on" : (initial?.published ?? true)} className="accent-primary" />
        Published (untick to keep as a draft)
      </label>
      <FormMessage status={state.status} message={state.message} />
      <SubmitButton pendingText="Saving…" className="justify-self-start">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
