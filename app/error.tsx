"use client";

import { Button } from "@/components/ui/button";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center gap-4 px-4 py-20 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-muted-foreground">
        Please try again. If it keeps happening, share the reference below with support.
      </p>
      {error.digest ? (
        <p className="bg-muted rounded px-2 py-1 font-mono text-sm">Reference: {error.digest}</p>
      ) : null}
      <Button onClick={() => retry()}>Try again</Button>
    </main>
  );
}
