"use client";

import { ImageIcon, UserIcon } from "lucide-react";
import { useActionState, useRef, useState, useTransition } from "react";

import { FormMessage } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { initialFormState, type FormState } from "@/lib/forms";
import { removeImageAction, uploadImageAction } from "@/lib/images/actions";
import { IMAGE_ACCEPT, MAX_IMAGE_BYTES, type ImageKind } from "@/lib/images/rules";
import { cn } from "@/lib/utils";

/** Picks, previews and saves a profile picture or company logo. */
export function ImageUpload({ kind, label, hint, url }: { kind: ImageKind; label: string; hint: string; url: string | null }) {
  const [uploadState, upload, uploading] = useActionState(uploadImageAction.bind(null, kind), initialFormState);
  const [removeState, setRemoveState] = useState<FormState | null>(null);
  const [removing, startRemove] = useTransition();
  const [tooBig, setTooBig] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const busy = uploading || removing;
  const state = removeState ?? uploadState;
  const inputId = `image-${kind}`;
  const Placeholder = kind === "avatar" ? UserIcon : ImageIcon;

  return (
    <div className="flex flex-wrap items-start gap-4">
      <div
        className={cn(
          "bg-muted text-muted-foreground flex size-20 shrink-0 items-center justify-center overflow-hidden border",
          kind === "avatar" ? "rounded-full" : "rounded-lg bg-white",
        )}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed links; next/image would cache them
          <img src={url} alt={label} className={cn("size-full", kind === "avatar" ? "object-cover" : "object-contain p-1")} />
        ) : (
          <Placeholder aria-hidden="true" className="size-8" />
        )}
      </div>
      <div className="grid min-w-0 flex-1 gap-2">
        <div>
          <label htmlFor={inputId} className="text-sm font-medium">
            {label} <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <p className="text-muted-foreground text-xs">{hint}</p>
        </div>
        <form
          ref={form}
          action={(data) => {
            setRemoveState(null);
            upload(data);
          }}
          className="flex flex-wrap gap-2"
        >
          <input
            ref={input}
            id={inputId}
            name="image"
            type="file"
            accept={IMAGE_ACCEPT}
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const big = file.size > MAX_IMAGE_BYTES;
              setTooBig(big);
              if (!big) form.current?.requestSubmit();
            }}
          />
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
            {uploading ? "Uploading…" : url ? "Change" : "Upload"}
          </Button>
          {url ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => startRemove(async () => setRemoveState(await removeImageAction(kind)))}
            >
              {removing ? "Removing…" : "Remove"}
            </Button>
          ) : null}
        </form>
        {tooBig ? (
          <FormMessage status="error" message="Images must be 2 MB or smaller." />
        ) : (
          <FormMessage status={state.status} message={state.message} />
        )}
      </div>
    </div>
  );
}
