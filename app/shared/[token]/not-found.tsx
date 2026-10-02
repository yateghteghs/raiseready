import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function SharedReportNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center gap-4 px-4 py-20 sm:px-6">
      <Logo />
      <h1 className="text-3xl font-semibold tracking-tight">This link no longer works</h1>
      <p className="text-muted-foreground">
        Shared reports are available for a limited time, and founders can turn their links off. Ask the founder for a new link.
      </p>
      <Button asChild variant="outline">
        <Link href="/">About RaiseReady</Link>
      </Button>
    </main>
  );
}
