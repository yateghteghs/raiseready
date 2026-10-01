import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center gap-4 px-4 py-20 sm:px-6">
      <p className="text-primary text-sm font-medium">404</p>
      <h1 className="text-3xl font-semibold tracking-tight">This page isn&apos;t here</h1>
      <p className="text-muted-foreground">
        The link may be wrong, or the page may have moved.
      </p>
      <Button asChild>
        <Link href="/">Go to the home page</Link>
      </Button>
    </main>
  );
}
