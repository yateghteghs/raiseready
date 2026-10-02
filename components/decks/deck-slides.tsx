"use client";

import { LockIcon, PencilIcon, SparklesIcon } from "lucide-react";
import { useActionState, useState } from "react";

import { SubmitButton } from "@/components/auth/submit-button";
import { SlideText } from "@/components/decks/slide-text";
import { FormMessage, TextareaField, TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { SLIDE_LABELS, type Slide, type SlideKind } from "@/lib/ai/schemas/deck";
import { editSlideAction, rewriteSlideAction } from "@/lib/decks/actions";
import { initialFormState } from "@/lib/forms";

type Mode = { index: number; kind: "edit" | "rewrite" } | null;

function EditForm({ deckId, index, slide, done }: { deckId: string; index: number; slide: Slide; done: () => void }) {
  const [state, action] = useActionState(editSlideAction.bind(null, deckId, index), initialFormState);
  const v = state.values ?? {};
  return (
    <form action={action} className="grid gap-3">
      <TextField name="title" label="Title" defaultValue={v.title ?? slide.title} errors={state.fieldErrors} maxLength={120} />
      <TextareaField
        name="bullets"
        label="Points"
        hint="One per line."
        rows={5}
        defaultValue={v.bullets ?? slide.bullets.join("\n")}
        errors={state.fieldErrors}
      />
      <TextareaField name="notes" label="Speaker notes" optional rows={3} defaultValue={v.notes ?? slide.notes} errors={state.fieldErrors} />
      <FormMessage status={state.status} message={state.message} action={state.action} />
      <div className="flex gap-2">
        <SubmitButton pendingText="Saving…">Save</SubmitButton>
        <Button type="button" variant="ghost" onClick={done}>
          {state.status === "success" ? "Close" : "Cancel"}
        </Button>
      </div>
    </form>
  );
}

function RewriteForm({ deckId, index, done, left }: { deckId: string; index: number; done: () => void; left: number }) {
  const [state, action] = useActionState(rewriteSlideAction.bind(null, deckId, index), initialFormState);
  return (
    <form action={action} className="grid gap-3">
      <TextareaField
        name="request"
        label="How should this slide change?"
        hint={`For example: "Lead with our revenue", "Make it shorter", "Our CAC is ₦2,500". ${left} AI rewrite${left === 1 ? "" : "s"} left for this deck.`}
        rows={2}
        maxLength={500}
        defaultValue={state.status === "success" ? "" : state.values?.request}
        errors={state.fieldErrors}
      />
      <FormMessage status={state.status} message={state.message} action={state.action} />
      <div className="flex gap-2">
        <SubmitButton pendingText="Rewriting…">Rewrite</SubmitButton>
        <Button type="button" variant="ghost" onClick={done}>
          {state.status === "success" ? "Close" : "Cancel"}
        </Button>
      </div>
    </form>
  );
}

export function DeckSlides({
  deckId,
  slides,
  locked,
  rewritesLeft,
  rewriteBlocked,
}: {
  deckId: string;
  slides: Slide[];
  /** Kinds of the slides still locked in a preview. Their content never reaches the browser. */
  locked: SlideKind[];
  rewritesLeft: number;
  rewriteBlocked: string | null;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const done = () => setMode(null);

  return (
    <ol className="grid gap-4">
      {slides.map((slide, i) => (
        <li key={i} className="bg-card grid gap-3 rounded-xl border p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-primary text-xs font-semibold tracking-wide uppercase">
              {i + 1}. {SLIDE_LABELS[slide.kind]}
            </p>
            {mode?.index === i ? null : (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setMode({ index: i, kind: "edit" })}>
                  <PencilIcon aria-hidden="true" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={Boolean(rewriteBlocked)}
                  title={rewriteBlocked ?? undefined}
                  onClick={() => setMode({ index: i, kind: "rewrite" })}
                >
                  <SparklesIcon aria-hidden="true" /> Rewrite with AI
                </Button>
              </div>
            )}
          </div>
          {mode?.index === i && mode.kind === "edit" ? (
            <EditForm deckId={deckId} index={i} slide={slide} done={done} />
          ) : (
            <>
              <h2 className="text-lg font-semibold">
                <SlideText text={slide.title} />
              </h2>
              {slide.bullets.length ? (
                <ul className="grid list-disc gap-1 ps-5 text-sm">
                  {slide.bullets.map((b, j) => (
                    <li key={j}>
                      <SlideText text={b} />
                    </li>
                  ))}
                </ul>
              ) : null}
              {slide.visual ? <p className="text-muted-foreground text-sm">Suggested visual: {slide.visual}</p> : null}
              {slide.missing.length ? (
                <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-medium">To add</p>
                  <ul className="mt-1 list-disc ps-5">
                    {slide.missing.map((m, j) => (
                      <li key={j}>{m}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {slide.notes ? (
                <details className="text-sm">
                  <summary className="text-muted-foreground cursor-pointer">Speaker notes</summary>
                  <p className="mt-2 whitespace-pre-line">{slide.notes}</p>
                </details>
              ) : null}
              {mode?.index === i && mode.kind === "rewrite" ? (
                <div className="border-t pt-3">
                  <RewriteForm deckId={deckId} index={i} done={done} left={rewritesLeft} />
                </div>
              ) : null}
            </>
          )}
        </li>
      ))}
      {locked.map((kind, j) => (
        <li key={`locked-${j}`} className="bg-muted/40 text-muted-foreground flex items-center gap-2 rounded-xl border border-dashed p-5 text-sm">
          <LockIcon className="size-4" aria-hidden="true" />
          {slides.length + j + 1}. {SLIDE_LABELS[kind]}: unlock the full deck to see this slide
        </li>
      ))}
    </ol>
  );
}
