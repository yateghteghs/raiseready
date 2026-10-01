"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { deleteDocumentAction, documentLinkAction } from "@/lib/documents/actions";
import type { DocumentStatus } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

export type DocumentRow = {
  id: string;
  name: string;
  kindLabel: string;
  size: string;
  when: string;
  status: DocumentStatus;
  error: string | null;
  inUse: boolean;
};

const STATUS: Record<DocumentStatus, { label: string; className: string }> = {
  uploaded: { label: "Not analysed", className: "bg-muted text-muted-foreground" },
  processing: { label: "Analysing…", className: "bg-warning/20" },
  ready: { label: "Analysed", className: "bg-accent text-accent-foreground" },
  failed: { label: "Failed", className: "bg-destructive/10 text-destructive" },
};

export function DocumentList({ rows }: { rows: DocumentRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function view(id: string) {
    setError(null);
    const result = await documentLinkAction(id);
    if (result.ok) window.open(result.data, "_blank", "noopener,noreferrer");
    else setError(result.error);
  }

  async function remove(row: DocumentRow) {
    if (!window.confirm(`Delete "${row.name}"? This permanently removes the file.`)) return;
    setError(null);
    setBusyId(row.id);
    const result = await deleteDocumentAction(row.id);
    setBusyId(null);
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">No documents yet. Start with your pitch deck.</p>;
  }

  return (
    <div className="grid gap-3">
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <ul className="divide-y rounded-xl border">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate font-medium" title={row.name}>
                {row.name}
              </p>
              <p className="text-muted-foreground text-xs">
                {row.kindLabel} · {row.size} · {row.when}
                {row.inUse ? " · used in analysis" : ""}
              </p>
              {row.status === "failed" && row.error ? (
                <p className="text-destructive mt-1 text-xs">{row.error}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS[row.status].className)}>
                {STATUS[row.status].label}
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => view(row.id)}>
                View
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busyId === row.id || row.status === "processing"}
                onClick={() => remove(row)}
                aria-label={`Delete ${row.name}`}
              >
                {busyId === row.id ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
