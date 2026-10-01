"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { UploadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { finalizeUploadAction, prepareUploadAction } from "@/lib/documents/actions";
import { MAX_FILE_BYTES, type UploadableKind } from "@/lib/documents/rules";
import { createClient } from "@/lib/supabase/client";

type Phase = { state: "idle" } | { state: "busy"; label: string } | { state: "error"; message: string };

export function UploadSlot({
  kind,
  label,
  hint,
  accept,
  required,
  current,
  disabled,
}: {
  kind: UploadableKind;
  label: string;
  hint: string;
  accept: string;
  required: boolean;
  current: { name: string; when: string } | null;
  disabled: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ state: "idle" });

  async function upload(file: File) {
    if (file.size > MAX_FILE_BYTES) {
      setPhase({ state: "error", message: "Files must be 20 MB or smaller." });
      return;
    }
    setPhase({ state: "busy", label: "Preparing…" });
    const prepared = await prepareUploadAction(file.name);
    if (!prepared.ok) return setPhase({ state: "error", message: prepared.error });

    setPhase({ state: "busy", label: "Uploading…" });
    const { error } = await createClient()
      .storage.from("documents")
      .uploadToSignedUrl(prepared.data.path, prepared.data.token, file, {
        contentType: prepared.data.contentType,
      });
    if (error) return setPhase({ state: "error", message: "The upload didn't complete. Please try again." });

    setPhase({ state: "busy", label: "Checking file…" });
    const finalized = await finalizeUploadAction(prepared.data.path, kind, file.name);
    if (!finalized.ok) return setPhase({ state: "error", message: finalized.error });

    setPhase({ state: "idle" });
    router.refresh();
  }

  const busy = phase.state === "busy";
  const inputId = `upload-${kind}`;

  return (
    <div className="bg-card flex flex-col gap-3 rounded-xl border p-5">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{label}</h3>
          <span className="text-muted-foreground text-xs">{required ? "Required" : "Optional"}</span>
        </div>
        <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
      </div>
      {current ? (
        <p className="truncate text-sm" title={current.name}>
          <span className="text-muted-foreground">Current: </span>
          {current.name}
          <span className="text-muted-foreground"> · {current.when}</span>
        </p>
      ) : null}
      <div className="mt-auto">
        <input
          ref={input}
          id={inputId}
          type="file"
          accept={accept}
          className="sr-only"
          disabled={busy || disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
        <Button
          type="button"
          variant={current ? "outline" : "default"}
          size="sm"
          disabled={busy || disabled}
          onClick={() => input.current?.click()}
          aria-describedby={phase.state === "error" ? `${inputId}-error` : undefined}
        >
          <UploadIcon aria-hidden="true" />
          {busy ? phase.label : current ? "Replace" : "Upload"}
        </Button>
        <p aria-live="polite" className="mt-2 min-h-5 text-sm">
          {phase.state === "error" ? (
            <span id={`${inputId}-error`} className="text-destructive">
              {phase.message}
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
