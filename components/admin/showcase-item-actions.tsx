"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { deleteShowcaseAction, toggleShowcaseAction } from "@/lib/showcase/actions";

export function ShowcaseItemActions({ id, published }: { id: string; published: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid justify-items-end gap-1">
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError((await toggleShowcaseAction(id, !published)).error ?? null);
            })
          }
        >
          {published ? "Hide" : "Publish"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            if (window.confirm("Delete this item from the website?")) start(() => deleteShowcaseAction(id));
          }}
        >
          Delete
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
