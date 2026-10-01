"use client";

import { Button } from "@/components/ui/button";

/** Shared body for error boundaries: what happened, a reference, and a retry. */
export function ErrorPanel({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div role="alert" className="mx-auto flex w-full max-w-xl flex-col items-start gap-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-muted-foreground">
        This page couldn&apos;t load. Your data is safe. Please try again; if it keeps happening, share the reference
        below with support.
      </p>
      {error.digest ? <p className="bg-muted rounded px-2 py-1 font-mono text-sm">Reference: {error.digest}</p> : null}
      <Button onClick={() => retry()}>Try again</Button>
    </div>
  );
}
