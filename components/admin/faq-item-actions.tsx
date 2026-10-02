"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { deleteFaqAction, toggleFaqAction } from "@/lib/faq/actions";

export function FaqItemActions({ id, published }: { id: string; published: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError((await toggleFaqAction(id, !published)).error ?? null);
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
          if (window.confirm("Delete this question from the FAQ?")) start(() => deleteFaqAction(id));
        }}
      >
        Delete
      </Button>
      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
